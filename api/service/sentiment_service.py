import os
from typing import List, Dict, Any
import json

from openai import AsyncOpenAI

from api.models.sentiment_model import SentimentAnalysisResponse, SentimentSegment

# Define the specific sentiments we want to check for
SENTIMENTS = [
    'admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring', 'confusion',
    'curiosity', 'desire', 'disappointment', 'disapproval', 'disgust', 'embarrassment',
    'excitement', 'fear', 'gratitude', 'grief', 'joy', 'love', 'nervousness',
    'optimism', 'pride', 'realization', 'relief', 'remorse', 'sadness', 'surprise',
    'neutral'
]

async def analyze_sentiment(messages: List[Dict[str, Any]]) -> SentimentAnalysisResponse:
    """
    Analyze the sentiment of the text content from the provided messages.
    Returns a structured SentimentAnalysisResponse.
    """
    # Initialize content_to_analyze as a string
    content_to_analyze = ""
    
    # Extract the text content to analyze
    for message in messages:
        if message["role"] == "user":
            # Handle both string content and list content
            if isinstance(message["content"], list):
                # For multimodal messages, extract text parts
                for part in message["content"]:
                    if isinstance(part, dict) and part.get("type") == "text":
                        content_to_analyze += part.get("text", "") + "\n\n"
                    elif isinstance(part, str):
                        content_to_analyze += part + "\n\n"
            elif isinstance(message["content"], str):
                content_to_analyze += message["content"] + "\n\n"
    
    # If no content was found, return empty results
    if not content_to_analyze.strip():
        return SentimentAnalysisResponse(segments=[])
    
    # Initialize OpenAI client
    client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    
    try:
        # Call OpenAI with function calling (await - asynchronous call)
        response = await client.chat.completions.create(
            model="gpt-4o",
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
                    "content": f"Analyze the sentiment in this text: {content_to_analyze}"
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
        
        # Extract the function call result
        tool_call = response.choices[0].message.tool_calls[0]
        sentiments_data = json.loads(tool_call.function.arguments)
        
        print("Sentiment analysis raw result:", sentiments_data)
                
        # Convert to Pydantic model
        segments = []
        for segment_data in sentiments_data["segments"]:
            # Validate that all sentiments are from our allowed list
            valid_sentiments = [
                sent for sent in segment_data["sentiment"] 
                if sent.lower() in [s.lower() for s in SENTIMENTS]
            ]
            
            segments.append(SentimentSegment(
                text=segment_data["text"],
                sentiment=valid_sentiments
            ))
        
        return SentimentAnalysisResponse(segments=segments)
        
    except Exception as e:
        print(f"Error during OpenAI call: {str(e)}")
        raise