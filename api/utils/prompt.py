import json
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
from .types import ClientAttachment, ToolInvocation

ClientMessage = Union[Dict[str, Any], Dict[str, str]]

def convert_to_openai_messages(messages: List[ClientMessage]) -> List[Dict[str, Any]]:
    """
    Convert client messages to OpenAI messages format.
    Ensures we never return an empty array.
    """
    if not messages:
        # Default message if none provided
        return [{"role": "system", "content": "You are a helpful assistant."}]
    
    result = []
    
    for message in messages:
        # Skip messages without a role
        if "role" not in message:
            continue
            
        # Skip messages without content (or with empty content)
        content = message.get("content")
        if content is None or (isinstance(content, str) and not content.strip()):
            continue
            
        openai_message = {"role": message["role"], "content": content}
        
        # Add optional fields if present
        for field in ["name", "function_call", "tool_call_id", "tool_calls"]:
            if field in message:
                openai_message[field] = message[field]
                
        result.append(openai_message)
    
    # Ensure we have at least one message
    if not result:
        return [{"role": "system", "content": "You are a helpful assistant."}]
        
    return result
