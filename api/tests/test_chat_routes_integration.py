import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import FastAPI
from api.index import app

client = TestClient(app)


@pytest.fixture
def mock_stream_text():
    with patch("api.router.v1.chat_route.stream_text") as mock:
        mock.return_value = (item for item in ["Integration", "Test", "Flow", "Response"])
        yield mock


@pytest.fixture
def mock_openai_stream():
    """Mock the OpenAI stream creation to return consistent test data."""
    with patch("api.service.chat_service.create_openai_stream") as mock:
        mock.return_value = MagicMock()
        yield mock


@pytest.fixture
def mock_save_chat_history():
    with patch("api.service.chat_service.save_chat_history") as mock:
        mock.return_value = AsyncMock(return_value=True)
        yield mock


@pytest.fixture
def stream_response_content():
    """Helper fixture to safely get content from streaming responses."""
    def _get_content(response):
        return "".join([chunk for chunk in response.iter_text()])
    
    return _get_content


class TestChatRoutesIntegration:
    
    def test_integration_completion_flow(self, mock_stream_text, mock_save_chat_history, stream_response_content):
        """Test the full completion API flow from request to response."""
        response = client.post(
            "/api/completion",
            json={"prompt": "Test integration flow"},
            params={"protocol": "text"}
        )
        
        assert response.status_code == 200
        content_str = stream_response_content(response)
        
        assert "integration" in content_str.lower(), "Response should contain 'integration'"
        assert "test" in content_str.lower(), "Response should contain 'test'"
        assert "response" in content_str.lower(), "Response should contain 'response'"
        
        mock_stream_text.assert_called_once()
    
    def test_integration_completion_flow_with_mocked_openai(self, mock_openai_stream, mock_save_chat_history):
        """Test the completion flow with a fully mocked OpenAI client."""
        with patch("api.router.v1.chat_route.stream_text") as mock_router_stream:
            mock_router_stream.return_value = (item for item in ["Integration", "Test", "Response"])
            
            response = client.post(
                "/api/completion",
                json={"prompt": "Test integration flow"},
                params={"protocol": "text"}
            )
            
            assert response.status_code == 200
            
            assert 'x-vercel-ai-data-stream' in response.headers
            assert response.headers['x-vercel-ai-data-stream'] == 'v1'
            
            mock_router_stream.assert_called_once()
        
    @pytest.mark.parametrize("protocol", ["text", "data"])
    def test_protocol_handling(self, mock_stream_text, stream_response_content, protocol):
        """Test handling of different protocols."""
        response = client.post(
            "/api/completion",
            json={"prompt": f"Test with {protocol} protocol"},
            params={"protocol": protocol}
        )
        
        assert response.status_code == 200
        
        if protocol == "data":
            assert 'x-vercel-ai-data-stream' in response.headers
            assert response.headers['x-vercel-ai-data-stream'] == 'v1'
        
        mock_stream_text.assert_called_once()
        args, kwargs = mock_stream_text.call_args
        assert args[1] == protocol, f"Expected protocol '{protocol}', got '{args[1]}'"
        
    def test_error_handling(self, stream_response_content):
        """Test error handling in the API."""
        with patch("api.service.chat_service.create_openai_stream", 
                   side_effect=Exception("Test error")):
            try:
                response = client.post(
                    "/api/completion",
                    json={"prompt": "Error test"}
                )
                
                assert response.status_code == 200 or response.status_code >= 400, \
                    f"Expected either 200 (stream error) or error status code, got {response.status_code}"
                
                if response.status_code >= 400:
                    assert "error" in response.json().get("detail", "").lower(), \
                        f"Expected error message in response. Got: {response.json()}"
                else:
                    content_str = stream_response_content(response)
                    assert "error" in content_str.lower() or "test error" in content_str.lower(), \
                        f"Expected error message in response stream. Got: {content_str}"
                        
            except Exception as e:
                pytest.fail(f"The API should handle errors gracefully, but it raised: {str(e)}")
    
    def test_find_stream_text_usage(self):
        """Test to determine where stream_text is being called from."""
        with patch("api.router.v1.chat_route.stream_text") as router_mock, \
             patch("api.service.chat_service.stream_text") as service_mock:
            
            router_mock.return_value = (item for item in ["RouterMock"])
            service_mock.return_value = (item for item in ["ServiceMock"])
            
            response = client.post(
                "/api/completion",
                json={"prompt": "Test to find mock"},
                params={"protocol": "text"}
            )
            
            assert response.status_code == 200
            
            print(f"Router mock called: {router_mock.call_count} times")
            print(f"Service mock called: {service_mock.call_count} times")
            
            assert router_mock.called or service_mock.called, "stream_text was not called at all"