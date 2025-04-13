from fastapi import APIRouter, Request, Header
from fastapi.responses import JSONResponse
from datetime import datetime
import base64
import json
import traceback
from typing import Optional

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)

@router.get("/check")
async def check_auth(request: Request, authorization: Optional[str] = Header(None)):
    """Simple endpoint to check authentication status"""
    try:
        # For direct testing
        auth_header = authorization or request.headers.get("Authorization")
        request_id = request.headers.get("X-Request-Id", "unknown")
        
        print(f"Auth check request [{request_id}] - Auth header present: {auth_header is not None}")
        
        auth_status = {
            "timestamp": datetime.now().isoformat(),
            "authenticated": False,
            "has_state": hasattr(request, "state"),
            "has_user": False,
            "clerk_id": None,
            "request_id": request_id,
        }
        
        # First check if user exists in state (should be set by middleware)
        if hasattr(request, "state") and hasattr(request.state, "user") and request.state.user is not None:
            auth_status["has_user"] = True
            print(f"User found in request state")
            
            # Check if user has a clerk_id
            if hasattr(request.state.user, "clerk_id"):
                auth_status["clerk_id"] = request.state.user.clerk_id
                auth_status["authenticated"] = True
                print(f"User has clerk_id: {request.state.user.clerk_id}")
            else:
                print("User object missing clerk_id attribute")
        else:
            print("No user in request state")
        
        # If we don't have a user in state but do have an auth header, try manual extraction
        if not auth_status["authenticated"] and auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            
            try:
                # Manually parse the JWT
                parts = token.split('.')
                if len(parts) == 3:  # Basic JWT validation
                    # Parse the payload
                    payload = parts[1]
                    # Add padding if needed
                    padding = len(payload) % 4
                    if padding:
                        payload += '=' * (4 - padding)
                    
                    decoded_bytes = base64.urlsafe_b64decode(payload)
                    decoded = json.loads(decoded_bytes)
                    
                    # Extract user ID from common JWT claim fields
                    user_id = None
                    for field in ["sub", "azp", "user_id", "id"]:
                        if field in decoded and decoded[field]:
                            user_id = decoded[field]
                            break
                    
                    if user_id:
                        auth_status["token_user_id"] = user_id
                        auth_status["token_authenticated"] = True
                        print(f"Token contains user ID: {user_id}")
                    
                    # Add key token info to response
                    auth_status["token_info"] = {
                        "format": "valid JWT",
                        "expires_at": decoded.get("exp", "unknown"),
                        "issued_at": decoded.get("iat", "unknown"),
                        "issuer": decoded.get("iss", "unknown"),
                    }
            except Exception as e:
                print(f"Error decoding token: {str(e)}")
                auth_status["token_error"] = str(e)
        
        print(f"Auth check result: {auth_status['authenticated']}")
        return auth_status
    except Exception as e:
        print(f"Error in auth check: {str(e)}")
        traceback.print_exc()
        return {
            "authenticated": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }