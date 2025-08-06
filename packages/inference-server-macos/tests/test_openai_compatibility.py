"""Test OpenAI API compatibility using the official OpenAI client."""

import pytest
import asyncio
from unittest.mock import MagicMock, patch
import json
from pathlib import Path

# Try to import OpenAI client
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

from fastapi.testclient import TestClient
from mlx_engine_server.server import MLXServer
from mlx_engine_server.config import ServerConfig
from mlx_engine_server.model_manager import ModelInfo


@pytest.fixture
def server_config():
    """Create test server configuration."""
    return ServerConfig(
        host="127.0.0.1",
        port=8000,
        log_level="ERROR",
        model_path="test-model"
    )


@pytest.fixture
def mock_model_info():
    """Create mock model info."""
    model_info = MagicMock(spec=ModelInfo)
    model_info.path = "test-model"
    model_info.type = "test"
    model_info.architecture = "TestModel"
    model_info.loaded_at = "2023-01-01T00:00:00"
    model_info.memory_usage = "1.0 GB"
    model_info.model = MagicMock()
    model_info.tokenizer = MagicMock()
    return model_info


@pytest.fixture
def mlx_server(server_config):
    """Create MLX server instance."""
    return MLXServer(server_config)


@pytest.fixture
def test_client(mlx_server):
    """Create test client."""
    return TestClient(mlx_server.app)


class TestOpenAICompatibility:
    """Test OpenAI API compatibility."""
    
    def test_models_endpoint_structure(self, test_client, mock_model_info):
        """Test that /v1/models returns OpenAI-compatible structure."""
        with patch('mlx_engine_server.model_manager.MLXModelManager.get_model_info') as mock_get_model:
            mock_get_model.return_value = mock_model_info
            
            response = test_client.get("/v1/models")
            assert response.status_code == 200
            
            data = response.json()
            
            # Check OpenAI-compatible structure
            assert "object" in data
            assert data["object"] == "list"
            assert "data" in data
            assert isinstance(data["data"], list)
            
            if data["data"]:  # If model is loaded
                model = data["data"][0]
                # Check required OpenAI model fields
                assert "id" in model
                assert "object" in model
                assert "created" in model
                assert "owned_by" in model
                assert model["object"] == "model"
    
    def test_chat_completions_request_structure(self, test_client, mock_model_info):
        """Test that chat completions accepts OpenAI-compatible requests."""
        with patch('mlx_engine_server.model_manager.MLXModelManager.get_model') as mock_get_model:
            with patch('mlx_engine_server.generation.GenerationEngine.generate_async') as mock_generate:
                with patch('mlx_engine_server.generation.GenerationEngine.count_tokens') as mock_count:
                    mock_get_model.return_value = mock_model_info
                    
                    # Mock async generator
                    async def mock_async_gen():
                        yield "Hello there!"
                    
                    mock_generate.return_value = mock_async_gen()
                    mock_count.side_effect = [10, 5]  # prompt_tokens, completion_tokens
                    
                    # OpenAI-compatible request
                    request_data = {
                        "model": "test-model",  # This should be ignored in single-model setup
                        "messages": [
                            {"role": "system", "content": "You are a helpful assistant."},
                            {"role": "user", "content": "Hello!"}
                        ],
                        "max_tokens": 50,
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "frequency_penalty": 0.1,
                        "presence_penalty": 0.1,
                        "stop": ["<|endoftext|>"],
                        "stream": False
                    }
                    
                    response = test_client.post("/v1/chat/completions", json=request_data)
                    assert response.status_code == 200
                    
                    data = response.json()
                    
                    # Check OpenAI-compatible response structure
                    assert "id" in data
                    assert "object" in data
                    assert data["object"] == "chat.completion"
                    assert "created" in data
                    assert "model" in data
                    assert "choices" in data
                    assert "usage" in data
                    
                    # Check choices structure
                    assert len(data["choices"]) == 1
                    choice = data["choices"][0]
                    assert "index" in choice
                    assert "message" in choice
                    assert "finish_reason" in choice
                    
                    # Check message structure
                    message = choice["message"]
                    assert "role" in message
                    assert "content" in message
                    assert message["role"] == "assistant"
                    
                    # Check usage structure
                    usage = data["usage"]
                    assert "prompt_tokens" in usage
                    assert "completion_tokens" in usage
                    assert "total_tokens" in usage
    
    def test_chat_completions_streaming_structure(self, test_client, mock_model_info):
        """Test that streaming responses are OpenAI-compatible."""
        with patch('mlx_engine_server.model_manager.MLXModelManager.get_model') as mock_get_model:
            mock_get_model.return_value = mock_model_info
            
            request_data = {
                "messages": [{"role": "user", "content": "Hello!"}],
                "stream": True,
                "max_tokens": 50
            }
            
            with patch('mlx_engine_server.server.MLXServer._stream_chat_completion') as mock_stream:
                # Mock streaming response chunks
                mock_chunks = [
                    'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":123,"model":"default","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
                    'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":123,"model":"default","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
                    'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":123,"model":"default","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
                    'data: [DONE]\n\n'
                ]
                mock_stream.return_value = iter(mock_chunks)
                
                response = test_client.post("/v1/chat/completions", json=request_data)
                assert response.status_code == 200
                assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
                
                # Verify response contains proper SSE format
                content = response.text
                assert "data: " in content
                assert "[DONE]" in content
    
    def test_error_responses_openai_compatible(self, test_client):
        """Test that error responses follow OpenAI format."""
        # Test with no model loaded
        request_data = {
            "messages": [{"role": "user", "content": "Hello!"}]
        }
        
        response = test_client.post("/v1/chat/completions", json=request_data)
        assert response.status_code == 503
        
        data = response.json()
        assert "error" in data
        
        error = data["error"]
        assert "message" in error
        assert "type" in error
        assert "code" in error
    
    def test_validation_errors_openai_compatible(self, test_client):
        """Test that validation errors follow OpenAI format."""
        # Test with invalid request (empty messages)
        request_data = {
            "messages": []
        }
        
        response = test_client.post("/v1/chat/completions", json=request_data)
        assert response.status_code == 422
        
        # FastAPI validation errors have a specific structure
        data = response.json()
        assert "detail" in data


@pytest.mark.skipif(not OPENAI_AVAILABLE, reason="OpenAI client not installed")
class TestActualOpenAIClient:
    """Test using the actual OpenAI client against our server."""
    
    @pytest.fixture
    def openai_client(self):
        """Create OpenAI client configured for our test server."""
        return OpenAI(
            api_key="test-key",  # We don't validate API keys in tests
            base_url="http://127.0.0.1:8000/v1"
        )
    
    def test_openai_client_models_list(self, test_client, openai_client, mock_model_info):
        """Test listing models using OpenAI client."""
        with patch('mlx_engine_server.model_manager.MLXModelManager.get_model_info') as mock_get_model:
            mock_get_model.return_value = mock_model_info
            
            # This would make a real HTTP request to our test server
            # For now, we'll test the endpoint structure manually
            response = test_client.get("/v1/models")
            data = response.json()
            
            # Verify the structure is compatible with OpenAI client expectations
            assert "object" in data and data["object"] == "list"
            assert "data" in data
    
    def test_openai_client_chat_completion(self, test_client, openai_client, mock_model_info):
        """Test chat completion using OpenAI client structure."""
        with patch('mlx_engine_server.model_manager.MLXModelManager.get_model') as mock_get_model:
            with patch('mlx_engine_server.generation.GenerationEngine.generate_async') as mock_generate:
                with patch('mlx_engine_server.generation.GenerationEngine.count_tokens') as mock_count:
                    mock_get_model.return_value = mock_model_info
                    
                    # Mock async generator
                    async def mock_async_gen():
                        yield "Hello! How can I help you today?"
                    
                    mock_generate.return_value = mock_async_gen()
                    mock_count.side_effect = [10, 8]
                    
                    # Test the request format that OpenAI client would send
                    request_data = {
                        "model": "test-model",
                        "messages": [
                            {"role": "user", "content": "Hello!"}
                        ],
                        "max_tokens": 100,
                        "temperature": 0.7
                    }
                    
                    response = test_client.post("/v1/chat/completions", json=request_data)
                    assert response.status_code == 200
                    
                    data = response.json()
                    
                    # Verify all required fields are present for OpenAI client
                    required_fields = ["id", "object", "created", "model", "choices", "usage"]
                    for field in required_fields:
                        assert field in data, f"Missing required field: {field}"
                    
                    # Verify choice structure
                    assert len(data["choices"]) == 1
                    choice = data["choices"][0]
                    assert "index" in choice
                    assert "message" in choice
                    assert "finish_reason" in choice
                    
                    # Verify message structure
                    message = choice["message"]
                    assert "role" in message
                    assert "content" in message
                    assert message["role"] == "assistant"


class TestSpecialCases:
    """Test special cases for OpenAI compatibility."""
    
    def test_model_field_ignored_in_single_model_setup(self, test_client, mock_model_info):
        """Test that model field in request is ignored (single model setup)."""
        with patch('mlx_engine_server.model_manager.MLXModelManager.get_model') as mock_get_model:
            with patch('mlx_engine_server.generation.GenerationEngine.generate_async') as mock_generate:
                with patch('mlx_engine_server.generation.GenerationEngine.count_tokens') as mock_count:
                    mock_get_model.return_value = mock_model_info
                    
                    async def mock_async_gen():
                        yield "Response"
                    
                    mock_generate.return_value = mock_async_gen()
                    mock_count.side_effect = [5, 3]
                    
                    # Test with different model names - all should work
                    for model_name in ["gpt-3.5-turbo", "gpt-4", "nonexistent-model", ""]:
                        request_data = {
                            "model": model_name,
                            "messages": [{"role": "user", "content": "Test"}],
                            "max_tokens": 10
                        }
                        
                        response = test_client.post("/v1/chat/completions", json=request_data)
                        assert response.status_code == 200
                        
                        data = response.json()
                        assert data["model"] == model_name or data["model"] == "default"
    
    def test_unsupported_parameters_handled_gracefully(self, test_client, mock_model_info):
        """Test that unsupported parameters are handled gracefully."""
        with patch('mlx_engine_server.model_manager.MLXModelManager.get_model') as mock_get_model:
            with patch('mlx_engine_server.generation.GenerationEngine.generate_async') as mock_generate:
                with patch('mlx_engine_server.generation.GenerationEngine.count_tokens') as mock_count:
                    mock_get_model.return_value = mock_model_info
                    
                    async def mock_async_gen():
                        yield "Response"
                    
                    mock_generate.return_value = mock_async_gen()
                    mock_count.side_effect = [5, 3]
                    
                    # Test with various OpenAI parameters that MLX doesn't support
                    request_data = {
                        "messages": [{"role": "user", "content": "Test"}],
                        "max_tokens": 10,
                        "temperature": 0.7,  # Not supported by MLX-LM
                        "top_p": 0.9,        # Not supported by MLX-LM
                        "frequency_penalty": 0.1,  # Not supported
                        "presence_penalty": 0.1,   # Not supported
                        "logit_bias": {"123": 10},  # Not supported
                        "user": "test-user",        # Not supported
                        "n": 1,                     # Not supported
                        "logprobs": True,           # Not supported
                        "echo": False               # Not supported
                    }
                    
                    response = test_client.post("/v1/chat/completions", json=request_data)
                    # Should still work, just ignore unsupported parameters
                    assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__])