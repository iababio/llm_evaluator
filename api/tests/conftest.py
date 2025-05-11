import os
import sys
import pytest
import asyncio
from unittest.mock import patch

# Set environment variable for pure Python implementation of protobuf
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"
# Set test environment
os.environ["ENVIRONMENT"] = "test"

# Add a pytest configuration hook
def pytest_configure(config):
    """Configure pytest environment."""
    # Suppress deprecation warnings if needed
    import warnings
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    
    # Print version information to help with debugging
    import platform
    print(f"Python version: {platform.python_version()}")
    
    # Import and display protobuf version if available
    try:
        from google.protobuf import __version__ as protobuf_version
        print(f"Protobuf version: {protobuf_version}")
    except ImportError:
        print("Protobuf not directly importable")
        
@pytest.fixture
def mock_openai_client():
    """Mock the OpenAI client for testing."""
    with patch("api.service.chat_service.client") as mock_client:
        # Configure mock responses as needed
        mock_client.chat.completions.create.return_value = MagicedMock()
        yield mock_client

@pytest.fixture
def mock_db():
    """Mock database operations for testing."""
    with patch("api.db.index.db") as mock_db:
        yield mock_db

@pytest.fixture
def event_loop():
    """Create and yield an event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# Mock for OpenAI streaming responses
class MagicedMock:
    """A custom mock that produces an iterable response for streaming."""
    def __init__(self, content=None, error=None):
        self.content = content or ["Test", "Response"]
        self.error = error
        self.index = 0
        
    def __iter__(self):
        return self
        
    def __next__(self):
        if self.error and self.index == 0:
            self.index += 1
            raise self.error
            
        if self.index < len(self.content):
            result = MockChunk(self.content[self.index])
            self.index += 1
            return result
        raise StopIteration
    
    @property    
    def choices(self):
        return []
        
    @property
    def usage(self):
        class Usage:
            prompt_tokens = 10
            completion_tokens = 20
        return Usage()

# Mock chunk class to simulate OpenAI response chunks
class MockChunk:
    def __init__(self, content):
        self.choices = [MockChoice(content)]
        
class MockChoice:
    def __init__(self, content):
        self.delta = MockDelta(content)
        self.finish_reason = None
        
class MockDelta:
    def __init__(self, content):
        self.content = content

@pytest.fixture
def stream_response_content():
    """Helper fixture to get content from streaming responses."""
    def _get_content(response):
        """Extract content from streaming responses regardless of client implementation."""
        try:
            return "".join([chunk for chunk in response.iter_text()])
        except AttributeError:
            try:
                return b"".join([chunk for chunk in response.iter_content()]).decode('utf-8')
            except AttributeError:
                return response.content.decode('utf-8') if hasattr(response, 'content') else ""
    
    return _get_content