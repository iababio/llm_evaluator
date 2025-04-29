import random
import json
from typing import Dict, Any, List, Optional
from api.utils.helpers.error_handling import log_error


# Tool implementations
def get_current_weather(location, unit="fahrenheit"):
    """
    Get the current weather for a location.
    
    Args:
        location: The location to get weather for
        unit: Temperature unit ('celsius' or 'fahrenheit')
        
    Returns:
        Dict with weather information
    """
    if unit == "celsius":
        temperature = random.randint(-34, 43)
    else:
        temperature = random.randint(-30, 110)

    return {
        "temperature": temperature,
        "unit": unit,
        "location": location,
    }


# Available tools mapping
AVAILABLE_TOOLS = {
    "get_current_weather": get_current_weather,
}


# Tool definitions for OpenAI API
TOOL_DEFINITIONS = [
    {
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
                        "enum": ["celsius", "fahrenheit"]
                    },
                },
                "required": ["location", "unit"],
            },
        },
    }
]


def execute_tool(tool_call: Dict[str, Any]) -> Any:
    """
    Execute a tool call and return the result.
    
    Args:
        tool_call: Tool call information with name and arguments
        
    Returns:
        The result of executing the tool
        
    Raises:
        ValueError: If the tool doesn't exist
        Exception: If there's an error executing the tool
    """
    tool_name = tool_call["name"]
    if tool_name not in AVAILABLE_TOOLS:
        raise ValueError(f"Unknown tool: {tool_name}")
    
    try:
        return AVAILABLE_TOOLS[tool_name](**json.loads(tool_call["arguments"]))
    except Exception as e:
        log_error(e, f"tool_execution:{tool_name}")
        return {"error": str(e)}


# Data formatting utilities for tool calls
def format_tool_call(tool_call: Dict[str, Any]) -> str:
    """
    Format a tool call for the data protocol.
    
    Args:
        tool_call: Tool call information
        
    Returns:
        Formatted string for data protocol
    """
    return '9:{{"toolCallId":"{id}","toolName":"{name}","args":{args}}}\n'.format(
        id=tool_call["id"],
        name=tool_call["name"],
        args=tool_call["arguments"]
    )


def format_tool_result(tool_call: Dict[str, Any], result: Any) -> str:
    """
    Format a tool result for the data protocol.
    
    Args:
        tool_call: Tool call information
        result: Result from the tool execution
        
    Returns:
        Formatted string for data protocol
    """
    return 'a:{{"toolCallId":"{id}","toolName":"{name}","args":{args},"result":{result}}}\n'.format(
        id=tool_call["id"],
        name=tool_call["name"],
        args=tool_call["arguments"],
        result=json.dumps(result)
    )


def format_usage_data(finish_reason: str, prompt_tokens: int, completion_tokens: int) -> str:
    """
    Format usage data for the data protocol.
    
    Args:
        finish_reason: Reason for stream completion
        prompt_tokens: Number of prompt tokens used
        completion_tokens: Number of completion tokens used
        
    Returns:
        Formatted string for data protocol
    """
    return 'd:{{"finishReason":"{reason}","usage":{{"promptTokens":{prompt},"completionTokens":{completion}}}}}\n'.format(
        reason=finish_reason,
        prompt=prompt_tokens,
        completion=completion_tokens
    )


def process_tool_calls(draft_tool_calls: List[Dict[str, Any]]) -> tuple:
    """
    Process a list of tool calls, execute them, and format the results.
    
    Args:
        draft_tool_calls: List of tool calls to process
        
    Returns:
        Tuple containing (formatted_calls, formatted_results, all_tool_calls)
    """
    formatted_calls = []
    formatted_results = []
    all_tool_calls = []
    
    for tool_call in draft_tool_calls:
        # Format and store the tool call
        formatted_calls.append(format_tool_call(tool_call))
        all_tool_calls.append(tool_call.copy())
        
        # Execute the tool and format the result
        tool_result = execute_tool(tool_call)
        tool_call["result"] = tool_result
        formatted_results.append(format_tool_result(tool_call, tool_result))
    
    return formatted_calls, formatted_results, all_tool_calls