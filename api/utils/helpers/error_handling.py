import sys
import traceback
import logging
import asyncio
from typing import Dict, Any, Optional, Callable, TypeVar, Union
from functools import wraps
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("api.error_handling")

# Custom error types
class APIError(Exception):
    """Base class for API errors."""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ResourceNotFoundError(APIError):
    """Raised when a requested resource is not found."""
    def __init__(self, resource_type: str, resource_id: str):
        message = f"{resource_type} with ID {resource_id} not found"
        super().__init__(message=message, status_code=status.HTTP_404_NOT_FOUND)


class ValidationAPIError(APIError):
    """Raised when request validation fails."""
    def __init__(self, message: str, validation_errors: Dict[str, Any]):
        super().__init__(
            message=message, 
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={"validation_errors": validation_errors}
        )


class ExternalServiceError(APIError):
    """Raised when an external service call fails."""
    def __init__(self, service_name: str, message: str, status_code: int = status.HTTP_502_BAD_GATEWAY):
        details = {"service": service_name}
        super().__init__(
            message=f"External service error ({service_name}): {message}",
            status_code=status_code,
            details=details
        )


# Error handling utilities
def format_exception(exc: Exception) -> Dict[str, Any]:
    """Format an exception into a structured dictionary."""
    error_type = type(exc).__name__
    error_msg = str(exc)
    tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    
    error_detail = {
        "error_type": error_type,
        "error_message": error_msg,
        "traceback": tb
    }
    
    if isinstance(exc, APIError) and exc.details:
        error_detail["details"] = exc.details
    
    return error_detail


def log_error(exc: Exception, context: str = "") -> None:
    """Log an exception with optional context information."""
    error_detail = format_exception(exc)
    
    if context:
        logger.error(f"Error in {context}: {error_detail['error_message']}")
    else:
        logger.error(f"Error: {error_detail['error_message']}")
    
    logger.debug(f"Error details: {error_detail}")


def create_error_response(exc: Exception) -> JSONResponse:
    """Convert an exception to a JSONResponse with appropriate status code."""
    if isinstance(exc, APIError):
        status_code = exc.status_code
        detail = {
            "message": exc.message,
            **(exc.details or {})
        }
    elif isinstance(exc, ValidationError):
        status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
        detail = {
            "message": "Validation error",
            "errors": exc.errors()
        }
    elif isinstance(exc, HTTPException):
        status_code = exc.status_code
        detail = {"message": exc.detail}
    elif isinstance(exc, asyncio.TimeoutError):
        status_code = status.HTTP_504_GATEWAY_TIMEOUT
        detail = {"message": "Operation timed out"}
    else:
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        detail = {"message": f"Internal server error: {str(exc)}"}
    
    return JSONResponse(
        status_code=status_code,
        content=detail
    )


# Function for handling timeouts
async def with_timeout(coro, timeout_seconds: float, operation_name: str = "Operation", 
                      fallback_result: Any = None, raise_on_timeout: bool = False):
    """Execute a coroutine with a timeout."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        if raise_on_timeout:
            raise APIError(
                f"{operation_name} timed out after {timeout_seconds} seconds", 
                status.HTTP_504_GATEWAY_TIMEOUT
            )
        
        logger.warning(f"{operation_name} timed out after {timeout_seconds} seconds")
        return fallback_result


# Error handling decorator
F = TypeVar('F', bound=Callable[..., Any])

def handle_exceptions(logger_context: Optional[str] = None) -> Callable[[F], F]:
    """Decorator that catches exceptions and returns appropriate responses."""
    def decorator(func: F) -> F:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as exc:
                context = logger_context or func.__name__
                log_error(exc, context)
                return create_error_response(exc)
            
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as exc:
                context = logger_context or func.__name__
                log_error(exc, context)
                return create_error_response(exc)
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator


def run_async(coroutine):
    """Run an async function from a synchronous context."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        # If no event loop exists, create a new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(coroutine)