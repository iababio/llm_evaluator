import json
import asyncio
import time
import concurrent.futures
import threading
import re
from typing import List, Dict, Any, Generator, Optional, AsyncGenerator
from datetime import datetime

from api.models.sentiment_model import SentimentAnalysisResponse, SentimentSegment
from api.utils.config import config
from api.utils.helpers.error_handling import log_error, run_async, ExternalServiceError
from api.utils.prompt import convert_to_openai_messages, ClientMessage
from api.utils.constants import (
    SENTIMENTS,
    MAX_CHUNK_LENGTH,
    CHUNK_TIMEOUT,
    SENTIMENT_MODEL
)
from api.utils.tools import (
    TOOL_DEFINITIONS, 
    format_usage_data, 
    process_tool_calls
)
from api.db.index import db_history, db_sentiment

client = config.openai_client
DEFAULT_MODEL = config.openai_model


class SentimentAnalyzer:
    """
    A class to handle sentiment analysis of text content.
    Breaks down long text into analyzable chunks and processes them in parallel.
    """

    def __init__(self):
        """Initialize the sentiment analyzer with OpenAI client from config."""
        self.client = config.openai_client
        self.max_chunk_length = MAX_CHUNK_LENGTH
        self.chunk_timeout = CHUNK_TIMEOUT
        self.model = SENTIMENT_MODEL

    @staticmethod
    def split_text_into_chunks(text: str, max_length: int = MAX_CHUNK_LENGTH) -> List[str]:
        """Split long text into smaller chunks for analysis."""
        # Implementation remains unchanged...
        if len(text) <= max_length:
            return [text]
        
        chunks = []
        paragraphs = re.split(r'\n\s*\n', text)
        
        current_chunk = ""
        for paragraph in paragraphs:
            if len(current_chunk) + len(paragraph) > max_length and current_chunk:
                chunks.append(current_chunk)
                current_chunk = paragraph
            else:
                if current_chunk:
                    current_chunk += "\n\n" + paragraph
                else:
                    current_chunk = paragraph
        
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks

    async def analyze_chunk(self, chunk: str) -> List[SentimentSegment]:
        """Analyze the sentiment of a single text chunk."""
        # Implementation remains unchanged...
        try:
            completion_coro = asyncio.to_thread(
                self.client.chat.completions.create,
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": f"""You are a sentiment analysis assistant specialized in detecting emotions in text.
                        Break the user text into logical segments and analyze the sentiment of each segment.
                        For each segment, identify all applicable sentiments from this specific list:
                        {', '.join(SENTIMENTS)}
                        
                        Return the results in a structured format using the analyze_sentiment function.
                        Make sure to only use sentiments from the provided list."""
                    },
                    {
                        "role": "user",
                        "content": f"Analyze the sentiment in this text: {chunk}"
                    }
                ],
                tools=[{
                    "type": "function",
                    "function": {
                        "name": "analyze_sentiment",
                        "description": "Analyze the sentiment of segments in the provided text",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "segments": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "text": {
                                                "type": "string",
                                                "description": "A segment of text from the original input"
                                            },
                                            "sentiment": {
                                                "type": "array",
                                                "items": {
                                                    "type": "string",
                                                    "enum": SENTIMENTS
                                                },
                                                "description": "The sentiments detected in this text segment (must be from the provided list)"
                                            }
                                        },
                                        "required": ["text", "sentiment"]
                                    }
                                }
                            },
                            "required": ["segments"]
                        }
                    }
                }],
                tool_choice={"type": "function", "function": {"name": "analyze_sentiment"}}
            )
            
            response = await asyncio.wait_for(
                completion_coro,
                timeout=self.chunk_timeout
            )
            
            if response is None:
                raise asyncio.TimeoutError(f"Timeout analyzing chunk of length {len(chunk)}")
            
            tool_call = response.choices[0].message.tool_calls[0]
            sentiments_data = json.loads(tool_call.function.arguments)
            
            segments = []
            for segment_data in sentiments_data["segments"]:
                valid_sentiments = [
                    sent for sent in segment_data["sentiment"] 
                    if sent.lower() in [s.lower() for s in SENTIMENTS]
                ]
                
                segments.append(SentimentSegment(
                    text=segment_data["text"],
                    sentiment=valid_sentiments or ["neutral"]
                ))
            
            return segments
            
        except asyncio.TimeoutError:
            log_error(
                asyncio.TimeoutError(f"Timeout analyzing chunk of length {len(chunk)}"),
                "sentiment_analysis"
            )
            return [SentimentSegment(
                text=chunk[:100] + "..." if len(chunk) > 100 else chunk,
                sentiment=["neutral"]
            )]
        except Exception as e:
            log_error(e, "sentiment_analysis")
            return [SentimentSegment(
                text=chunk[:100] + "... (error analyzing this segment)" if len(chunk) > 100 else chunk,
                sentiment=["neutral"]
            )]

    def extract_text_from_messages(self, messages: List[Dict[str, Any]]) -> str:
        """Extract text content from a list of messages."""
        content_to_analyze = ""
        
        for message in messages:
            if message["role"] == "user":
                if isinstance(message["content"], list):
                    for part in message["content"]:
                        if isinstance(part, dict) and part.get("type") == "text":
                            content_to_analyze += part.get("text", "") + "\n\n"
                        elif isinstance(part, str):
                            content_to_analyze += part + "\n\n"
                elif isinstance(message["content"], str):
                    content_to_analyze += message["content"] + "\n\n"
        
        return content_to_analyze.strip()

    async def analyze(self, messages: List[Dict[str, Any]]) -> SentimentAnalysisResponse:
        """Analyze sentiment in the provided messages."""
        try:
            content_to_analyze = self.extract_text_from_messages(messages)
            
            if not content_to_analyze:
                return SentimentAnalysisResponse(segments=[])
            
            chunks = self.split_text_into_chunks(content_to_analyze, self.max_chunk_length)
            tasks = [self.analyze_chunk(chunk) for chunk in chunks]
            chunk_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            all_segments = []
            for result in chunk_results:
                if isinstance(result, Exception):
                    log_error(result, "process_chunk_result")
                    all_segments.append(SentimentSegment(
                        text="Error processing chunk",
                        sentiment=["neutral"]
                    ))
                else:
                    all_segments.extend(result)
            
            return SentimentAnalysisResponse(segments=all_segments)
            
        except Exception as e:
            log_error(e, "sentiment_analysis")
            return SentimentAnalysisResponse(
                segments=[
                    SentimentSegment(
                        text=f"Error analyzing sentiment: {str(e)}",
                        sentiment=["neutral"]
                    )
                ]
            )


# Create a unified service class that handles both chat and sentiment analysis
class UnifiedService:
    def __init__(self):
        self.client = config.openai_client
        self.sentiment_analyzer = SentimentAnalyzer()
    
    async def save_data(self, collection_name: str, data: Dict[str, Any]) -> bool:
        """
        Generic method to save data to the specified collection.
        
        Args:
            collection_name: Name of the collection ("history" or "sentiment")
            data: Data to save
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            collection = db_history if collection_name == "history" else db_sentiment
            await collection.insert_one(data)
            return True
        except Exception as e:
            log_error(e, f"save_data_{collection_name}")
            return False
    
    async def save_chat_history(self, messages: List[ClientMessage], response: str, 
                               tool_calls: List[Dict[str, Any]] = None, user_id: str = None) -> bool:
        """Save chat history to the database."""
        try:
            message_dicts = []
            for msg in messages:
                if hasattr(msg, 'model_dump'):
                    message_dicts.append(msg.model_dump())
                elif isinstance(msg, dict):
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
            
            return await self.save_data("history", chat_record)
        except Exception as e:
            log_error(e, "save_chat_history")
            return False
    
    async def save_sentiment_results(self, user_id: str, messages: List[Dict[str, Any]], 
                                   results: SentimentAnalysisResponse) -> bool:
        """Save sentiment analysis results to the database."""
        try:
            record = {
                "timestamp": datetime.utcnow(),
                "user_id": user_id,
                "messages": messages,
                "results": results.model_dump()
            }
            
            return await self.save_data("sentiment", record)
        except Exception as e:
            log_error(e, "save_sentiment_results")
            return False
    
    def create_openai_stream(self, messages: List[ClientMessage], model: str = None):
        """Create a streaming completion from OpenAI."""
        try:
            model = model or config.openai_model
            tools = TOOL_DEFINITIONS if config.enable_tool_calls else None
            
            return self.client.chat.completions.create(
                messages=messages,
                model=model,
                stream=True,
                tools=tools
            )
        except Exception as e:
            raise ExternalServiceError("OpenAI", str(e))
    
    def stream_text(self, messages: List[ClientMessage], protocol: str = 'data', user_id: str = None) -> Generator[str, None, None]:
        """Stream text responses from the AI model."""
        try:
            stream = self.create_openai_stream(messages)
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
                    target=lambda: run_async(self.save_chat_history(messages, complete_response, None, user_id)),
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
                            target=lambda: run_async(self.save_chat_history(messages, complete_response, all_tool_calls, user_id)),
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
    
    async def stream_text_with_timeout(self, messages: List[ClientMessage], protocol: str = 'data', user_id: str = None):
        """
        Stream text responses with timeout handling.
        
        This is an async generator function that yields strings.
        
        Args:
            messages: The messages to send to the model
            protocol: The protocol to use ('text' or 'data')
            user_id: Optional user ID
            
        Yields:
            String chunks from the AI response
        """
        try:
            timeout = config.stream_timeout
            
            # Use concurrent.futures to run the synchronous generator in a separate thread pool
            with concurrent.futures.ThreadPoolExecutor() as pool:
                # Get the generator from stream_text
                gen = self.stream_text(messages, protocol, user_id)
                
                # Start a timer for timeout
                start_time = time.time()
                
                # Process items from the generator with timeout
                for item in gen:
                    # Check if we've exceeded the timeout
                    if time.time() - start_time > timeout:
                        raise asyncio.TimeoutError(f"Request timed out after {timeout} seconds")
                    
                    # Yield each item with a small pause to allow other async operations
                    yield item
                    await asyncio.sleep(0)
                
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
    
    async def analyze_sentiment(self, messages: List[Dict[str, Any]], user_id: str = None) -> SentimentAnalysisResponse:
        """Analyze sentiment in messages."""
        try:
            # Convert client messages to OpenAI format if needed
            if messages and hasattr(messages[0], 'role') and not isinstance(messages[0], dict):
                messages = convert_to_openai_messages(messages)
            
            # Make sure we have valid messages
            if not messages:
                return SentimentAnalysisResponse(
                    segments=[SentimentSegment(text="No messages to analyze", sentiment=["neutral"])]
                )
                
            results = await self.sentiment_analyzer.analyze(messages)
            
            # Save results if user_id is provided
            if user_id:
                await self.save_sentiment_results(user_id, messages, results)
                
            return results
            
        except Exception as e:
            log_error(e, "analyze_sentiment")
            return SentimentAnalysisResponse(
                segments=[
                    SentimentSegment(
                        text=f"Error analyzing sentiment: {str(e)}",
                        sentiment=["neutral"]
                    )
                ]
            )


# Create a singleton instance for easy access
unified_service = UnifiedService()


# Export unified API functions
async def process_chat_request(messages: List[ClientMessage], protocol: str = 'data', user_id: str = None) -> AsyncGenerator[str, None]:
    """
    Unified chat function that handles both streaming protocols.
    
    Returns an async generator that yields response chunks.
    
    Args:
        messages: The messages to send to the model
        protocol: The protocol to use ('text' or 'data')
        user_id: Optional user ID
        
    Returns:
        An async generator yielding response chunks
    """
    # Don't await the async generator - instead, return it directly
    # This allows FastAPI to stream the responses as they're generated
    return unified_service.stream_text_with_timeout(messages, protocol, user_id)


async def process_sentiment_request(messages: List[Dict[str, Any]], user_id: str = None) -> SentimentAnalysisResponse:
    """Unified sentiment analysis function."""
    return await unified_service.analyze_sentiment(messages, user_id)