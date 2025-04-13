import os
import asyncio
from typing import List, Dict, Any, Optional
import json
import re

from openai import AsyncOpenAI

from api.models.sentiment_model import SentimentAnalysisResponse, SentimentSegment
from api.service.chat_service import stream_text

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

async def analyze_sentiment(messages: List[Dict[str, Any]], clerk_id: Optional[str] = None):
    """
    Analyze sentiment in the provided messages.
    
    Args:
        messages: List of messages to analyze
        clerk_id: Clerk user ID (if authenticated) for saving chat history
        
    Returns:
        A dictionary with sentiment analysis results
    """
    # Log clerk_id for debugging
    if clerk_id:
        print(f"Analyzing sentiment with clerk_id: {clerk_id}")
    else:
        print("Warning: Sentiment analysis requested without clerk_id")
    
    # Extract text from messages (combining user messages)
    text_to_analyze = ""
    for msg in messages:
        if isinstance(msg, dict) and msg.get('role') == 'user' and isinstance(msg.get('content'), str):
            if text_to_analyze:
                text_to_analyze += "\n\n"
            text_to_analyze += msg.get('content')
    
    # If no text found, use content directly if it's a string
    if not text_to_analyze and len(messages) > 0 and isinstance(messages[-1], dict) and isinstance(messages[-1].get('content'), str):
        text_to_analyze = messages[-1].get('content')
    
    # Check if we have text to analyze
    if not text_to_analyze:
        print("No text content found for sentiment analysis")
        return {
            "segments": [
                {
                    "text": "No analyzable text found in the provided messages.",
                    "sentiment": ["neutral"]
                }
            ]
        }
    
    # Define the system prompt
    system_prompt = """You are an expert in sentiment analysis. Analyze the following text and identify the sentiments expressed in each segment.
Follow these rules:
1. Break the text into logical segments (sentences or paragraphs)
2. For each segment, identify the sentiments from this list: positive, negative, neutral, angry, sad, happy, surprised, fearful, disgusted
3. Respond ONLY in valid JSON format as follows: 
{
  "segments": [
    {
      "text": "segment text here",
      "sentiment": ["sentiment1", "sentiment2"]
    },
    ...
  ]
}
Keep the original text intact in the output."""

    # Get sentiment analysis from LLM
    all_content = ""
    
    try:
        # Generate response, passing the clerk_id for potential history saving
        async for content in stream_text(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text_to_analyze}
            ],
            protocol="text",
            clerk_id=clerk_id  # Make sure to pass the clerk_id here
        ):
            all_content += content
    except Exception as e:
        print(f"Error streaming sentiment analysis: {e}")
        traceback.print_exc()
        return {
            "segments": [
                {
                    "text": f"Error analyzing sentiment: {str(e)}",
                    "sentiment": ["neutral"]
                }
            ]
        }
    
    # Parse the response to extract JSON
    try:
        # Find JSON in the response
        match = re.search(r'({[\s\S]*})', all_content)
        if match:
            json_str = match.group(1)
            result = json.loads(json_str)
            return result
        else:
            print(f"Could not find JSON in response: {all_content[:200]}...")
            return {
                "segments": [
                    {
                        "text": "Failed to parse sentiment analysis results.",
                        "sentiment": ["neutral"]
                    }
                ]
            }
    except Exception as e:
        print(f"Error parsing sentiment analysis results: {e}")
        print(f"Raw sentiment response: {all_content[:200]}...")
        return {
            "segments": [
                {
                    "text": "Error parsing sentiment analysis results.",
                    "sentiment": ["neutral"]
                }
            ]
        }