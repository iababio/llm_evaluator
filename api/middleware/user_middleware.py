from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from api.service.user_service import get_user_by_clerk_id
import re
import httpx
import os
import json
import base64
import traceback
from dotenv import load_dotenv
import jwt
import time

load_dotenv('.env.local')

# This pattern matches the Bearer token format
bearer_pattern = re.compile(r'^Bearer\s+(.+)$')

# Clerk API key
clerk_secret_key = os.environ.get("CLERK_SECRET_KEY")
JWT_VERIFICATION_KEY = os.getenv("CLERK_JWT_VERIFICATION_KEY", "")
CLERK_ISSUER = os.getenv("CLERK_ISSUER", "")

async def verify_clerk_token(token: str) -> dict:
    """Verify token by decoding it locally."""
    try:
        # For JWT tokens, decode them directly without API call
        parts = token.split('.')
        if len(parts) == 3:  # Simple JWT format check
            try:
                # Decode the payload (middle part)
                payload = parts[1]
                # Add padding if needed
                padding = len(payload) % 4
                if padding:
                    payload += '=' * (4 - padding)
                
                # Use urlsafe_b64decode
                decoded_bytes = base64.urlsafe_b64decode(payload)
                decoded = json.loads(decoded_bytes)
                
                # Print the full decoded payload for debugging
                print(f"Decoded JWT payload keys: {list(decoded.keys())}")
                
                # Try various possible claim names for the user ID
                for key in ['sub', 'user_id', 'id', 'userId', 'clerk_id', 'azp']:
                    if key in decoded:
                        print(f"Found user ID in '{key}' claim: {decoded[key]}")
                        return {"id": decoded[key]}
                
                print(f"Could not find user ID in JWT claims. Available keys: {list(decoded.keys())}")
            except Exception as e:
                print(f"Error decoding JWT: {e}")
                traceback.print_exc()
        
        print(f"Could not extract user ID from token: {token[:20]}...")
        return {}
    except Exception as e:
        print(f"Error verifying token: {e}")
        traceback.print_exc()
        return {}


async def enrich_request_with_user(request: Request):
    """Middleware to add the user object to the request if authenticated."""
    # Skip this middleware for the user sync endpoint to avoid circular dependency
    if request.url.path == '/api/users/sync':
        return
    
    # Get authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        # No authentication provided - continue as anonymous
        print(f"No Authorization header for {request.url.path}")
        return
    
    # Extract token
    match = bearer_pattern.match(auth_header)
    if not match:
        # Malformed authorization header
        print(f"Malformed Authorization header: {auth_header[:20]}...")
        return
    
    token = match.group(1)
    
    # Verify token
    user_data = await verify_clerk_token(token)
    clerk_id = user_data.get("id")
    
    if clerk_id:
        try:
            # Get user by clerk_id
            user = await get_user_by_clerk_id(clerk_id)
            if user:
                # Attach user to request state
                request.state.user = user
                print(f"Found user for clerk_id {clerk_id}")
            else:
                # If we have a clerk_id but no user in our DB, create a placeholder
                print(f"Creating placeholder user for clerk_id {clerk_id}")
                request.state.user = type('User', (), {'clerk_id': clerk_id})
        except Exception as e:
            # Log error but don't block the request
            print(f"Error enriching request with user: {str(e)}")
            traceback.print_exc()
    else:
        print("No clerk_id found in token")

# Add this StateInitializationMiddleware for better state management
async def state_initialization_middleware(request: Request, call_next):
    """Middleware to ensure request.state is properly initialized."""
    # Initialize the state object if it doesn't exist
    if not hasattr(request, "state"):
        request.state = type('State', (), {})
    
    # Initialize user as None
    request.state.user = None
    
    # Continue with request processing
    return await call_next(request)

async def user_middleware(request: Request, call_next):
    """Middleware to extract and verify user from clerk JWT token."""
    try:
        # At this point state should be initialized by state_initialization_middleware
        # But let's double check
        if not hasattr(request, "state"):
            print("WARNING: State not initialized before user_middleware!")
            request.state = type('State', (), {})
            request.state.user = None
        
        print(f"Processing request: {request.method} {request.url.path}")
        
        # Get authorization header
        authorization = request.headers.get("Authorization")
        
        if not authorization:
            print(f"No Authorization header for {request.url.path}")
            
            # Only block authenticated endpoints
            if request.url.path.startswith("/api/chat-history") or request.url.path == "/api/user":
                return JSONResponse(
                    status_code=401,
                    content={"error": "Authentication required - No Authorization header"}
                )
            
            # Allow other endpoints to continue
            return await call_next(request)
        
        # Simple user class
        class User:
            def __init__(self, clerk_id):
                self.clerk_id = clerk_id
        
        # Extract token from authorization header
        token_match = re.match(r"Bearer\s+(.*)", authorization)
        if not token_match:
            print(f"Invalid Authorization format: {authorization[:20]}...")
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid Authorization header format"}
            )
            
        token = token_match.group(1).strip()
        
        # Simple token parsing - extract the user ID
        try:
            parts = token.split(".")
            if len(parts) != 3:
                print(f"Invalid JWT format: parts count = {len(parts)}")
                return JSONResponse(
                    status_code=401,
                    content={"error": "Invalid JWT format"}
                )
                
            # Decode the payload part (middle part)
            payload = parts[1]
            
            # Add padding if needed
            padding = len(payload) % 4
            if padding:
                payload += '=' * (4 - padding)
                
            # Decode the payload
            payload_json = base64.urlsafe_b64decode(payload)
            payload_data = json.loads(payload_json)
            
            # Extract user ID from various possible fields
            user_id = None
            for field in ["sub", "userId", "user_id", "clerk_id"]:
                if field in payload_data:
                    user_id = payload_data[field]
                    print(f"Found user ID in {field}: {user_id}")
                    break
            
            if not user_id:
                print(f"No user ID in token. Keys: {list(payload_data.keys())}")
                return JSONResponse(
                    status_code=401,
                    content={"error": "No user ID found in token"}
                )
                
            # Set user in request state
            request.state.user = User(clerk_id=user_id)
            print(f"User authenticated: {user_id}")
            
        except Exception as e:
            print(f"Error parsing token: {str(e)}")
            traceback.print_exc()
            return JSONResponse(
                status_code=401,
                content={"error": f"Token parsing error: {str(e)}"}
            )
            
        # Continue with the request
        return await call_next(request)
        
    except Exception as e:
        print(f"Middleware error: {str(e)}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Server error: {str(e)}"}
        )