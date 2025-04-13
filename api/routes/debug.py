from fastapi import APIRouter, Request as FastAPIRequest, Header
from fastapi.responses import JSONResponse
from datetime import datetime
import traceback
import json
import base64
import re
import jwt
import os
from typing import Optional

from api.models.chat_model import Request

# Get Clerk configuration from environment variables
JWT_VERIFICATION_KEY = os.getenv("CLERK_JWT_VERIFICATION_KEY")
CLERK_ISSUER = os.getenv("CLERK_ISSUER")

router = APIRouter(
    prefix="/api/debug",
    tags=["debug"],
)

@router.get("/api/debug/auth")
async def debug_auth(request: FastAPIRequest):
    """Debug endpoint to check authentication state"""
    try:
        # Get authorization header
        auth_header = request.headers.get("Authorization")
        
        # Get all headers (excluding sensitive info)
        headers = {
            k: (v if k.lower() != 'authorization' else '[REDACTED]')
            for k, v in request.headers.items()
        }
        
        # Get state info
        user_state = hasattr(request, "state") and hasattr(request.state, "user")
        clerk_id = getattr(request.state.user, "clerk_id", None) if user_state else None
        
        result = {
            "path": str(request.url),
            "method": request.method,
            "headers": headers,
            "has_auth_header": auth_header is not None,
            "has_state": hasattr(request, "state"),
            "has_user_state": user_state,
            "clerk_id": clerk_id,
            "timestamp": datetime.now().isoformat()
        }
        
        # Examine token if available
        if auth_header:
            # Extract token
            token_match = re.match(r"Bearer\s+(.*)", auth_header)
            if token_match:
                token = token_match.group(1).strip()
                result["token_prefix"] = token[:10] + "..." if len(token) > 10 else token
                result["token_length"] = len(token)
                
                # Check if token has JWT format
                is_jwt_format = token.count('.') == 2
                result["has_jwt_format"] = is_jwt_format
                
                if is_jwt_format:
                    try:
                        # Try to decode without verification
                        parts = token.split(".")
                        payload = parts[1]
                        
                        # Add padding if needed
                        padding = len(payload) % 4
                        if padding:
                            payload += '=' * (4 - padding)
                        
                        # Decode the payload
                        payload_json = base64.urlsafe_b64decode(payload)
                        payload_data = json.loads(payload_json)
                        
                        # Add non-sensitive info to result
                        safe_payload = {}
                        for key, value in payload_data.items():
                            if key in ["sub", "exp", "iat", "azp", "iss"]:
                                safe_payload[key] = value
                                
                                # Add formatted dates for timestamps
                                if key in ["exp", "iat"] and isinstance(value, int):
                                    safe_payload[f"{key}_date"] = datetime.fromtimestamp(value).isoformat()
                        
                        result["token_payload"] = safe_payload
                        result["token_payload_keys"] = list(payload_data.keys())
                    except Exception as e:
                        result["token_decode_error"] = str(e)
            else:
                result["token_format_error"] = "Does not match Bearer format"
        
        return result
    except Exception as e:
        print(f"Auth debug error: {str(e)}")
        traceback.print_exc()
        return {
            "error": str(e),
            "traceback": traceback.format_exc(),
            "timestamp": datetime.now().isoformat()
        }

@router.get("/api/debug/headers")
async def debug_headers(request: FastAPIRequest):
    """Debug endpoint to check request headers"""
    try:
        return {
            "headers": {k: v for k, v in request.headers.items()},
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "error": str(e),
            "traceback": traceback.format_exc(),
            "timestamp": datetime.now().isoformat()
        }

# Add this endpoint to check clerk configuration

@router.get("/api/debug/clerk-config")
async def debug_clerk_config():
    """Debug endpoint to check Clerk configuration"""
    try:
        config = {
            "CLERK_JWT_VERIFICATION_KEY_LENGTH": len(JWT_VERIFICATION_KEY) if JWT_VERIFICATION_KEY else 0,
            "CLERK_ISSUER_SET": bool(CLERK_ISSUER),
            "HAS_JWT_VERIFICATION_KEY": bool(JWT_VERIFICATION_KEY),
            "ENV_VARS_SET": {
                "CLERK_JWT_VERIFICATION_KEY": bool(os.getenv("CLERK_JWT_VERIFICATION_KEY")),
                "CLERK_ISSUER": bool(os.getenv("CLERK_ISSUER")),
                "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": bool(os.getenv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")),
                "CLERK_SECRET_KEY": bool(os.getenv("CLERK_SECRET_KEY"))
            }
        }
        
        return {
            "timestamp": datetime.now().isoformat(),
            "config": config
        }
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@router.get("/token-test")
async def test_token(request: Request, authorization: Optional[str] = Header(None)):
    """Endpoint to test token parsing and extraction"""
    try:
        # For direct testing
        auth_header = authorization or request.headers.get("Authorization")
        
        if not auth_header or not auth_header.startswith("Bearer "):
            return {
                "status": "error",
                "error": "No valid Authorization header found"
            }
            
        token = auth_header.replace("Bearer ", "")
        
        # Analyze token
        result = {
            "token_length": len(token),
            "token_prefix": token[:10] + "...",
            "timestamp": datetime.now().isoformat()
        }
        
        # Parse token
        parts = token.split('.')
        if len(parts) != 3:
            result["error"] = "Not a valid JWT (should have 3 parts)"
            return result
            
        # Decode header
        header_b64 = parts[0]
        padding = len(header_b64) % 4
        if padding:
            header_b64 += '=' * (4 - padding)
        header = json.loads(base64.urlsafe_b64decode(header_b64))
        result["header"] = header
        
        # Decode payload
        payload_b64 = parts[1]
        padding = len(payload_b64) % 4
        if padding:
            payload_b64 += '=' * (4 - padding)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        
        # Filter out potentially sensitive fields
        filtered_payload = {k: v for k, v in payload.items() 
                           if k in ["sub", "exp", "iat", "iss", "azp", "aud"]}
        result["payload"] = filtered_payload
        
        # Check for user identifiers
        user_ids = {}
        for field in ["sub", "azp", "user_id", "id"]:
            if field in payload:
                user_ids[field] = payload[field]
                
        result["user_ids"] = user_ids
        
        # Check current request state
        result["request_state"] = {
            "has_state": hasattr(request, "state"),
            "has_user": hasattr(request, "state") and hasattr(request.state, "user")
        }
        
        if result["request_state"]["has_user"]:
            result["request_state"]["clerk_id"] = request.state.user.clerk_id
        
        return result
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }