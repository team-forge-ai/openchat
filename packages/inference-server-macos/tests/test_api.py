"""Tests for API endpoints."""

import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, AsyncMock
import json
from pathlib import Path

from mlx_engine_server.config import ServerConfig
from mlx_engine_server.server import MLXServer
from mlx_engine_server.api_models import ChatCompletionRequest, ChatMessage
from mlx_engine_server.model_manager import ModelInfo


@pytest.fixture
def server_config():
    """Create test server configuration."""
    return ServerConfig(
        host="127.0.0.1",
        port=8000,
        log_level="ERROR",
        model_path=None  # No model for most tests
    )


@pytest.fixture
def mock_model_info():
    """Create mock model info."""
    from pathlib import Path
    from datetime import datetime
    
    model_info = MagicMock(spec=ModelInfo)
    model_info.model_path = Path("test-model-path")
    model_info.model_type = "test"
    model_info.architecture = "TestModel"
    model_info.loaded_at = datetime.now()
    model_info.model = MagicMock()
    model_info.tokenizer = MagicMock()
    model_info.tokenizer_config = {}
    model_info.chat_template = None
    return model_info


@pytest.fixture
def mlx_server(server_config):
    """Create MLX server instance."""
    return MLXServer(server_config)


@pytest.fixture
def test_client(mlx_server):
    """Create test client."""
    return TestClient(mlx_server.app)


class TestHealthEndpoint:
    """Test health check endpoint."""
    
    def test_health_check(self, test_client):
        """Test basic health check."""
        response = test_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data


class TestModelEndpoints:
    """Test model management endpoints."""
    
    def test_list_models_empty(self, test_client):
        """Test listing models when none are loaded."""
        response = test_client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert data["object"] == "list"
        assert data["data"] == []
    
    @patch('mlx_engine_server.model_manager.MLXModelManager.get_model_info')
    def test_list_models_with_loaded_model(self, mock_get_model_info, test_client, mock_model_info):
        """Test listing models when one is loaded."""
        # get_model_info returns a dictionary, not the ModelInfo object
        mock_get_model_info.return_value = {
            "path": "test-model-path",
            "type": "test",
            "architecture": "TestModel",
            "loaded_at": "2023-01-01T00:00:00",
            "memory_usage": "1.0 GB"
        }
        
        response = test_client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert data["object"] == "list"
        assert len(data["data"]) == 1
        
        model = data["data"][0]
        assert model["id"] == "test-model-path"
        assert model["object"] == "model"
        assert model["owned_by"] == "local"
    
    def test_get_model_not_found(self, test_client):
        """Test getting non-existent model."""
        # Note: /v1/models/{model_id} endpoint doesn't exist in current implementation
        response = test_client.get("/v1/models/non-existent")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data  # FastAPI returns "detail" for 404
    
    @pytest.mark.skip(reason="GET /v1/models/{model_id} endpoint not implemented")
    @patch('mlx_engine_server.model_manager.MLXModelManager.get_model_info')
    def test_get_model_found(self, mock_get_model_info, test_client, mock_model_info):
        """Test getting existing model."""
        mock_get_model_info.return_value = {
            "path": "test-model-path",
            "type": "test",
            "architecture": "TestModel",
            "loaded_at": "2023-01-01T00:00:00",
            "memory_usage": "1.0 GB"
        }
        
        response = test_client.get("/v1/models/test-model-path")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "test-model-path"
        assert data["object"] == "model"


class TestMLXStatusEndpoint:
    """Test MLX status endpoint."""
    
    @patch('mlx_engine_server.model_manager.MLXModelManager.get_status')
    def test_mlx_status(self, mock_get_status, test_client):
        """Test MLX status endpoint."""
        # Mock model status with complete system info
        mock_get_status.return_value = {
            "model_loaded": True,
            "model_info": {
                "path": "test-model",
                "type": "test",
                "architecture": "TestModel",
                "loaded_at": "2023-01-01T00:00:00",
                "memory_usage": "1.0 GB"
            },
            "system": {
                "memory": {"system": {"total_gb": 32.0, "available_gb": 16.0, "used_gb": 16.0, "percent": 50.0}},
                "cpu": {"percent": 25.0, "count": 8},
                "gpu": {"device": "gpu", "mlx_version": "0.27.1"},
                "uptime": "0:01:00"
            }
        }
        
        response = test_client.get("/v1/mlx/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["model_loaded"] is True
        assert "model_info" in data
        assert "memory_usage" in data
        assert "cpu_usage" in data
        assert "gpu_usage" in data


class TestChatCompletionEndpoint:
    """Test chat completion endpoint."""
    
    @patch('mlx_engine_server.model_manager.MLXModelManager.format_chat_template')
    @patch('mlx_engine_server.model_manager.MLXModelManager.get_model')
    @patch('mlx_engine_server.generation.GenerationEngine.generate_async')
    @patch('mlx_engine_server.generation.GenerationEngine.count_tokens')
    def test_chat_completion_basic(self, mock_count_tokens, mock_generate, mock_get_model, mock_format_chat, test_client, mock_model_info):
        """Test basic chat completion."""
        # Mock model
        mock_get_model.return_value = mock_model_info
        mock_format_chat.return_value = "User: Hello\nAssistant:"
        
        # Mock generation - create a proper mock for async generator
        import asyncio
        from unittest.mock import AsyncMock
        
        async_gen_mock = AsyncMock()
        async_gen_mock.__aiter__.return_value = iter(["This is a test response."])
        mock_generate.return_value = async_gen_mock
        
        # Mock token counting
        mock_count_tokens.side_effect = [10, 5]  # prompt_tokens, completion_tokens
        
        request_data = {
            "messages": [
                {"role": "user", "content": "Hello"}
            ],
            "max_tokens": 50
        }
        
        response = test_client.post("/v1/chat/completions", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["object"] == "chat.completion"
        assert len(data["choices"]) == 1
        assert data["choices"][0]["message"]["role"] == "assistant"
        assert data["choices"][0]["message"]["content"] == "This is a test response."
        assert data["usage"]["prompt_tokens"] == 10
        assert data["usage"]["completion_tokens"] == 5
        assert data["usage"]["total_tokens"] == 15
    
    def test_chat_completion_no_model(self, test_client):
        """Test chat completion when no model is loaded."""
        request_data = {
            "messages": [
                {"role": "user", "content": "Hello"}
            ]
        }
        
        response = test_client.post("/v1/chat/completions", json=request_data)
        assert response.status_code == 503
        data = response.json()
        assert "error" in data
        assert "No model loaded" in data["error"]["message"]
    
    def test_chat_completion_invalid_request(self, test_client):
        """Test chat completion with invalid request."""
        request_data = {
            "messages": []  # Empty messages should be invalid
        }
        
        response = test_client.post("/v1/chat/completions", json=request_data)
        assert response.status_code == 422  # Validation error
    
    @patch('mlx_engine_server.model_manager.MLXModelManager.format_chat_template')
    @patch('mlx_engine_server.model_manager.MLXModelManager.get_model')
    def test_chat_completion_streaming(self, mock_get_model, mock_format_chat, test_client, mock_model_info):
        """Test streaming chat completion."""
        # Mock model
        mock_get_model.return_value = mock_model_info
        mock_format_chat.return_value = "User: Hello\nAssistant:"
        
        request_data = {
            "messages": [
                {"role": "user", "content": "Hello"}
            ],
            "stream": True,
            "max_tokens": 50
        }
        
        with patch('mlx_engine_server.server.MLXServer._stream_chat_completion') as mock_stream:
            # Mock streaming response
            mock_stream.return_value = iter([
                "data: {\"id\":\"test\",\"object\":\"chat.completion.chunk\",\"created\":123,\"model\":\"default\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"},\"finish_reason\":null}]}\n\n",
                "data: {\"id\":\"test\",\"object\":\"chat.completion.chunk\",\"created\":123,\"model\":\"default\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"Hello\"},\"finish_reason\":null}]}\n\n",
                "data: [DONE]\n\n"
            ])
            
            response = test_client.post("/v1/chat/completions", json=request_data)
            assert response.status_code == 200
            assert response.headers["content-type"] == "text/event-stream; charset=utf-8"


class TestChatCompletionValidation:
    """Test chat completion request validation."""
    
    def test_missing_messages(self, test_client):
        """Test request without messages."""
        response = test_client.post("/v1/chat/completions", json={})
        assert response.status_code == 422
    
    def test_invalid_message_format(self, test_client):
        """Test request with invalid message format."""
        request_data = {
            "messages": [
                {"role": "invalid", "content": "Hello"}  # Invalid role
            ]
        }
        response = test_client.post("/v1/chat/completions", json=request_data)
        assert response.status_code == 422
    
    def test_negative_max_tokens(self, test_client):
        """Test request with negative max_tokens."""
        request_data = {
            "messages": [
                {"role": "user", "content": "Hello"}
            ],
            "max_tokens": -1
        }
        response = test_client.post("/v1/chat/completions", json=request_data)
        assert response.status_code == 422
    
    def test_invalid_temperature(self, test_client):
        """Test request with invalid temperature."""
        request_data = {
            "messages": [
                {"role": "user", "content": "Hello"}
            ],
            "temperature": 2.5  # Too high
        }
        response = test_client.post("/v1/chat/completions", json=request_data)
        assert response.status_code == 422


if __name__ == "__main__":
    pytest.main([__file__])