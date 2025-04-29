import json
import asyncio
import threading
from typing import List, Dict, Any, Generator
from datetime import datetime

from api.utils.prompt import ClientMessage
from api.db.index import db_history
from api.utils.helpers.error_handling import log_error, ExternalServiceError, run_async
from api.utils.tools import (
    TOOL_DEFINITIONS, 
    format_usage_data, 
    process_tool_calls
)
from api.utils.config import config

client = config.openai_client
DEFAULT_MODEL = config.openai_model


async def save_chat_history(messages: List[ClientMessage], response: str, tool_calls: List[Dict[str, Any]] = None, user_id: str = None) -> bool:
    """
    Save chat history to the database after stream completion.
    
    Args:
        messages: List of user messages (ClientMessage objects or dictionaries)
        response: Complete AI response text
        tool_calls: List of tool calls if any were made
        user_id: Optional user ID to associate with this chat
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        message_dicts = []
        for msg in messages:
            if hasattr(msg, 'model_dump'):  # If it's a Pydantic model
                message_dicts.append(msg.model_dump())
            elif isinstance(msg, dict):  # If it's already a dict
                message_dicts.append(msg)
            else:
                message_dicts.append(str(msg))
        
        chat_record = {
            "timestamp": datetime.utcnow(),
            "user_id": user_id,
            "messages": message_dicts,
            "response": response,
            "tool_calls": tool_calls or []
        }
        
        await db_history.insert_one(chat_record)
        return True
    except Exception as e:
        log_error(e, "save_chat_history")
        return False


def create_openai_stream(messages: List[ClientMessage], model: str = None):
    """
    Create a streaming completion from OpenAI.
    
    Args:
        messages: List of messages to send to the model
        model: Model name to use (defaults to configured model)
    
    Returns:
        A stream of completion responses
        
    Raises:
        ExternalServiceError: If there's an error with the OpenAI service
    """
    try:
        model = model or config.openai_model
        
        tools = TOOL_DEFINITIONS if config.enable_tool_calls else None
        
        return client.chat.completions.create(
            messages=messages,
            model=model,
            stream=True,
            tools=tools
        )
    except Exception as e:
        raise ExternalServiceError("OpenAI", str(e))


# Define a proper async safe wrapper for saving history
async def async_save_history(messages, response, tool_calls=None, user_id=None):
    """Safely execute save_chat_history in the current event loop"""
    try:
        # Get the current event loop
        loop = asyncio.get_event_loop()
        # Create and schedule the task
        return await save_chat_history(messages, response, tool_calls, user_id)
    except Exception as e:
        log_error(e, "async_save_history")
        return False


async def handle_text_protocol(stream, messages: List[ClientMessage], user_id: str = None) -> Generator[str, None, None]: # type: ignore
    """
    Handle text protocol streaming.
    
    Args:
        stream: OpenAI stream
        messages: Input messages
        user_id: Optional user ID
        
    Yields:
        Text response chunks
    """
    complete_response = ""
    
    try:
        for chunk in stream:
            for choice in chunk.choices:
                if choice.finish_reason == "stop":
                    break
                else:
                    if choice.delta.content:
                        complete_response += choice.delta.content
                    yield choice.delta.content or ""
        
        asyncio.create_task(await async_save_history(
            messages, complete_response, None, user_id
        ))
    
    except Exception as e:
        log_error(e, "text_protocol_handler")
        yield f"Error: {str(e)}"


async def handle_data_protocol(stream, messages: List[ClientMessage], user_id: str = None) -> Generator[str, None, None]: # type: ignore
    """
    Handle data protocol streaming with tool calls support.
    
    Args:
        stream: OpenAI stream
        messages: Input messages
        user_id: Optional user ID
        
    Yields:
        Formatted data protocol responses
    """
    complete_response = ""
    all_tool_calls = []
    draft_tool_calls = []
    draft_tool_calls_index = -1

    try:
        for chunk in stream:
            for choice in chunk.choices:
                if choice.finish_reason == "stop":
                    continue

                elif choice.finish_reason == "tool_calls":
                    formatted_calls, formatted_results, processed_tool_calls = process_tool_calls(draft_tool_calls)
                    
                    for formatted_call in formatted_calls:
                        yield formatted_call
                    
                    for formatted_result in formatted_results:
                        yield formatted_result
                    
                    all_tool_calls.extend(processed_tool_calls)

                elif choice.delta.tool_calls:
                    for tool_call in choice.delta.tool_calls:
                        id = tool_call.id
                        name = tool_call.function.name
                        arguments = tool_call.function.arguments

                        if id is not None:
                            draft_tool_calls_index += 1
                            draft_tool_calls.append(
                                {"id": id, "name": name, "arguments": ""}
                            )
                        else:
                            draft_tool_calls[draft_tool_calls_index]["arguments"] += arguments

                else:
                    if choice.delta.content:
                        complete_response += choice.delta.content or ""
                    yield f'0:{json.dumps(choice.delta.content)}\n'

            if chunk.choices == []:
                usage = chunk.usage
                yield format_usage_data(
                    "tool-calls" if len(draft_tool_calls) > 0 else "stop",
                    usage.prompt_tokens,
                    usage.completion_tokens
                )
                
                # Create a task in the event loop without threading
                asyncio.create_task(await async_save_history(
                    messages, complete_response, all_tool_calls, user_id
                ))
    
    except Exception as e:
        log_error(e, "data_protocol_handler")
        yield f'0:{json.dumps("Error: " + str(e))}\n'


async def stream_text_with_timeout(messages: List[ClientMessage], protocol: str = 'data', user_id: str = None) -> Generator[str, None, None]: # type: ignore
    """
    Stream text responses with timeout handling.
    
    Args:
        messages: List of messages to send to the model
        protocol: Protocol to use ('text' or 'data')
        user_id: Optional user ID
        
    Returns:
        Formatted response chunks based on the protocol
    """
    try:
        timeout = config.stream_timeout
        
        # Use asyncio.to_thread to run the synchronous generator in a separate thread
        gen = await asyncio.to_thread(stream_text, messages, protocol, user_id)
        
        # Apply timeout to the entire operation
        result = await asyncio.wait_for(
            asyncio.to_thread(list, gen),  # Convert generator to list with timeout
            timeout=timeout
        )
        
        # Return the result as a generator
        for item in result:
            yield item
        
    except asyncio.TimeoutError:
        error_msg = f"Request timed out after {config.stream_timeout} seconds"
        log_error(asyncio.TimeoutError(error_msg), "stream_timeout")
        
        if protocol == 'text':
            yield error_msg
        else:
            yield f'0:{json.dumps(error_msg)}\n'
    
    except Exception as e:
        log_error(e, "stream_text_with_timeout")
        error_msg = f"Error processing request: {str(e)}"
        
        if protocol == 'text':
            yield error_msg
        else:
            yield f'0:{json.dumps(error_msg)}\n'


def stream_text(messages: List[ClientMessage], protocol: str = 'data', user_id: str = None) -> Generator[str, None, None]:
    """
    Stream text responses from the AI model.
    
    Args:
        messages: List of messages to send to the model
        protocol: Protocol to use ('text' or 'data')
        user_id: Optional user ID
        
    Yields:
        Formatted response chunks based on the protocol
    """
    try:
        stream = create_openai_stream(messages)
        
        # Since we can't directly yield from async generators in a sync function,
        # we'll process the stream directly here without using the async handlers
        
        complete_response = ""
        
        if protocol == 'text':
            # Handle text protocol directly
            for chunk in stream:
                for choice in chunk.choices:
                    if choice.finish_reason == "stop":
                        break
                    else:
                        if choice.delta.content:
                            complete_response += choice.delta.content
                        yield choice.delta.content or ""
            
            # Use a threading approach to handle the async save
            threading.Thread(
                target=lambda: run_async(save_chat_history(messages, complete_response, None, user_id)),
                daemon=True
            ).start()
            
        elif protocol == 'data':
            # Handle data protocol directly
            all_tool_calls = []
            draft_tool_calls = []
            draft_tool_calls_index = -1

            for chunk in stream:
                for choice in chunk.choices:
                    if choice.finish_reason == "stop":
                        continue
                    
                    elif choice.finish_reason == "tool_calls":
                        formatted_calls, formatted_results, processed_tool_calls = process_tool_calls(draft_tool_calls)
                        
                        for formatted_call in formatted_calls:
                            yield formatted_call
                        
                        for formatted_result in formatted_results:
                            yield formatted_result
                        
                        all_tool_calls.extend(processed_tool_calls)
                    
                    elif choice.delta.tool_calls:
                        for tool_call in choice.delta.tool_calls:
                            id = tool_call.id
                            name = tool_call.function.name
                            arguments = tool_call.function.arguments

                            if id is not None:
                                draft_tool_calls_index += 1
                                draft_tool_calls.append(
                                    {"id": id, "name": name, "arguments": ""}
                                )
                            else:
                                draft_tool_calls[draft_tool_calls_index]["arguments"] += arguments
                    
                    else:
                        if choice.delta.content:
                            complete_response += choice.delta.content or ""
                        yield f'0:{json.dumps(choice.delta.content)}\n'

                if chunk.choices == []:
                    usage = chunk.usage
                    yield format_usage_data(
                        "tool-calls" if len(draft_tool_calls) > 0 else "stop",
                        usage.prompt_tokens,
                        usage.completion_tokens
                    )
                    
                    # Use a threading approach to handle the async save
                    threading.Thread(
                        target=lambda: run_async(save_chat_history(messages, complete_response, all_tool_calls, user_id)),
                        daemon=True
                    ).start()
        else:
            yield f"Error: Unsupported protocol '{protocol}'"
    
    except Exception as e:
        log_error(e, "stream_text")
        error_msg = f"Error processing request: {str(e)}"
        
        if protocol == 'text':
            yield error_msg
        else:
            yield f'0:{json.dumps(error_msg)}\n'
