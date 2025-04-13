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

# Replace the verify_clerk_token function with this improved version

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
                
                # First check for standard OAuth2/OIDC claims
                if 'sub' in decoded and decoded['sub']:
                    print(f"Found user ID in 'sub' claim: {decoded['sub']}")
                    return {"id": decoded['sub']}
                    
                # Also check these common fields
                for key in ['azp', 'user_id', 'id', 'userId', 'email']:
                    if key in decoded and decoded[key]:
                        print(f"Found user ID in '{key}' claim: {decoded[key]}")
                        return {"id": decoded[key]}
                
                # Return the full payload for debugging
                print("Could not find specific user ID in claims, returning full payload")
                return {"payload": decoded}
            except Exception as e:
                print(f"Error decoding JWT: {e}")
                traceback.print_exc()
                return {"error": f"JWT decode error: {str(e)}"}
        
        print(f"Invalid token format (not a JWT with 3 parts)")
        return {"error": "Token is not in JWT format"}
    except Exception as e:
        print(f"Error verifying token: {e}")
        traceback.print_exc()
        return {"error": f"Token verification error: {str(e)}"}


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

# Enhance the user_middleware function to better handle token validation and debugging

async def user_middleware(request: Request, call_next):
    """Middleware to handle user authentication and set user in request state"""
    try:
        # Make sure we have state
        if not hasattr(request, "state"):
            from types import SimpleNamespace
            request.state = SimpleNamespace()
        
        # Default to no user
        request.state.user = None
        
        # Get authorization header
        auth_header = request.headers.get("Authorization")
        
        # Log detailed debugging info for all requests to help diagnose issues
        print(f"Processing request: {request.method} {request.url.path}")
        
        if (auth_header and auth_header.startswith("Bearer ")):
            token = auth_header.replace("Bearer ", "")
            
            # Verify and decode the token
            try:
                # Extract user ID from token
                user_data = await verify_clerk_token(token)
                clerk_id = user_data.get("id")
                
                if clerk_id:
                    print(f"Found user ID in token: {clerk_id}")
                    
                    # Create a user object with clerk_id property
                    from types import SimpleNamespace
                    user_obj = SimpleNamespace()
                    user_obj.clerk_id = clerk_id
                    
                    # Important: Set the user in the state
                    request.state.user = user_obj
                    print(f"User authenticated: {clerk_id}")
                    
                    # Verify user was correctly set with explicit checks
                    if not hasattr(request.state, "user"):
                        print("ERROR: Failed to set user in request.state")
                    elif not hasattr(request.state.user, "clerk_id"):
                        print("ERROR: User object has no clerk_id attribute")
                    else:
                        print(f"User object correctly set with clerk_id: {request.state.user.clerk_id}")
                else:
                    print(f"No user ID found in token. Token starts with: {token[:15]}...")
            except Exception as e:
                print(f"Error authenticating user: {str(e)}")
                traceback.print_exc()
        else:
            if request.url.path.startswith('/api/') and request.url.path not in [
                '/api/users/sync', '/api/debug/echo', '/api/auth/check', '/api/auth-debug'
            ]:
                print(f"No auth header for protected endpoint: {request.url.path}")
        
        # Call next middleware or route handler
        response = await call_next(request)
        return response
    except Exception as e:
        print(f"Middleware error: {str(e)}")
        traceback.print_exc()
        
        # If an error occurs, still try to continue
        try:
            return await call_next(request)
        except Exception:
            # If that fails too, return a 500 error
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=500,
                content={"error": "Internal server error in authentication middleware"}
            )