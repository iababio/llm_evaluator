from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
import traceback
import sys
from api.service.chat_service import stream_text
from api.service.sentiment_service import analyze_sentiment
from api.utils.prompt import convert_to_openai_messages
from api.models.chat_model import Request, CompletionRequest
import httpx

app = FastAPI()

@app.post("/api/completion")
async def handle_chat_completion(request: CompletionRequest, protocol: str = Query('data')):
    # Handle both prompt-based and message-based requests
    if request.prompt:
        # Convert prompt to messages format
        openai_messages = [{"role": "user", "content": request.prompt}]
    elif request.messages:
        openai_messages = convert_to_openai_messages(request.messages)
    else:
        return {"detail": "Either prompt or messages must be provided"}

    response = StreamingResponse(stream_text(openai_messages, protocol))
    response.headers['x-vercel-ai-data-stream'] = 'v1'
    return response


@app.post("/api/chat")
async def handle_chat_data(request: Request, protocol: str = Query('data')):
    messages = request.messages
    openai_messages = convert_to_openai_messages(messages)

    response = StreamingResponse(stream_text(openai_messages, protocol))
    response.headers['x-vercel-ai-data-stream'] = 'v1'
    return response


@app.post("/api/sentiment")
async def handle_sentiment_analysis(request: Request):
    """
    Analyze sentiments in the provided text and return structured sentiment data.
    This endpoint returns a non-streaming JSON response.
    """
    try:
        messages = request.messages
        openai_messages = convert_to_openai_messages(messages)
                
        result = await analyze_sentiment(openai_messages)
        
        # Return as JSON response
        return result
        
    except Exception as e:
        error_detail = {
            "error": str(e),
            "traceback": traceback.format_exception(*sys.exc_info())
        }
        print("Error in sentiment analysis:", error_detail)
        raise HTTPException(status_code=500, detail=str(e))