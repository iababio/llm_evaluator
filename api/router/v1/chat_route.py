from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
import asyncio
import traceback
import sys
from api.service.chat_service import stream_text
from api.service.sentiment_service import analyze_sentiment
from api.utils.prompt import convert_to_openai_messages
from api.models.chat_model import Request, CompletionRequest

router = APIRouter()

@router.post("/api/completion")
async def handle_chat_completion(request: CompletionRequest, protocol: str = Query('data'), user_id: str = Query(None)):
    print(f"Received request for chat completion: {user_id}")
    if request.prompt:
        openai_messages = [{"role": "user", "content": request.prompt}]
    elif request.messages:
        openai_messages = convert_to_openai_messages(request.messages)
    else:
        return {"detail": "Either prompt or messages must be provided"}

    response = StreamingResponse(stream_text(openai_messages, protocol, user_id))
    response.headers['x-vercel-ai-data-stream'] = 'v1'
    return response


@router.post("/api/chat")
async def handle_chat_data(request: Request, protocol: str = Query('data')):
    messages = request.messages
    openai_messages = convert_to_openai_messages(messages)

    response = StreamingResponse(stream_text(openai_messages, protocol))
    response.headers['x-vercel-ai-data-stream'] = 'v1'
    return response


@router.post("/api/sentiment")
async def handle_sentiment_analysis(request: Request):
    """
    Analyze sentiments in the provided text and return structured sentiment data.
    This endpoint returns a non-streaming JSON response.
    """
    try:
        messages = request.messages
        openai_messages = convert_to_openai_messages(messages)
        
        try:
            result = await asyncio.wait_for(
                analyze_sentiment(openai_messages),
                timeout=60.0 
            )
            return result
        except asyncio.TimeoutError:
            return JSONResponse(
                status_code=200,  
                content={
                    "segments": [
                        {
                            "text": "Analysis timed out. Your text might be too long or complex.",
                            "sentiment": ["neutral"]
                        }
                    ]
                }
            )
        
    except Exception as e:
        error_detail = {
            "error": str(e),
            "traceback": traceback.format_exception(*sys.exc_info())
        }
        print("Error in sentiment analysis:", error_detail)
        return JSONResponse(
            status_code=500,
            content={
                "segments": [
                    {
                        "text": f"Error analyzing sentiment: {str(e)}",
                        "sentiment": ["neutral"]
                    }
                ]
            }
        )