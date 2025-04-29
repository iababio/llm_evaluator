import pytest
import uuid
import random
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from fastapi import FastAPI, Query, Request, Depends
from api.router.v1.chat_route import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)

TEST_VARIANTS = ["control", "variant_a", "variant_b"]
TEST_WEIGHTS = [0.33, 0.33, 0.34]  # Total must be 1.0


def get_random_variant():
    """Returns a random test variant based on weights."""
    return random.choices(TEST_VARIANTS, weights=TEST_WEIGHTS, k=1)[0]


def get_deterministic_variant(user_id: str):
    """Consistently assigns a user to a test variant based on their ID."""
    user_hash = hash(user_id) % 100
    
    if user_hash < 33:
        return "control"
    elif user_hash < 66:
        return "variant_a"
    else:
        return "variant_b"


@pytest.fixture
def ab_test_app():
    """Setup a FastAPI app with A/B testing routes."""
    test_app = FastAPI()
    
    @test_app.post("/api/ab_test/completion")
    async def ab_test_completion(request: Request, user_id: str = Query(None)):
        """A/B test endpoint for chat completions."""
        json_data = await request.json()
        
        variant = get_deterministic_variant(user_id) if user_id else get_random_variant()
        
        response_headers = {"X-Test-Variant": variant}
        
        if variant == "control":
            with patch("api.service.chat_service.stream_text") as mock:
                mock.return_value = (item for item in ["Control", "Standard", "Response"])
                response = StreamingResponse(
                    mock.return_value,
                    media_type="text/event-stream"
                )
        
        elif variant == "variant_a":
            with patch("api.service.chat_service.stream_text") as mock:
                mock.return_value = (item for item in ["Variant A", "Alternative", "Model", "Response"])
                response = StreamingResponse(
                    mock.return_value,
                    media_type="text/event-stream"
                )
        
        else:  # variant_b
            with patch("api.service.chat_service.stream_text") as mock:
                enhanced_prompt = json_data.get("prompt", "") + " [Enhanced with special instructions]"
                json_data["prompt"] = enhanced_prompt
                
                mock.return_value = (item for item in ["Variant B", "Enhanced", "Prompt", "Response"])
                response = StreamingResponse(
                    mock.return_value,
                    media_type="text/event-stream"
                )
        
        for k, v in response_headers.items():
            response.headers[k] = v
        
        return response
    
    from fastapi.responses import StreamingResponse
    
    return TestClient(test_app)


class TestABFeatures:
    
    def test_variant_assignment(self):
        """Test that variants are assigned properly."""
        variants = {get_random_variant() for _ in range(100)}
        assert len(variants) > 1  # Should have multiple variants
        
        user_id = str(uuid.uuid4())
        variant1 = get_deterministic_variant(user_id)
        variant2 = get_deterministic_variant(user_id)
        assert variant1 == variant2  # Same user should get same variant
        
        user_variants = {get_deterministic_variant(str(uuid.uuid4())) 
                         for _ in range(100)}
        assert len(user_variants) > 1  # Should have assigned different variants
    
    def test_ab_completion_endpoints(self, ab_test_app):
        """Test the A/B test completion endpoints with different user IDs."""
        user_id = "test-user-123"
        
        response = ab_test_app.post(
            "/api/ab_test/completion",
            json={"prompt": "Hello, A/B test"},
            params={"user_id": user_id}
        )
        
        assert response.status_code == 200
        assert "X-Test-Variant" in response.headers
        variant = response.headers["X-Test-Variant"]
        assert variant in TEST_VARIANTS
        
        response2 = ab_test_app.post(
            "/api/ab_test/completion",
            json={"prompt": "Hello again, A/B test"},
            params={"user_id": user_id}
        )
        
        assert response2.headers["X-Test-Variant"] == variant
    
    def test_different_variants_behavior(self, ab_test_app):
        """Test that different variants produce different behavior."""
        
        responses = []
        variant_counts = {variant: 0 for variant in TEST_VARIANTS}
        
        for i in range(30):  # Try multiple users to ensure we hit all variants
            test_user_id = f"test-user-ab-{i}"
            response = ab_test_app.post(
                "/api/ab_test/completion",
                json={"prompt": "Test A/B variants"},
                params={"user_id": test_user_id}
            )
            
            if response.status_code == 200:
                variant = response.headers.get("X-Test-Variant")
                if variant:
                    variant_counts[variant] = variant_counts.get(variant, 0) + 1
                    
                content = "".join([chunk for chunk in response.iter_text()])
                responses.append((variant, content))
        
        print(f"Variant distribution in test: {variant_counts}")
        
        variant_responses = {}
        for variant, content in responses:
            if variant not in variant_responses:
                variant_responses[variant] = []
            variant_responses[variant].append(content)
        
        assert len(variant_responses) >= 2, f"Expected at least 2 variants, got {list(variant_responses.keys())}"
        
        response_sets = list(variant_responses.values())
        if len(response_sets) >= 2:
            assert response_sets[0] != response_sets[1], "Different variants should produce different outputs"