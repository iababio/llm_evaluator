# Update the import section to include chat_history_service
import base64
from datetime import datetime, timedelta
import json
import os
import re
from api.service.chat_history_service import ensure_chat_history_index, get_user_chat_histories, get_chat_history, delete_chat_history, is_valid_object_id
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
from api.middleware.user_middleware import verify_clerk_token
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

# Add this import near the top with your other middleware imports
from api.middleware.direct_auth import direct_auth_middleware

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

# Then update your middleware registration - add this BEFORE the user_middleware
app.add_middleware(BaseHTTPMiddleware, dispatch=direct_auth_middleware)

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
    # Extract clerk_id from user - with proper null checking
    print("Handling chat completion request")
    clerk_id = None
    if request_obj and hasattr(request_obj, "state") and hasattr(request_obj.state, "user") and request_obj.state.user is not None:
        clerk_id = request_obj.state.user.clerk_id
    
    # Add request ID tracking to prevent duplicates
    request_id = f"req_{datetime.now().timestamp()}"
    
    print(f"Completion request with clerk_id: {clerk_id}, request_id: {request_id}")
    
    if request.prompt:
        openai_messages = [{"role": "user", "content": request.prompt}]
    elif request.messages:
        openai_messages = convert_to_openai_messages(request.messages)
    else:
        return {"detail": "Either prompt or messages must be provided"}

    response = StreamingResponse(stream_text(openai_messages, protocol, clerk_id, request_id=request_id))
    response.headers['x-vercel-ai-data-stream'] = 'v1'
    response.headers['x-request-id'] = request_id
    return response


@app.post("/api/chat")
async def handle_chat_data(request_obj: FastAPIRequest, protocol: str = Query('data')):
    """Handle chat completion requests"""
    # Extract clerk_id from user with proper null checking
    clerk_id = None
    if request_obj and hasattr(request_obj, "state") and hasattr(request_obj.state, "user") and request_obj.state.user is not None:
        clerk_id = request_obj.state.user.clerk_id
    
    print(f"Chat request with clerk_id: {clerk_id}")
    
    # Extract messages from request body
    try:
        # Parse request body
        body_bytes = await request_obj.body()
        body = json.loads(body_bytes)
        messages = body.get("messages", [])
        
        # Add request ID to prevent duplicate processing
        request_id = body.get("request_id", None)
        if not request_id:
            # Generate unique request ID if not provided
            request_id = f"req_{datetime.now().timestamp()}"
            print(f"Generated request_id: {request_id}")
        else:
            print(f"Using provided request_id: {request_id}")
        
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
        response = StreamingResponse(stream_text(openai_messages, protocol, clerk_id, request_id=request_id))
        response.headers['x-vercel-ai-data-stream'] = 'v1'
        response.headers['x-request-id'] = request_id
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
async def handle_sentiment_analysis(request: Request, request_obj: FastAPIRequest):
    """
    Analyze sentiments in the provided text and return structured sentiment data.
    This endpoint returns a non-streaming JSON response.
    """
    try:
        # Extract clerk_id from request state (same as in other endpoints)
        clerk_id = None
        
        # First check for direct auth (from our middleware)
        direct_auth_user_id = request_obj.headers.get("X-Direct-Auth-User-ID")
        if direct_auth_user_id:
            clerk_id = direct_auth_user_id
            print(f"Using directly authenticated user ID for sentiment: {clerk_id}")
        elif request_obj and hasattr(request_obj, "state") and hasattr(request_obj.state, "user") and request_obj.state.user is not None:
            clerk_id = request_obj.state.user.clerk_id
            print(f"Sentiment analysis request with clerk_id from state: {clerk_id}")
        else:
            # Try to extract from token as fallback
            auth_header = request_obj.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.replace("Bearer ", "")
                user_data = await verify_clerk_token(token)
                if "id" in user_data:
                    clerk_id = user_data["id"]
                    print(f"Extracted clerk_id {clerk_id} from token for sentiment analysis")
        
        # Log auth status for debugging
        if clerk_id:
            print(f"Proceeding with sentiment analysis for clerk_id: {clerk_id}")
        else:
            print("Warning: No clerk_id available for sentiment analysis")
        
        messages = request.messages
        openai_messages = convert_to_openai_messages(messages)
        
        # Set a timeout for the entire operation
        try:
            # Pass the clerk_id to analyze_sentiment
            result = await asyncio.wait_for(
                analyze_sentiment(openai_messages, clerk_id=clerk_id),
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

# Update the chat history endpoint
@app.get("/api/chat-history")
async def get_user_chat_histories(request_obj: FastAPIRequest):
    """Get chat history for the authenticated user with caching"""
    try:
        # Get clerk_id using multiple methods for reliability
        clerk_id = None
        
        # Method 1: Direct auth header
        direct_auth_user_id = request_obj.headers.get("X-Direct-Auth-User-ID")
        if direct_auth_user_id:
            clerk_id = direct_auth_user_id
            print(f"Using directly authenticated user ID: {clerk_id}")
        
        # Method 2: From request state
        elif hasattr(request_obj, "state") and hasattr(request_obj.state, "user") and request_obj.state.user is not None:
            clerk_id = request_obj.state.user.clerk_id
            print(f"Using clerk_id from request state: {clerk_id}")
        
        # Method 3: Parse token directly
        else:
            auth_header = request_obj.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.replace("Bearer ", "")
                try:
                    # Parse JWT directly
                    parts = token.split('.')
                    if len(parts) == 3:
                        payload = parts[1]
                        # Add padding if needed
                        padding = len(payload) % 4
                        if padding:
                            payload += '=' * (4 - padding)
                        
                        decoded = json.loads(base64.urlsafe_b64decode(payload))
                        
                        # Find user ID from common claim fields
                        for field in ["sub", "azp", "user_id", "id"]:
                            if field in decoded and decoded[field]:
                                clerk_id = decoded[field]
                                print(f"Extracted clerk_id {clerk_id} from token")
                                break
                except Exception as e:
                    print(f"Failed to extract clerk_id from token: {e}")
        
        if not clerk_id:
            return JSONResponse(
                status_code=401,
                content={"error": "Authentication required - No clerk_id found"}
            )
            
        print(f"Getting chat histories for clerk_id: {clerk_id}")
        
        # Cache logic
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
        traceback.print_exc()
        # Return empty list instead of error to avoid breaking the UI
        return []

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

# Add this endpoint for fetching a specific chat
@app.get("/api/chat-history/{chat_id}")
async def get_chat_by_id(chat_id: str, request_obj: FastAPIRequest):
    """Get a specific chat by ID"""
    try:
        # Get clerk_id using multiple methods (same as the list endpoint)
        clerk_id = None
        
        # Method 1: Direct auth header
        direct_auth_user_id = request_obj.headers.get("X-Direct-Auth-User-ID")
        if direct_auth_user_id:
            clerk_id = direct_auth_user_id
        
        # Method 2: From request state
        elif hasattr(request_obj, "state") and hasattr(request_obj.state, "user") and request_obj.state.user is not None:
            clerk_id = request_obj.state.user.clerk_id
        
        # Method 3: Parse token directly
        else:
            auth_header = request_obj.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.replace("Bearer ", "")
                try:
                    parts = token.split('.')
                    if len(parts) == 3:
                        payload = parts[1]
                        padding = len(payload) % 4
                        if padding:
                            payload += '=' * (4 - padding)
                        
                        decoded = json.loads(base64.urlsafe_b64decode(payload))
                        
                        for field in ["sub", "azp", "user_id", "id"]:
                            if field in decoded and decoded[field]:
                                clerk_id = decoded[field]
                                break
                except Exception as e:
                    print(f"Failed to extract clerk_id from token: {e}")
        
        if not clerk_id:
            return JSONResponse(
                status_code=401,
                content={"error": "Authentication required"}
            )

        if not is_valid_object_id(chat_id):
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid chat ID format"}
            )
            
        # Get the chat
        chat = await get_chat_history(chat_id)
        
        if not chat:
            return JSONResponse(
                status_code=404,
                content={"error": "Chat not found"}
            )
            
        # Verify the user owns this chat
        if chat.get("clerk_id") != clerk_id:
            return JSONResponse(
                status_code=403,
                content={"error": "Access denied"}
            )
            
        return chat
    except Exception as e:
        print(f"Error fetching chat: {str(e)}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Server error: {str(e)}"}
        )

# Add this debug endpoint
@app.get("/api/debug/mongo-status")
async def check_mongo_status():
    """Check MongoDB connection status and collection information"""
    try:
        from api.db.index import client, db, db_chat
        
        # Check connection
        info = {}
        
        try:
            # Test connection
            server_info = await client.server_info()
            info["connection"] = "success"
            info["version"] = server_info.get("version")
            
            # List databases
            databases = await client.list_database_names()
            info["databases"] = databases
            
            # Check collections
            collections = await db.list_collection_names()
            info["collections"] = collections
            
            # Check indexes
            try:
                indexes = await db_chat.list_indexes().to_list(None)
                info["chat_indexes"] = [idx["name"] for idx in indexes]
            except Exception as idx_error:
                info["chat_indexes_error"] = str(idx_error)
            
            # Check document counts
            try:
                chat_count = await db_chat.count_documents({})
                info["chat_count"] = chat_count
                
                # Get a sample document
                if chat_count > 0:
                    sample = await db_chat.find_one()
                    if sample:
                        # Remove potentially sensitive content
                        if "_id" in sample:
                            sample["_id"] = str(sample["_id"])
                        if "messages" in sample:
                            sample["messages"] = f"[{len(sample['messages'])} messages]"
                        info["sample_document_structure"] = {k: type(v).__name__ for k, v in sample.items()}
            except Exception as count_error:
                info["count_error"] = str(count_error)
                
            # Try a test write
            try:
                test_doc = {
                    "test": True,
                    "timestamp": datetime.now().isoformat(),
                    "purpose": "connection_test"
                }
                test_result = await db.test_connections.insert_one(test_doc)
                info["test_write"] = "success"
                info["test_id"] = str(test_result.inserted_id)
                
                # Clean up test document
                await db.test_connections.delete_one({"_id": test_result.inserted_id})
            except Exception as write_error:
                info["test_write_error"] = str(write_error)
            
            return {
                "status": "success",
                "info": info,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as mongo_error:
            return {
                "status": "error",
                "error": str(mongo_error),
                "traceback": traceback.format_exc()
            }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

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
# Add this diagnostic endpoint for database connectivity

@app.get("/api/debug/db-status")
async def check_db_status():
    """Check database connectivity and collection status"""
    try:
        # Check MongoDB connection
        db_info = {}
        
        try:
            # Test connection by listing databases
            from api.db.index import client, db
            databases = await client.list_database_names()
            db_info["connection"] = "success"
            db_info["databases"] = databases
            
            # Check collections in our database
            collections = await db.list_collection_names()
            db_info["collections"] = collections
            
            # Try to get a count of documents in chats collection
            from api.db.index import db_chat
            chat_count = await db_chat.count_documents({})
            db_info["chat_count"] = chat_count
            
            # Try a sample query
            sample_chats = await db_chat.find({}).limit(1).to_list(length=1)
            db_info["has_sample"] = len(sample_chats) > 0
            
            return {
                "status": "ok",
                "timestamp": datetime.now().isoformat(),
                "database": db_info
            }
            
        except Exception as db_error:
            return {
                "status": "error",
                "error": str(db_error),
                "traceback": traceback.format_exc(),
                "timestamp": datetime.now().isoformat()
            }
            
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
            "timestamp": datetime.now().isoformat()
        }

# Add this after creating the app
app.include_router(debug_router)

# Include the router
app.include_router(auth_router)

# Add this endpoint to manually test save functionality

from api.service.chat_history_service import save_chat_history

class ManualSaveRequest(BaseModel):
    title: str
    messages: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None

@app.post("/api/debug/manual-save")
async def manual_save_chat(request: ManualSaveRequest, request_obj: FastAPIRequest):
    """Manually save a chat for testing purposes"""
    try:
        # Check if we have a user
        if not hasattr(request_obj, "state") or not hasattr(request_obj.state, "user"):
            # Try to extract from token
            auth_header = request_obj.headers.get("Authorization")
            clerk_id = None
            
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.replace("Bearer ", "")
                user_data = await verify_clerk_token(token)
                if "id" in user_data:
                    clerk_id = user_data["id"]
            
            if not clerk_id:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Authentication required"}
                )
        else:
            clerk_id = request_obj.state.user.clerk_id
        
        # Attempt to save
        result = await save_chat_history(
            clerk_id=clerk_id,
            title=request.title,
            messages=request.messages,
            metadata=request.metadata
        )
        
        return {
            "success": True,
            "saved_id": str(result.get("_id")) if result and "_id" in result else None,
            "clerk_id": clerk_id
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc()
            }
        )
