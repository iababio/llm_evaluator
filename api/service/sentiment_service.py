import os
import asyncio
from typing import List, Dict, Any, Optional
import json
import re

from openai import AsyncOpenAI

from api.models.sentiment_model import SentimentAnalysisResponse, SentimentSegment

SENTIMENTS = [
    'admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring', 'confusion',
    'curiosity', 'desire', 'disappointment', 'disapproval', 'disgust', 'embarrassment',
    'excitement', 'fear', 'gratitude', 'grief', 'joy', 'love', 'nervousness',
    'optimism', 'pride', 'realization', 'relief', 'remorse', 'sadness', 'surprise',
    'neutral'
]

# Maximum tokens to analyze in one go to prevent timeouts
MAX_CHUNK_LENGTH = 4000

def split_text_into_chunks(text: str, max_length: int = MAX_CHUNK_LENGTH) -> List[str]:
    """Split long text into chunks to avoid timeout issues."""
    # If text is short enough, no need to split
    if len(text) <= max_length:
        return [text]
    
    chunks = []
    # Try to split on paragraph boundaries first
    paragraphs = re.split(r'\n\s*\n', text)
    
    current_chunk = ""
    for paragraph in paragraphs:
        # If adding this paragraph would exceed max length
        if len(current_chunk) + len(paragraph) > max_length and current_chunk:
            chunks.append(current_chunk)
            current_chunk = paragraph
        else:
            if current_chunk:
                current_chunk += "\n\n" + paragraph
            else:
                current_chunk = paragraph
    
    # Add the last chunk if it's not empty
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks

async def analyze_chunk(client: AsyncOpenAI, chunk: str) -> List[SentimentSegment]:
    """Analyze a single chunk of text."""
    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model="gpt-3.5-turbo", # Using a faster model than gpt-4o for speed
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
            ),
            timeout=25.0  # 25 second timeout
        )
        
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
                sentiment=valid_sentiments
            ))
        
        return segments
        
    except asyncio.TimeoutError:
        print(f"Timeout occurred while analyzing chunk of length {len(chunk)}")
        # Return a simplified segment for this chunk
        return [SentimentSegment(
            text=chunk[:100] + "..." if len(chunk) > 100 else chunk,
            sentiment=["neutral"]
        )]
    except Exception as e:
        print(f"Error during sentiment analysis: {str(e)}")
        # Return a simplified segment indicating error
        return [SentimentSegment(
            text=chunk[:100] + "... (error analyzing this segment)" if len(chunk) > 100 else chunk,
            sentiment=["neutral"]
        )]

async def analyze_sentiment(messages: List[Dict[str, Any]]) -> SentimentAnalysisResponse:
    """
    Analyze the sentiment of the text content from the provided messages.
    Returns a structured SentimentAnalysisResponse.
    
    For long texts, splits into chunks and processes in parallel
    to avoid timeouts.
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
    
    if not content_to_analyze.strip():
        return SentimentAnalysisResponse(segments=[])
    
    client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    
    # Split text into manageable chunks
    chunks = split_text_into_chunks(content_to_analyze)
    print(f"Split text into {len(chunks)} chunks for analysis")
    
    # Process all chunks in parallel
    tasks = [analyze_chunk(client, chunk) for chunk in chunks]
    chunk_results = await asyncio.gather(*tasks)
    
    # Combine all segments from all chunks
    all_segments = []
    for segment_list in chunk_results:
        all_segments.extend(segment_list)
    
    return SentimentAnalysisResponse(segments=all_segments)