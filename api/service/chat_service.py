import os
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional, AsyncGenerator
import hashlib
from dotenv import load_dotenv
import traceback

from openai import OpenAI
from fastapi import Request
from api.utils.prompt import ClientMessage
from api.utils.tools import get_current_weather
from api.service.chat_history_service import save_chat_history

load_dotenv(".env.local")

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)

available_tools = {
    "get_current_weather": get_current_weather,
}

# Create a singleton class to manage chat saving state
class ChatSaveManager:
    """Singleton class to manage chat saving state and prevent duplicates"""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ChatSaveManager, cls).__new__(cls)
            cls._instance._active_chats = {}
            cls._instance._last_cleanup = datetime.now().timestamp()
        return cls._instance
    
    def start_chat(self, clerk_id: str, user_content: str) -> str:
        """Register a chat as active and generate a conversation ID"""
        if not clerk_id:
            return None
            
        # Generate a hash of the user content and clerk ID
        chat_key = hashlib.md5(f"{user_content}:{clerk_id}".encode()).hexdigest()
        
        # Record this chat as active
        now = datetime.now().timestamp()
        self._active_chats[chat_key] = {
            "start_time": now,
            "clerk_id": clerk_id,
            "saved": False,
            "last_activity": now
        }
        
        # Cleanup old entries occasionally
        if now - self._last_cleanup > 300:  # 5 minutes
            self._cleanup_old_chats()
            self._last_cleanup = now
            
        return chat_key
    
    def mark_as_saved(self, chat_key: str) -> None:
        """Mark a chat as saved to prevent duplicate saves"""
        if chat_key and chat_key in self._active_chats:
            self._active_chats[chat_key]["saved"] = True
            self._active_chats[chat_key]["last_activity"] = datetime.now().timestamp()
            print(f"Chat {chat_key[:8]} marked as saved")
    
    def should_save(self, chat_key: str) -> bool:
        """Check if a chat should be saved"""
        if not chat_key or chat_key not in self._active_chats:
            return False
            
        # Update last activity time
        self._active_chats[chat_key]["last_activity"] = datetime.now().timestamp()
        
        # Only save if not already saved
        return not self._active_chats[chat_key]["saved"]
    
    def _cleanup_old_chats(self) -> None:
        """Remove old chat entries to prevent memory leaks"""
        now = datetime.now().timestamp()
        keys_to_remove = []
        
        for key, info in self._active_chats.items():
            # Remove chats older than 1 hour
            if now - info["last_activity"] > 3600:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self._active_chats[key]
            
        if keys_to_remove:
            print(f"Cleaned up {len(keys_to_remove)} old chat entries")
    
    def debug_active_chats(self) -> Dict:
        """Get debug info about active chats"""
        return {
            "active_chat_count": len(self._active_chats),
            "saved_count": sum(1 for info in self._active_chats.values() if info["saved"]),
            "unsaved_count": sum(1 for info in self._active_chats.values() if not info["saved"])
        }

# Create a singleton instance
chat_manager = ChatSaveManager()


async def stream_text(
    messages: List[ClientMessage], 
    protocol: str = 'data', 
    clerk_id: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    Stream chat completions from OpenAI, and save the chat history when complete.
    
    Args:
        messages: List of messages in the conversation
        protocol: Protocol for streaming responses ('data' or 'text')
        clerk_id: Clerk user ID (if authenticated)
        
    Yields:
        Chunks of streaming response in the specified protocol
    """
    # Defensive check - ensure we have messages
    if not messages:
        print("Warning: No messages provided to stream_text")
        messages = [{"role": "system", "content": "You are a helpful assistant."}]
    
    # Find the last user message for tracking
    last_user_message = None
    for msg in reversed(messages):
        if isinstance(msg, dict) and msg.get("role") == "user":
            last_user_message = msg.get("content")
            break
    
    # Register this chat with the manager if we have both clerk_id and a user message
    chat_key = None
    if clerk_id and last_user_message:
        chat_key = chat_manager.start_chat(clerk_id, last_user_message)
    
    # Print debug info
    print(f"Starting stream for clerk_id: {clerk_id}, protocol: {protocol}, message count: {len(messages)}")
    print(f"First message role: {messages[0].get('role') if isinstance(messages[0], dict) else 'unknown'}")
    print(f"Chat key: {chat_key}, Active chats: {chat_manager.debug_active_chats()}")
    
    # Check if we can save this chat
    save_chat = False
    if clerk_id:
        if chat_key and chat_manager.should_save(chat_key):
            save_chat = True
            print(f"Will save chat with key: {chat_key}")
        else:
            print(f"Will NOT save chat (already saved or invalid key)")
    else:
        print("No clerk_id provided, chat history will not be saved")

    # Create stream
    stream = client.chat.completions.create(
        messages=messages,
        model="gpt-4o",
        stream=True,
        tools=[{
            "type": "function",
            "function": {
                "name": "get_current_weather",
                "description": "Get the current weather in a given location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city and state, e.g. San Francisco, CA",
                        },
                        "unit": {
                            "type": "string",
                            "enum": ["celsius", "fahrenheit"]},
                    },
                    "required": ["location", "unit"],
                },
            },
        }]
    )

    # Variables to collect the full response
    full_response = ""
    draft_tool_calls = []
    usage_info = None
    error_occurred = False
    
    # Copy the input messages for our final record
    final_messages = []
    for msg in messages:
        if isinstance(msg, dict):
            final_messages.append(msg.copy())
        else:
            final_messages.append(msg)

    try:
        if protocol == 'text':
            for chunk in stream:
                for choice in chunk.choices:
                    if choice.finish_reason == "stop":
                        break
                    else:
                        content = choice.delta.content or ""
                        full_response += content
                        yield f"{content}"
            
            # Update messages with the assistant's response
            if full_response:
                final_messages.append({"role": "assistant", "content": full_response})
            
        elif protocol == 'data':
            draft_tool_calls_index = -1

            for chunk in stream:
                # Track usage info from the last chunk
                if hasattr(chunk, 'usage') and chunk.usage:
                    usage_info = {
                        "prompt_tokens": chunk.usage.prompt_tokens,
                        "completion_tokens": chunk.usage.completion_tokens,
                        "total_tokens": chunk.usage.total_tokens if hasattr(chunk.usage, 'total_tokens') else (
                            chunk.usage.prompt_tokens + chunk.usage.completion_tokens)
                    }
                
                for choice in chunk.choices:
                    if choice.finish_reason == "stop":
                        continue

                    elif choice.finish_reason == "tool_calls":
                        for tool_call in draft_tool_calls:
                            yield '9:{{"toolCallId":"{id}","toolName":"{name}","args":{args}}}\n'.format(
                                id=tool_call["id"],
                                name=tool_call["name"],
                                args=tool_call["arguments"])

                        for tool_call in draft_tool_calls:
                            try:
                                tool_result = available_tools[tool_call["name"]](
                                    **json.loads(tool_call["arguments"]))
                                
                                yield 'a:{{"toolCallId":"{id}","toolName":"{name}","args":{args},"result":{result}}}\n'.format(
                                    id=tool_call["id"],
                                    name=tool_call["name"],
                                    args=tool_call["arguments"],
                                    result=json.dumps(tool_result))
                                
                                # Add tool result to final messages
                                final_messages.append({
                                    "role": "tool",
                                    "tool_call_id": tool_call["id"],
                                    "content": json.dumps(tool_result)
                                })
                                
                            except Exception as e:
                                error_occurred = True
                                error_msg = f"Error calling tool {tool_call['name']}: {str(e)}"
                                print(error_msg)
                                yield 'a:{{"toolCallId":"{id}","toolName":"{name}","args":{args},"error":{error}}}\n'.format(
                                    id=tool_call["id"],
                                    name=tool_call["name"],
                                    args=tool_call["arguments"],
                                    error=json.dumps(error_msg))
                                
                                # Add error to final messages
                                final_messages.append({
                                    "role": "tool",
                                    "tool_call_id": tool_call["id"],
                                    "content": json.dumps({"error": error_msg})
                                })

                    elif choice.delta.tool_calls:
                        for tool_call in choice.delta.tool_calls:
                            id = tool_call.id
                            name = tool_call.function.name if tool_call.function else None
                            arguments = tool_call.function.arguments if tool_call.function else None

                            if id is not None:
                                draft_tool_calls_index += 1
                                draft_tool_calls.append(
                                    {"id": id, "name": name or "", "arguments": ""})

                            else:
                                # Only add arguments if defined
                                if arguments:
                                    draft_tool_calls[draft_tool_calls_index]["arguments"] += arguments

                    else:
                        content = choice.delta.content or ""
                        full_response += content
                        yield '0:{text}\n'.format(text=json.dumps(content))

                if chunk.choices == [] and hasattr(chunk, 'usage') and chunk.usage:
                    usage = chunk.usage
                    prompt_tokens = usage.prompt_tokens
                    completion_tokens = usage.completion_tokens

                    yield 'd:{{"finishReason":"{reason}","usage":{{"promptTokens":{prompt},"completionTokens":{completion}}}}}\n'.format(
                        reason="tool-calls" if len(
                            draft_tool_calls) > 0 else "stop",
                        prompt=prompt_tokens,
                        completion=completion_tokens
                    )
            
            # Add the assistant response to final_messages
            if draft_tool_calls:
                final_messages.append({
                    "role": "assistant",
                    "content": full_response,
                    "tool_calls": draft_tool_calls
                })
            elif full_response:
                final_messages.append({
                    "role": "assistant",
                    "content": full_response
                })
        
        # Now save the chat history to database at the end of streaming
        # Only save if we have clerk_id, no errors, a response, and save_chat is True
        if clerk_id and not error_occurred and full_response and save_chat:
            print(f"Saving chat history for clerk_id: {clerk_id}, message count: {len(final_messages)}")
            
            try:
                # Save chatHistory directly 
                chat_id = await save_chat_history(
                    clerk_id=clerk_id,
                    messages=final_messages,
                    model="gpt-4o",
                    title=_extract_title_from_messages(final_messages),
                    usage=usage_info
                )
                print(f"Chat history saved with ID: {chat_id}")
                
                # Mark this chat as saved to prevent duplicates
                if chat_key:
                    chat_manager.mark_as_saved(chat_key)
                    
            except Exception as e:
                print(f"Failed to save chat history: {str(e)}")
                traceback.print_exc()
        else:
            if not clerk_id:
                print("Not saving chat: No clerk_id")
            elif error_occurred:
                print("Not saving chat: Error occurred")
            elif not full_response:
                print("Not saving chat: No response")
            elif not save_chat:
                print("Not saving chat: Already saved or invalid key")
                
    except Exception as e:
        error_occurred = True
        error_message = str(e)
        print(f"Error in stream_text: {error_message}")
        
        if clerk_id and save_chat:
            # Save the error in chat history
            try:
                await save_chat_history(
                    clerk_id=clerk_id,
                    messages=final_messages,  # Just save the input messages
                    error=error_message
                )
                
                # Mark this chat as saved to prevent duplicates
                if chat_key:
                    chat_manager.mark_as_saved(chat_key)
                    
            except Exception as save_error:
                print(f"Error saving chat error: {save_error}")


def _extract_title_from_messages(messages):
    """Extract a title from the first user message"""
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if isinstance(content, str) and content.strip():
                title = content[:30] + ("..." if len(content) > 30 else "")
                return title
    return f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}"
