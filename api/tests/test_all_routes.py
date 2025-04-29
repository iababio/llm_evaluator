import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
import sys
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)

def mock_import(*args, **kwargs):
    raise ImportError("Mocked import to avoid protobuf conflicts")

try:
    from api.index import app
    client = TestClient(app)
except TypeError as e:
    if "Descriptors cannot be created directly" in str(e):
        print("WARNING: Protobuf version conflict detected, using test-only imports")
        import os
        os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"
        from api.index import app
        client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_environment():
    """Setup environment for testing."""
    yield

class TestAPIRoutes:
    """Basic smoke tests for all API routes"""
    
    @patch("api.service.chat_service.stream_text")
    def test_api_routes_exist(self, mock_stream):
        """Test that all expected API routes respond."""
        mock_stream.return_value = (item for item in ["Test"])
        
        response = client.post(
            "/api/completion", 
            json={"prompt": "test"}
        )
        assert response.status_code == 200
        
        response = client.post(
            "/api/chat",
            json={"messages": [{"role": "user", "content": "test"}]}
        )
        assert response.status_code == 200
        
        with patch("api.service.sentiment_service.analyze_sentiment") as mock_sentiment:
            mock_sentiment.return_value = {"results": [{"sentiment": ["neutral"], "text": "test"}]}
            response = client.post(
                "/api/sentiment",
                json={"messages": [{"role": "user", "content": "test"}]}
            )
            assert response.status_code == 200
    
    def test_protocol_parameter(self):
        """Test the protocol parameter in chat endpoints."""
        
        with patch("api.router.v1.chat_route.stream_text") as mock_stream:
            mock_stream.return_value = (item for item in ["Test"])
            
            response = client.post(
                "/api/completion",
                json={"prompt": "test"},
                params={"protocol": "text"}
            )
            assert response.status_code == 200
            
            assert mock_stream.called, "stream_text was not called"
            args = mock_stream.call_args[0]
            assert args[1] == "text", f"Expected 'text' protocol, got '{args[1]}'"
            
        with patch("api.router.v1.chat_route.stream_text") as mock_stream:
            mock_stream.return_value = (item for item in ["Test"])
            
            response = client.post(
                "/api/completion",
                json={"prompt": "test"},
                params={"protocol": "data"} 
            )
            assert response.status_code == 200
            assert 'x-vercel-ai-data-stream' in response.headers
            assert response.headers['x-vercel-ai-data-stream'] == 'v1'
            
            assert mock_stream.called, "stream_text was not called"
            args = mock_stream.call_args[0]
            assert args[1] == "data", f"Expected 'data' protocol, got '{args[1]}'"
    
    def test_error_handling(self, stream_response_content):
        """Test error responses from API routes."""
        with patch("api.service.chat_service.create_openai_stream",
                   side_effect=ValueError("Test error")):
            response = client.post(
                "/api/completion",
                json={"prompt": "test"}
            )

            if response.status_code >= 400:
                assert "error" in response.json().get("detail", "").lower(), \
                    f"Expected error message in response. Got: {response.json()}"
            else:
                assert response.status_code == 200
                
                content_str = stream_response_content(response)
                
                assert "error" in content_str.lower() or "test error" in content_str.lower(), \
                    f"Expected error message in response stream. Got: {content_str}"


if __name__ == "__main__":
    pytest.main(["-xvs", __file__])