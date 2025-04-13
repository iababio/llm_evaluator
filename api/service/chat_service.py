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

# Load environment variables
load_dotenv(".env.local")

# Initialize the OpenAI client safely with error handling
try:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
        
    # Create global OpenAI client instance
    openai_client = OpenAI(api_key=api_key)
    print("OpenAI client initialized successfully")
except Exception as client_init_error:
    print(f"Error initializing OpenAI client: {client_init_error}")
    traceback.print_exc()
    openai_client = None

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
    
    def start_chat(self, clerk_id: str, user_content: str, request_id: str = None) -> str:
        """Register a chat as active and generate a conversation ID"""
        if not clerk_id:
            return None
            
        # Generate a hash of the user content, clerk ID and request ID
        chat_key = hashlib.md5(f"{user_content}:{clerk_id}:{request_id}".encode()).hexdigest()
        
        # Record this chat as active
        now = datetime.now().timestamp()
        self._active_chats[chat_key] = {
            "start_time": now,
            "clerk_id": clerk_id,
            "saved": False,
            "last_activity": now,
            "conv_hash": None,  # Will be set when saving
            "request_id": request_id  # Store the request ID
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
    
    def is_duplicate_conversation(self, clerk_id: str, messages: List[Dict]) -> bool:
        """Check if this exact conversation was recently saved"""
        # Get a hash of the conversation content
        if not messages or not clerk_id:
            return False
            
        # Create a conversation signature based on the content
        conversation_sig = []
        for msg in messages:
            if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                # Only include essential parts to compare
                content = msg.get('content', '')
                if isinstance(content, str) and len(content) > 0:
                    # Use first 100 chars of each message to avoid very long signatures
                    conversation_sig.append(f"{msg['role']}:{content[:100]}")
                    
        if not conversation_sig:
            return False
            
        # Create a hash of the signature
        conv_hash = hashlib.md5(":".join(conversation_sig).encode()).hexdigest()
        
        # Check our active chats to see if this hash was recently saved
        for key, info in self._active_chats.items():
            if info.get("clerk_id") == clerk_id and info.get("saved") and info.get("conv_hash") == conv_hash:
                # This conversation was already saved
                print(f"Detected duplicate conversation save attempt: {conv_hash[:8]}")
                return True
                
        return False

# Create a singleton instance
chat_manager = ChatSaveManager()


async def stream_text(
    messages: List[ClientMessage], 
    protocol: str = 'data', 
    clerk_id: Optional[str] = None,
    request_id: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    Stream chat completions from OpenAI and save chat history to database.
    Prevents double streaming by using a more reliable streaming approach.
    """
    # Use the request ID if provided, otherwise generate a new one
    req_id = request_id or f"req_{hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:8]}"
    print(f"[{req_id}] Starting stream for clerk_id: {clerk_id}")
    
    # Check for duplicate requests - store seen request IDs in a set
    if not hasattr(stream_text, "_seen_request_ids"):
        stream_text._seen_request_ids = set()
        
    # Skip duplicate requests (could happen due to middleware error or retry)
    if req_id in stream_text._seen_request_ids:
        print(f"[{req_id}] Duplicate request detected! Skipping processing.")
        yield "Error: Duplicate request detected."
        return
        
    # Add this request ID to the seen set
    stream_text._seen_request_ids.add(req_id)
    
    # Clean up old request IDs occasionally (keep only recent ones)
    if len(stream_text._seen_request_ids) > 1000:
        # Keep only the 500 most recent IDs
        stream_text._seen_request_ids = set(list(stream_text._seen_request_ids)[-500:])
    
    # Ensure OpenAI client is available
    if openai_client is None:
        print("Error: OpenAI client is not initialized")
        yield "Error: Unable to connect to OpenAI API. Please check your API key and connection."
        return
    
    # Defensive check - ensure we have messages
    if not messages:
        print("Warning: No messages provided to stream_text")
        messages = [{"role": "system", "content": "You are a helpful assistant."}]
    
    # Debug user authentication status
    if not clerk_id:
        print(f"Warning: No clerk_id provided to stream_text for {protocol} request")
    else:
        print(f"stream_text called with authenticated clerk_id: {clerk_id}")

    # Find the last user message for tracking
    last_user_message = None
    for msg in reversed(messages):
        if isinstance(msg, dict) and msg.get("role") == "user":
            last_user_message = msg.get("content")
            break
    
    # Register this chat with the manager if we have both clerk_id and a user message
    chat_key = None
    if clerk_id and last_user_message:
        chat_key = chat_manager.start_chat(clerk_id, last_user_message, request_id=req_id)
        print(f"[{req_id}] Created chat_key: {chat_key} for clerk_id: {clerk_id}")
    else:
        if not clerk_id:
            print("Cannot generate chat_key: No clerk_id provided")
        if not last_user_message:
            print("Cannot generate chat_key: No user message found")
            
            # Create a synthetic user message if none exists (for pure-assistant flows)
            if isinstance(messages, list) and len(messages) > 0 and isinstance(messages[0], dict):
                system_message = next((m for m in messages if m.get("role") == "system"), None)
                if system_message:
                    synthetic_msg = f"Help me with: {system_message.get('content', '')[:30]}"
                    print(f"Generated synthetic user message: {synthetic_msg}")
                    last_user_message = synthetic_msg
                    
                    if clerk_id:
                        chat_key = chat_manager.start_chat(clerk_id, last_user_message, request_id=req_id)
                        print(f"Created chat_key from synthetic message: {chat_key}")
    
    # Print debug info
    print(f"Starting stream for clerk_id: {clerk_id}, protocol: {protocol}, message count: {len(messages)}")
    print(f"First message role: {messages[0].get('role') if isinstance(messages[0], dict) else 'unknown'}")
    print(f"Chat key: {chat_key}, Active chats: {chat_manager.debug_active_chats()}")
    
    # Enable chat saving
    save_chat = True
    print("Chat history saving is enabled")

    # Variables to collect the full response
    full_response = ""
    draft_tool_calls = []
    usage_info = None
    error_occurred = False
    stream_completed = False
    
    # Copy the input messages for our final record
    final_messages = []
    for msg in messages:
        if isinstance(msg, dict):
            final_messages.append(msg.copy())
        else:
            final_messages.append(msg)

    # Create stream
    stream = openai_client.chat.completions.create(
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

    # Save task reference for cleanup
    save_task = None

    try:
        if protocol == 'text':
            for chunk in stream:
                for choice in chunk.choices:
                    if choice.finish_reason == "stop":
                        stream_completed = True
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
                        stream_completed = True
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
                    stream_completed = True
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
        
        # Only attempt to save if stream completed properly
        # This is a key change to prevent double streaming
        if stream_completed:
            print("Stream complete, saving chat history")
            
            # The stream completed successfully, now save the chat
            if save_chat and clerk_id and chat_key and not error_occurred:
                # Only save if this chat should be saved (not already saved)
                if chat_manager.should_save(chat_key):
                    try:
                        # Extract title from messages
                        title = _extract_title_from_messages(final_messages)
                        
                        # Create metadata
                        metadata = {}
                        if usage_info:
                            metadata["usage"] = usage_info
                        
                        # Filter out initial messages
                        filtered_messages = _filter_initial_messages(final_messages)

                        # Generate conversation hash to track duplicates
                        conv_hash = None
                        if filtered_messages:
                            # Create a hash of the filtered messages to detect duplicates
                            conv_sig = []
                            for msg in filtered_messages:
                                if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                                    content = msg.get('content', '')
                                    if isinstance(content, str):
                                        conv_sig.append(f"{msg['role']}:{content[:100]}")
                            if conv_sig:
                                conv_hash = hashlib.md5(":".join(conv_sig).encode()).hexdigest()
                                chat_manager._active_chats[chat_key]["conv_hash"] = conv_hash

                        # Only save if we have actual messages to save AND this isn't a duplicate
                        if filtered_messages and not chat_manager.is_duplicate_conversation(clerk_id, filtered_messages):
                            saved_chat = await save_chat_history(
                                clerk_id=clerk_id,
                                title=title,
                                messages=filtered_messages,  # Use filtered messages here
                                metadata=metadata
                            )
                            
                            if saved_chat and saved_chat.get("id"):
                                chat_manager.mark_as_saved(chat_key)
                                print(f"Successfully saved chat history with ID: {saved_chat.get('id')}")
                            else:
                                print("Warning: Save operation didn't return a valid chat document")
                                # Fallback save code...
                        else:
                            if not filtered_messages:
                                print("No messages to save after filtering initial messages")
                            else:
                                print("Skipping save - detected duplicate conversation")
                            
                    except Exception as save_error:
                        print(f"Error during direct chat save: {save_error}")
                        traceback.print_exc()
                    
            else:
                reasons = []
                if not save_chat: reasons.append("save_chat=False")
                if not clerk_id: reasons.append("no clerk_id")
                if not chat_key: reasons.append("no chat_key")
                if error_occurred: reasons.append("error occurred")
                print(f"Chat history not saved - reasons: {', '.join(reasons)}")
        else:
            print("Stream did not complete properly, skipping save")
                
    except Exception as e:
        error_occurred = True
        error_message = str(e)
        print(f"Error in stream_text: {error_message}")
        traceback.print_exc()
        
        # Save error information if enabled
        if save_chat and clerk_id and chat_key:
            # Only save if this chat should be saved (not already saved)
            if chat_manager.should_save(chat_key):
                try:
                    # Extract title from messages
                    title = _extract_title_from_messages(final_messages)
                    
                    # Add error message to final messages
                    final_messages.append({
                        "role": "system",
                        "content": f"Error occurred: {error_message}"
                    })
                    
                    # Create metadata
                    metadata = {
                        "error": error_message,
                        "error_traceback": traceback.format_exc(),
                        "error_timestamp": datetime.now().isoformat()
                    }
                    
                    # Create a task for error save
                    error_save_task = asyncio.create_task(save_chat_history(
                        clerk_id=clerk_id,
                        title=title,
                        messages=final_messages,
                        metadata=metadata
                    ))
                    
                    def on_error_save_complete(task):
                        try:
                            saved_chat = task.result()
                            if saved_chat and saved_chat.get("id"):
                                chat_manager.mark_as_saved(chat_key)
                                print(f"Successfully saved chat with error, ID: {saved_chat.get('id')}")
                            else:
                                print("Warning: Error save operation didn't return a valid chat document")
                        except Exception as e:
                            print(f"Error processing error save result: {e}")
                            traceback.print_exc()
                            
                    error_save_task.add_done_callback(on_error_save_complete)
                    
                except Exception as save_error:
                    print(f"Error preparing chat history save with error: {save_error}")
                    traceback.print_exc()
    
    finally:
        # Cancel any pending save task if the generator is closed prematurely
        if save_task and not save_task.done():
            print("Cancelling pending save task due to premature stream close")
            save_task.cancel()
            
            # Wait a very short time for the cancellation to take effect
            try:
                await asyncio.wait_for(asyncio.shield(save_task), timeout=0.1)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                # This is expected, just ensure the task gets properly cancelled
                pass
            except Exception as wait_error:
                print(f"Unexpected error while cancelling save task: {wait_error}")
            
        # Clean up the stream
        if 'stream' in locals():
            try:
                # No explicit close needed for OpenAI API streams
                pass
            except Exception as close_error:
                print(f"Error in stream cleanup: {close_error}")


def _extract_title_from_messages(messages):
    """Extract a title from the first user message"""
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if isinstance(content, str) and content.strip():
                title = content[:30] + ("..." if len(content) > 30 else "")
                return title
    return f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}"

# Add this function to filter out initial messages before saving

def _filter_initial_messages(messages: List[Dict]) -> List[Dict]:
    """Filter out initial greeting messages that should not be saved."""
    if not messages:
        return []
        
    # Filter out messages with ID "initial"
    return [
        msg for msg in messages 
        if isinstance(msg, dict) and msg.get("id") != "initial"
    ]
