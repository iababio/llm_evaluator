import asyncio
from typing import List, Dict, Any
import json
import re
from datetime import datetime

from api.models.sentiment_model import SentimentAnalysisResponse, SentimentSegment
from api.utils.config import config
from api.utils.helpers.error_handling import log_error, with_timeout
from api.utils.prompt import convert_to_openai_messages
from api.utils.constants import (
    SENTIMENTS,
    MAX_CHUNK_LENGTH,
    CHUNK_TIMEOUT,
    SENTIMENT_MODEL
)


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
        """
        Split long text into smaller chunks for analysis.
        
        Args:
            text: The text to split
            max_length: Maximum length of each chunk
            
        Returns:
            List of text chunks
        """
        # If text is short enough, no need to split
        if len(text) <= max_length:
            return [text]
        
        chunks = []
        # Try to split on paragraph boundaries first
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
        """
        Analyze the sentiment of a single text chunk.
        
        Args:
            chunk: Text chunk to analyze
            
        Returns:
            List of sentiment segments
        """
        try:
            # Make sure we're using an awaitable here - OpenAI v1 client's create is synchronous
            # so we need to convert it to a coroutine using asyncio.to_thread
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
            
            # Now apply timeout to this coroutine
            response = await asyncio.wait_for(
                completion_coro,
                timeout=self.chunk_timeout
            )
            
            if response is None:
                raise asyncio.TimeoutError(f"Timeout analyzing chunk of length {len(chunk)}")
            
            tool_call = response.choices[0].message.tool_calls[0]
            sentiments_data = json.loads(tool_call.function.arguments)
            
            # Validate and create sentiment segments
            segments = []
            for segment_data in sentiments_data["segments"]:
                valid_sentiments = [
                    sent for sent in segment_data["sentiment"] 
                    if sent.lower() in [s.lower() for s in SENTIMENTS]
                ]
                
                segments.append(SentimentSegment(
                    text=segment_data["text"],
                    sentiment=valid_sentiments or ["neutral"]  # Default to neutral if no valid sentiments
                ))
            
            return segments
            
        except asyncio.TimeoutError:
            log_error(
                asyncio.TimeoutError(f"Timeout analyzing chunk of length {len(chunk)}"),
                "sentiment_analysis"
            )
            # Return a simplified segment for this chunk
            return [SentimentSegment(
                text=chunk[:100] + "..." if len(chunk) > 100 else chunk,
                sentiment=["neutral"]
            )]
        except Exception as e:
            log_error(e, "sentiment_analysis")
            # Return a simplified segment indicating error
            return [SentimentSegment(
                text=chunk[:100] + "... (error analyzing this segment)" if len(chunk) > 100 else chunk,
                sentiment=["neutral"]
            )]

    def extract_text_from_messages(self, messages: List[Dict[str, Any]]) -> str:
        """
        Extract text content from a list of messages.
        
        Args:
            messages: List of message dictionaries
            
        Returns:
            Extracted text content
        """
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
        """
        Analyze sentiment in the provided messages.
        
        Args:
            messages: List of message dictionaries
            
        Returns:
            SentimentAnalysisResponse with sentiment segments
        """
        try:
            # Extract text content from messages
            content_to_analyze = self.extract_text_from_messages(messages)
            
            if not content_to_analyze:
                return SentimentAnalysisResponse(segments=[])
            
            # Split text into manageable chunks
            chunks = self.split_text_into_chunks(content_to_analyze, self.max_chunk_length)
            
            # Process all chunks in parallel
            tasks = [self.analyze_chunk(chunk) for chunk in chunks]
            
            # Make sure we gather properly
            chunk_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Combine all segments from all chunks, handling exceptions
            all_segments = []
            for result in chunk_results:
                if isinstance(result, Exception):
                    # Log the exception and add a placeholder segment
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
            # Return a basic response with error information
            return SentimentAnalysisResponse(
                segments=[
                    SentimentSegment(
                        text=f"Error analyzing sentiment: {str(e)}",
                        sentiment=["neutral"]
                    )
                ]
            )


# Create a singleton instance for easy access
sentiment_analyzer = SentimentAnalyzer()


async def analyze_sentiment(messages: List[Dict[str, Any]]) -> SentimentAnalysisResponse:
    """
    Top-level function to analyze sentiment in messages.
    This is the main entry point for sentiment analysis.
    
    Args:
        messages: List of message dictionaries
        
    Returns:
        SentimentAnalysisResponse with sentiment segments
    """
    try:
        # Convert client messages to OpenAI format if needed
        if messages and hasattr(messages[0], 'role') and not isinstance(messages[0], dict):
            messages = convert_to_openai_messages(messages)
        
        # Make sure we have valid messages
        if not messages:
            return SentimentAnalysisResponse(
                segments=[SentimentSegment(text="No messages to analyze", sentiment=["neutral"])]
            )
            
        return await sentiment_analyzer.analyze(messages)
        
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


async def save_sentiment_results(user_id: str, messages: List[Dict[str, Any]], 
                                results: SentimentAnalysisResponse) -> bool:
    """
    Save sentiment analysis results to the database.
    
    Args:
        user_id: User ID associated with the analysis
        messages: The analyzed messages
        results: Sentiment analysis results
        
    Returns:
        True if saved successfully, False otherwise
    """
    try:
        from api.db.index import db_sentiment
        
        record = {
            "timestamp": datetime.utcnow(),
            "user_id": user_id,
            "messages": messages,
            "results": results.model_dump()
        }
        
        await db_sentiment.insert_one(record)
        return True
        
    except Exception as e:
        log_error(e, "save_sentiment_results")
        return False