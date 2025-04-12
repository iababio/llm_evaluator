from fastapi import APIRouter, Request as FastAPIRequest, Depends
from fastapi.responses import JSONResponse
from datetime import datetime
import traceback

router = APIRouter()

@router.get("/api/auth/check")
async def check_auth(request: FastAPIRequest):
    """Simple endpoint to check if user is authenticated"""
    try:
        # Get headers for debugging
        headers = {k: (v if k.lower() != 'authorization' else '[REDACTED]') 
                  for k, v in request.headers.items()}
        
        client_id = request.headers.get("X-Client-ID", "unknown")
        
        print(f"Auth check from {client_id}")
        
        # Check if request has state and user
        if not hasattr(request, "state"):
            print(f"No state attribute for /api/auth/check from {client_id}")
            return JSONResponse(
                status_code=401,
                content={
                    "authenticated": False,
                    "error": "No state in request",
                    "timestamp": datetime.now().isoformat()
                }
            )
        
        if not hasattr(request.state, "user") or request.state.user is None:
            print(f"No user in state for /api/auth/check from {client_id}")
            return JSONResponse(
                status_code=401,
                content={
                    "authenticated": False,
                    "error": "No user in state",
                    "timestamp": datetime.now().isoformat()
                }
            )
        
        # User is authenticated
        user_id = request.state.user.clerk_id
        print(f"Auth check success: {user_id}")
        
        return {
            "authenticated": True,
            "user_id": user_id,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Auth check error: {str(e)}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "authenticated": False,
                "error": f"Server error: {str(e)}",
                "timestamp": datetime.now().isoformat()
            }
        )