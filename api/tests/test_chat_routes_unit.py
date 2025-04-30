import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import FastAPI
from api.router.v1.chat_route import router
from api.models.chat_model import CompletionRequest, Request

app = FastAPI()
app.include_router(router)
client = TestClient(app)


@pytest.fixture
def mock_stream_text():
    with patch("api.router.v1.chat_route.stream_text") as mock:
        mock.return_value = (item for item in ["Test", "Response", "Chunks"])
        yield mock


@pytest.fixture
def mock_analyze_sentiment():
    with patch("api.router.v1.chat_route.analyze_sentiment") as mock:
        mock.return_value = {
            "results": [
                {
                    "text": "This is a positive test.",
                    "sentiment": ["positive"]
                }
            ]
        }
        yield mock


class TestChatRoutes:
    
    def test_completion_endpoint_with_prompt(self, mock_stream_text):
        """Test the /api/completion endpoint with a prompt."""
        response = client.post(
            "/api/completion",
            json={"prompt": "Hello, how are you?"}
        )
        
        assert response.status_code == 200
        assert 'x-vercel-ai-data-stream' in response.headers
        assert response.headers['x-vercel-ai-data-stream'] == 'v1'
        
        mock_stream_text.assert_called_once()
        args = mock_stream_text.call_args[0]
        assert len(args) >= 1
        assert args[0] == [{"role": "user", "content": "Hello, how are you?"}]

    def test_completion_endpoint_with_messages(self, mock_stream_text):
        """Test the /api/completion endpoint with messages."""
        response = client.post(
            "/api/completion",
            json={"messages": [{"role": "user", "content": "Hello"}]}
        )
        
        assert response.status_code == 200
        assert 'x-vercel-ai-data-stream' in response.headers
        
        mock_stream_text.assert_called_once()
        args = mock_stream_text.call_args[0]
        messages = args[0]
        
        assert len(messages) == 1, "Expected a single message"
        assert messages[0]["role"] == "user", "Expected role to be 'user'"
        
        if isinstance(messages[0]["content"], str):
            assert messages[0]["content"] == "Hello"
        else:
            assert isinstance(messages[0]["content"], list), "Content should be a list in structured format"
            assert len(messages[0]["content"]) > 0, "Content list should not be empty"
            assert messages[0]["content"][0].get("type") == "text", "Expected content type to be 'text'"
            assert messages[0]["content"][0].get("text") == "Hello", "Expected content text to be 'Hello'"

    def test_completion_endpoint_with_user_id(self, mock_stream_text):
        """Test the /api/completion endpoint with user_id."""
        response = client.post(
            "/api/completion",
            json={"prompt": "Hello"},
            params={"user_id": "test-user-123"}
        )
        
        assert response.status_code == 200
        
        mock_stream_text.assert_called_once()
        args, kwargs = mock_stream_text.call_args
        assert len(args) >= 3
        assert args[2] == "test-user-123"

    def test_chat_endpoint(self, mock_stream_text):
        """Test the /api/chat endpoint."""
        response = client.post(
            "/api/chat",
            json={"messages": [{"role": "user", "content": "Hello"}]}
        )
        
        assert response.status_code == 200
        assert 'x-vercel-ai-data-stream' in response.headers
        
        mock_stream_text.assert_called_once()

    def test_sentiment_analysis_endpoint(self, mock_analyze_sentiment):
        """Test the /api/sentiment endpoint."""
        response = client.post(
            "/api/sentiment",
            json={"messages": [{"role": "user", "content": "I love this product!"}]}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        assert "results" in response_data
        assert len(response_data["results"]) > 0
        assert "sentiment" in response_data["results"][0]
        
        mock_analyze_sentiment.assert_called_once()