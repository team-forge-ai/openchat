"""Tests for API endpoints."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import json

from mlx_engine_server.config import ServerConfig
from mlx_engine_server.server import MLXServer
from mlx_engine_server.api_models import ChatCompletionRequest, ChatMessage


@pytest.fixture
def server_config():
    """Create test server configuration."""
    return ServerConfig(
        host="127.0.0.1",
        port=8000,
        log_level="ERROR",
        max_loaded_models=1
    )


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
    
    def test_get_model_not_found(self, test_client):
        """Test getting non-existent model."""
        response = test_client.get("/v1/models/non-existent")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
    
    @patch('mlx_engine_server.model_manager.MLXModelManager.load_model')
    def test_load_model(self, mock_load, test_client):
        """Test loading a model."""
        mock_load.return_value = (True, "Model loaded successfully")
        
        response = test_client.post(
            "/v1/mlx/models/load",
            json={
                "model_path": "/path/to/model",
                "model_id": "test-model"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "message" in data
    
    @patch('mlx_engine_server.model_manager.MLXModelManager.load_model')
    def test_load_model_failure(self, mock_load, test_client):
        """Test failed model loading."""
        mock_load.return_value = (False, "Failed to load model")
        
        response = test_client.post(
            "/v1/mlx/models/load",
            json={
                "model_path": "/invalid/path",
                "model_id": "test-model"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "error" in data


class TestChatCompletionEndpoint:
    """Test chat completion endpoint."""
    
    @patch('mlx_engine_server.model_manager.MLXModelManager.get_model')
    @patch('mlx_engine_server.generation.GenerationEngine.generate_async')
    def test_chat_completion_basic(self, mock_generate, mock_get_model, test_client):
        """Test basic chat completion."""
        # Mock model
        mock_model_info = MagicMock()
        mock_model_info.model = MagicMock()
        mock_model_info.tokenizer = MagicMock()
        mock_get_model.return_value = mock_model_info
        
        # Mock generation
        mock_generate.return_value = "This is a test response."
        
        # Mock token counting
        with patch('mlx_engine_server.generation.GenerationEngine.count_tokens') as mock_count:
            mock_count.return_value = 10
            
            response = test_client.post(
                "/v1/chat/completions",
                json={
                    "model": "test-model",
                    "messages": [
                        {"role": "user", "content": "Hello!"}
                    ],
                    "max_tokens": 50
                }
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["object"] == "chat.completion"
        assert len(data["choices"]) == 1
        assert data["choices"][0]["message"]["content"] == "This is a test response."
        assert "usage" in data
    
    def test_chat_completion_no_model(self, test_client):
        """Test chat completion with no model loaded."""
        response = test_client.post(
            "/v1/chat/completions",
            json={
                "model": "non-existent",
                "messages": [
                    {"role": "user", "content": "Hello!"}
                ]
            }
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
    
    def test_chat_completion_invalid_request(self, test_client):
        """Test chat completion with invalid request."""
        response = test_client.post(
            "/v1/chat/completions",
            json={
                "model": "test-model",
                # Missing messages
            }
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
    
    @patch('mlx_engine_server.model_manager.MLXModelManager.get_model')
    @patch('mlx_engine_server.generation.GenerationEngine.generate_async')
    async def test_chat_completion_streaming(self, mock_generate, mock_get_model, test_client):
        """Test streaming chat completion."""
        # Mock model
        mock_model_info = MagicMock()
        mock_model_info.model = MagicMock()
        mock_model_info.tokenizer = MagicMock()
        mock_get_model.return_value = mock_model_info
        
        # Mock streaming generation
        async def mock_stream():
            chunks = ["This ", "is ", "a ", "test."]
            for chunk in chunks:
                yield chunk
        
        mock_generate.return_value = mock_stream()
        
        response = test_client.post(
            "/v1/chat/completions",
            json={
                "model": "test-model",
                "messages": [
                    {"role": "user", "content": "Hello!"}
                ],
                "stream": True
            },
            stream=True
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"


class TestServerStatus:
    """Test server status endpoint."""
    
    def test_server_status(self, test_client):
        """Test getting server status."""
        response = test_client.get("/v1/mlx/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "models_loaded" in data
        assert "memory_usage" in data
        assert "cpu_usage" in data
        assert "gpu_usage" in data
        assert "uptime" in data


class TestErrorHandling:
    """Test error handling."""
    
    def test_404_error(self, test_client):
        """Test 404 error handling."""
        response = test_client.get("/non-existent-endpoint")
        assert response.status_code == 404
    
    def test_method_not_allowed(self, test_client):
        """Test method not allowed error."""
        response = test_client.get("/v1/chat/completions")
        assert response.status_code == 405
    
    @patch('mlx_engine_server.model_manager.MLXModelManager.get_model')
    @patch('mlx_engine_server.generation.GenerationEngine.generate_async')
    def test_internal_server_error(self, mock_generate, mock_get_model, test_client):
        """Test internal server error handling."""
        # Mock model
        mock_model_info = MagicMock()
        mock_get_model.return_value = mock_model_info
        
        # Mock generation to raise exception
        mock_generate.side_effect = Exception("Test error")
        
        response = test_client.post(
            "/v1/chat/completions",
            json={
                "model": "test-model",
                "messages": [
                    {"role": "user", "content": "Hello!"}
                ]
            }
        )
        
        assert response.status_code == 500
        data = response.json()
        assert "error" in data