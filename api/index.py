# Update the import section to include chat_history_service
import base64
from datetime import datetime, timedelta
import json
import os
import re
from api.service.chat_history_service import ensure_chat_history_index, get_user_chat_histories, get_chat_history, delete_chat_history, is_valid_object_id, save_chat_history, update_chat_history, chat_history_collection
import asyncio
from fastapi import FastAPI, Query, HTTPException, Request as FastAPIRequest, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
import traceback
import sys
from api.db.index import create_collections
from api.service.chat_service import stream_text
from api.service.sentiment_service import analyze_sentiment
from api.utils.prompt import convert_to_openai_messages
from api.models.chat_model import Request, CompletionRequest
import httpx

from api.service.user_service import create_or_update_user, ensure_users_index
from pydantic import BaseModel, Field
from fastapi import Depends, Header
from typing import Optional, List, Dict, Any

class ClerkUserData(BaseModel):
    clerk_id: str
    email: Optional[str] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    # Add any other fields that might be in Clerk user data

from api.middleware.user_middleware import enrich_request_with_user
from fastapi.middleware.cors import CORSMiddleware
from api.middleware.user_middleware import user_middleware, state_initialization_middleware
from starlette.middleware.base import BaseHTTPMiddleware

# Add this near your other imports
from api.routes.debug import router as debug_router

# Add the new router
from api.routes.auth import router as auth_router

# Create FastAPI app
app = FastAPI()

# Add middleware for CORS first
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add state initialization middleware before user_middleware
app.add_middleware(BaseHTTPMiddleware, dispatch=state_initialization_middleware)

# Add user authentication middleware
app.add_middleware(BaseHTTPMiddleware, dispatch=user_middleware)

# Add a simple caching mechanism
from functools import lru_cache
from datetime import datetime, timedelta

# Cache for chat history (keyed by user ID)
chat_history_cache = {}
chat_history_cache_times = {}
CACHE_TTL = 30  # seconds

@app.on_event("startup")
async def startup_event():
    await create_collections()
    await ensure_users_index()
    await ensure_chat_history_index()
    # You can add other startup tasks here

@app.post("/api/completion")
async def handle_chat_completion(request: CompletionRequest, protocol: str = Query('data'), request_obj: FastAPIRequest = None):
    # Extract clerk_id from user - fixed the attribute access
    clerk_id = None
    if hasattr(request_obj, "state") and hasattr(request_obj.state, "user"):
        clerk_id = request_obj.state.user.clerk_id
    
    print(f"Completion request with clerk_id: {clerk_id}")
    
    if request.prompt:
        openai_messages = [{"role": "user", "content": request.prompt}]
    elif request.messages:
        openai_messages = convert_to_openai_messages(request.messages)
    else:
        return {"detail": "Either prompt or messages must be provided"}

    response = StreamingResponse(stream_text(openai_messages, protocol, clerk_id))
    response.headers['x-vercel-ai-data-stream'] = 'v1'
    return response


@app.post("/api/chat")
async def handle_chat_data(request_obj: FastAPIRequest, protocol: str = Query('data')):
    """Handle chat completion requests"""
    # Extract clerk_id from user
    clerk_id = None
    if hasattr(request_obj, "state") and hasattr(request_obj.state, "user"):
        clerk_id = request_obj.state.user.clerk_id
    
    print(f"Chat request with clerk_id: {clerk_id}")
    
    # Extract messages from request body
    try:
        # Parse request body
        body_bytes = await request_obj.body()
        body = json.loads(body_bytes)
        messages = body.get("messages", [])
        
        print(f"Received messages: {len(messages)} items")
        
        # Validate that we have messages
        if not messages:
            return JSONResponse(
                status_code=400,
                content={"error": "No messages provided in request body"}
            )
        
        # Convert to OpenAI format
        openai_messages = convert_to_openai_messages(messages)
        
        # Ensure we have at least one message after conversion
        if not openai_messages:
            return JSONResponse(
                status_code=400,
                content={"error": "No valid messages after conversion"}
            )
            
        print(f"Converted to {len(openai_messages)} OpenAI messages")
        
        # Create streaming response
        response = StreamingResponse(stream_text(openai_messages, protocol, clerk_id))
        response.headers['x-vercel-ai-data-stream'] = 'v1'
        return response
        
    except json.JSONDecodeError:
        print("Error: Invalid JSON in request body")
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid JSON in request body"}
        )
    except Exception as e:
        print(f"Error processing chat request: {str(e)}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Server error: {str(e)}"}
        )


@app.post("/api/sentiment")
async def handle_sentiment_analysis(request: Request):
    """
    Analyze sentiments in the provided text and return structured sentiment data.
    This endpoint returns a non-streaming JSON response.
    """
    try:
        messages = request.messages
        openai_messages = convert_to_openai_messages(messages)
        
        # Set a timeout for the entire operation
        try:
            result = await asyncio.wait_for(
                analyze_sentiment(openai_messages),
                timeout=60.0  # 60 second total timeout
            )
            return result
        except asyncio.TimeoutError:
            # If timeout occurs, return a simplified response
            return JSONResponse(
                status_code=200,  # Return 200 to avoid client retries
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
        # Return a proper error response rather than throwing an exception
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

@app.post("/api/users/sync")
async def sync_user(user: ClerkUserData, authorization: Optional[str] = Header(None)):
    """
    Sync a Clerk user to our MongoDB database.
    This is called after successful authentication.
    """
    # In a production app, you would validate the authorization token here
    # For now, we'll assume it's coming from a trusted source
    
    try:
        # Create or update the user
        result = await create_or_update_user(user.model_dump())
        return {"success": True, "user_id": result.clerk_id}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

@app.get("/api/chat-history")
async def get_user_chat_histories(request_obj: FastAPIRequest):
    """Get chat history for the authenticated user with caching"""
    try:
        # Ensure request.state exists
        if not hasattr(request_obj, "state"):
            print("Request has no state attribute")
            return JSONResponse(
                status_code=401,
                content={"error": "Authentication required - No state"}
            )
            
        # Check if user exists in state
        if not hasattr(request_obj.state, "user") or request_obj.state.user is None:
            print("Request has no user in state")
            return JSONResponse(
                status_code=401,
                content={"error": "Authentication required - No user"}
            )
        
        clerk_id = request_obj.state.user.clerk_id
        print(f"Getting chat histories for clerk_id: {clerk_id}")
        
        # Check if we have a fresh cache
        now = datetime.now()
        if clerk_id in chat_history_cache and clerk_id in chat_history_cache_times:
            cache_age = (now - chat_history_cache_times[clerk_id]).total_seconds()
            if cache_age < CACHE_TTL:
                print(f"Returning cached chat history for {clerk_id} (age: {cache_age:.2f}s)")
                return chat_history_cache[clerk_id]
        
        # Get fresh chat histories
        chat_histories = await get_user_chat_histories(clerk_id)
        
        # Update cache
        chat_history_cache[clerk_id] = chat_histories if chat_histories else []
        chat_history_cache_times[clerk_id] = now
        
        return chat_history_cache[clerk_id]
    except Exception as e:
        print(f"Error fetching chat histories: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return empty list instead of error to avoid breaking the UI
        return []

@app.get("/api/chat-history/{chat_id}")
async def get_chat_detail(chat_id: str, request_obj: FastAPIRequest):
    """Get a specific chat history by ID"""
    # Check authentication
    if not hasattr(request_obj, "state") or not hasattr(request_obj.state, "user"):
        return JSONResponse(
            status_code=401,
            content={"error": "Authentication required"}
        )
    
    clerk_id = request_obj.state.user.clerk_id
    
    try:
        # Validate MongoDB ObjectID format
        if not is_valid_object_id(chat_id):
            return JSONResponse(
                status_code=400,
                content={"error": f"Invalid chat ID format: {chat_id}"}
            )
            
        chat = await get_chat_history(chat_id, clerk_id)
        
        if not chat:
            return JSONResponse(
                status_code=404,
                content={"error": f"Chat not found with ID: {chat_id}"}
            )
            
        return chat
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Server error: {str(e)}"}
        )


@app.delete("/api/chat-history/{chat_id}")
async def delete_chat(chat_id: str, request_obj: FastAPIRequest):
    """Delete a specific chat by ID"""
    # Only proceed if user is authenticated
    if not hasattr(request_obj, "state") or not hasattr(request_obj.state, "user"):
        return JSONResponse(
            status_code=401,
            content={"error": "Authentication required"}
        )
    
    clerk_id = request_obj.state.user.clerk_id
    
    try:
        # First verify ownership
        chat = await get_chat_history(chat_id)
        
        if not chat:
            return JSONResponse(
                status_code=404,
                content={"error": "Chat not found"}
            )
            
        # Ensure user owns this chat
        if chat.clerk_id != clerk_id:
            return JSONResponse(
                status_code=403,
                content={"error": "Access denied"}
            )
        
        # Delete the chat
        success = await delete_chat_history(chat_id)
        
        if success:
            return {"success": True}
        else:
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to delete chat"}
            )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Error: {str(e)}"}
        )

# Add this debug endpoint
@app.get("/api/auth-debug")
async def debug_auth(request_obj: FastAPIRequest):
    """Debug endpoint for auth issues"""
    auth_header = request_obj.headers.get("Authorization")
    
    result = {
        "has_auth_header": auth_header is not None,
        "has_state": hasattr(request_obj, "state"),
        "has_user": hasattr(request_obj.state) and hasattr(request_obj.state, "user"),
    }
    
    if auth_header:
        match = re.match(r'^Bearer\s+(.+)$', auth_header)
        if match:
            token = match.group(1)
            # Try to decode it
            try:
                parts = token.split('.')
                if len(parts) == 3:
                    # Decode payload
                    payload = parts[1]
                    # Add padding if needed
                    padding = len(payload) % 4
                    if padding:
                        payload += '=' * (4 - padding)
                    
                    decoded = json.loads(base64.urlsafe_b64decode(payload))
                    result["token_payload"] = {
                        k: v for k, v in decoded.items() 
                        if k in ["sub", "exp", "iat", "azp", "user_id", "id"]
                    }
            except Exception as e:
                result["token_decode_error"] = str(e)
    
    if hasattr(request_obj, "state") and hasattr(request_obj.state, "user"):
        user = request_obj.state.user
        result["clerk_id"] = user.clerk_id
    
    return result

# Add this endpoint for manually saving chats

class SaveChatRequest(BaseModel):
    messages: List[Dict[str, Any]]
    title: Optional[str] = None
    session_id: Optional[str] = None  # Add session_id field

@app.post("/api/chat-history/save")
async def save_chat_manual(request_data: SaveChatRequest, request_obj: FastAPIRequest):
    """Manually save a chat history"""
    # Check authentication
    if not hasattr(request_obj, "state") or not hasattr(request_obj.state, "user"):
        print("Auth missing for /api/chat-history/save")
        return JSONResponse(
            status_code=401,
            content={"error": "Authentication required"}
        )
    
    clerk_id = request_obj.state.user.clerk_id
    print(f"Manual save request from clerk_id: {clerk_id}")
    
    try:
        # Check for empty messages
        if not request_data.messages:
            return JSONResponse(
                status_code=400,
                content={"error": "No messages provided"}
            )
        
        # Determine if we should update an existing chat or create a new one
        existing_id = None
        if request_data.session_id:
            # Look for an existing chat with this session_id in metadata
            existing_chats = await chat_history_collection.find({
                "clerk_id": clerk_id,
                "metadata.client_session_id": request_data.session_id
            }).to_list(1)
            
            if existing_chats:
                existing_id = str(existing_chats[0]["_id"])
                print(f"Found existing chat with ID {existing_id} for session {request_data.session_id}")
            
        # Create metadata
        metadata = {}
        if request_data.session_id:
            metadata["client_session_id"] = request_data.session_id
        
        # Either update or create a new chat
        if existing_id:
            # Update existing chat
            chat_id = await update_chat_history(
                chat_id=existing_id,
                clerk_id=clerk_id,
                messages=request_data.messages,
                title=request_data.title,
                metadata=metadata
            )
            is_new = False
        else:
            # Create new chat
            chat_id = await save_chat_history(
                clerk_id=clerk_id,
                messages=request_data.messages,
                title=request_data.title,
                metadata=metadata
            )
            is_new = True
            
        if chat_id:
            # Clear the chat history cache for this user
            if clerk_id in chat_history_cache:
                del chat_history_cache[clerk_id]
                
            return {"id": chat_id, "success": True, "is_new": is_new}
        else:
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to save chat"}
            )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Server error: {str(e)}"}
        )

# Add this debug endpoint

@app.get("/api/debug/chat-manager")
async def debug_chat_manager(request_obj: FastAPIRequest):
    """Debug endpoint to check chat manager state"""
    from api.service.chat_service import chat_manager
    
    # Only allow admins or in development
    if not (os.environ.get("APP_ENV") == "development" or 
            (hasattr(request_obj, "state") and 
             hasattr(request_obj.state, "user") and 
             request_obj.state.user.clerk_id in ["admin_id_here"])):
        return JSONResponse(
            status_code=403,
            content={"error": "Access denied"}
        )
    
    # Return debug info
    return {
        "active_chats": chat_manager.debug_active_chats(),
        "environment": os.environ.get("APP_ENV", "unknown")
    }

@app.post("/api/debug/echo")
async def debug_echo(request_obj: FastAPIRequest):
    """Echo back the request body and headers for debugging"""
    try:
        body = await request_obj.body()
        
        # Try to parse as JSON
        try:
            json_body = json.loads(body)
            body_content = json_body
        except:
            # If not valid JSON, return as string
            body_content = body.decode('utf-8', errors='replace')
        
        # Get headers (excluding sensitive ones)
        headers = {}
        for key, value in request_obj.headers.items():
            if key.lower() not in ['authorization', 'cookie']:
                headers[key] = value
            else:
                headers[key] = "[REDACTED]"
        
        # Get query params
        query_params = dict(request_obj.query_params)
        
        # Auth status
        auth_status = {
            "has_state": hasattr(request_obj, "state"),
            "has_user": hasattr(request_obj.state) and hasattr(request_obj.state, "user"),
            "clerk_id": getattr(request_obj.state.user, "clerk_id", None) 
                       if (hasattr(request_obj, "state") and hasattr(request_obj.state, "user")) 
                       else None
        }
        
        return {
            "method": request_obj.method,
            "url": str(request_obj.url),
            "headers": headers,
            "query_params": query_params,
            "body": body_content,
            "auth_status": auth_status
        }
    except Exception as e:
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@app.get("/api/debug/auth")
async def debug_auth(request_obj: FastAPIRequest):
    """Debug endpoint to check authentication state"""
    try:
        auth_header = request_obj.headers.get("Authorization", None)
        user_state = hasattr(request_obj, "state") and hasattr(request_obj.state, "user")
        clerk_id = getattr(request_obj.state.user, "clerk_id", None) if user_state else None
        
        return {
            "has_auth_header": auth_header is not None,
            "auth_header_prefix": auth_header[:10] + "..." if auth_header else None,
            "has_state": hasattr(request_obj, "state"),
            "has_user_state": user_state,
            "clerk_id": clerk_id,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Add this after creating the app
app.include_router(debug_router)

# Include the router
app.include_router(auth_router)

# Add the chat save endpoint

@app.post("/api/chat-history/save")
async def save_chat(request: FastAPIRequest):
    """Save a chat history"""
    try:
        # Ensure state is initialized
        if not hasattr(request, "state"):
            print("Request has no state attribute for /api/chat-history/save")
            return JSONResponse(
                status_code=401,
                content={"error": "Authentication required - No state"}
            )
        
        # Ensure user is authenticated
        if not hasattr(request.state, "user") or request.state.user is None:
            print("Request has no user in state for /api/chat-history/save")
            return JSONResponse(
                status_code=401,
                content={"error": "Authentication required - No user"}
            )
        
        # Get the request body
        body = await request.json()
        
        # Validate the request body
        if not isinstance(body, dict):
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid request body - expected object"}
            )
        
        if "messages" not in body or not isinstance(body["messages"], list):
            return JSONResponse(
                status_code=400,
                content={"error": "Missing or invalid 'messages' field"}
            )
        
        # Extract data
        clerk_id = request.state.user.clerk_id
        messages = body["messages"]
        title = body.get("title")
        session_id = body.get("session_id")
        
        print(f"Saving chat for user {clerk_id}")
        
        # If you have a service function
        from api.service.chat_history_service import save_chat_history
        
        # Create metadata
        metadata = {}
        if session_id:
            metadata["client_session_id"] = session_id
        
        # Save the chat
        chat_id = await save_chat_history(
            clerk_id=clerk_id,
            messages=messages,
            title=title,
            metadata=metadata
        )
        
        if chat_id:
            return {"id": chat_id, "success": True}
        else:
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to save chat"}
            )
    except Exception as e:
        print(f"Error saving chat: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Server error: {str(e)}"}
        )

# Add a simpler fallback endpoint as well
@app.post("/api/chat/save")
async def save_chat_fallback(request: FastAPIRequest):
    """Fallback endpoint to save a chat"""
    return await save_chat(request)