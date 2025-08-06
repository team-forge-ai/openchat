"""Tests for MLX Model Manager."""

import pytest
from unittest.mock import MagicMock, patch, call
from pathlib import Path
import tempfile
import os

from mlx_engine_server.model_manager import MLXModelManager, ModelInfo
from mlx_engine_server.utils import validate_model_path
from mlx_engine_server.config import ServerConfig


@pytest.fixture
def config():
    """Create test configuration."""
    return ServerConfig(
        model_path="test/model/path",
        log_level="ERROR"
    )


@pytest.fixture
def model_manager():
    """Create model manager instance."""
    return MLXModelManager()


@pytest.fixture
def mock_model_and_tokenizer():
    """Create mock model and tokenizer."""
    model = MagicMock()
    tokenizer = MagicMock()
    tokenizer.decode.return_value = "decoded text"
    tokenizer.encode.return_value = [1, 2, 3, 4, 5]
    tokenizer.apply_chat_template.return_value = "formatted chat"
    return model, tokenizer


class TestModelInfo:
    """Test ModelInfo class."""
    
    def test_model_info_creation(self):
        """Test creating ModelInfo."""
        from datetime import datetime
        from pathlib import Path
        
        info = ModelInfo(
            model_path=Path("test/path"),
            model=MagicMock(),
            tokenizer=MagicMock(),
            model_type="test",
            architecture="TestArch",
            tokenizer_config={"test": "config"},
            chat_template=None,
            loaded_at=datetime.now()
        )
        
        assert str(info.model_path) == "test/path"
        assert info.model_type == "test"
        assert info.architecture == "TestArch"
        assert info.tokenizer_config == {"test": "config"}
        assert info.loaded_at is not None


class TestMLXModelManager:
    """Test MLX Model Manager."""
    
    def test_initialization(self, model_manager):
        """Test model manager initialization."""
        assert model_manager.model_info is None
        assert model_manager.system_monitor is not None
    
    @patch('mlx_engine_server.model_manager.detect_model_type')
    @patch('mlx_engine_server.model_manager.load')
    @patch('mlx_engine_server.model_manager.validate_model_path')
    @patch('mlx_engine_server.model_manager.Path.is_dir')
    @patch('mlx_engine_server.model_manager.Path.exists')
    def test_load_model_success(self, mock_exists, mock_is_dir, mock_validate, mock_load, mock_detect, model_manager, mock_model_and_tokenizer):
        """Test successful model loading."""
        # Setup mocks
        mock_exists.return_value = True
        mock_is_dir.return_value = True
        mock_validate.return_value = True
        mock_load.return_value = mock_model_and_tokenizer
        mock_detect.return_value = {"type": "test", "architecture": "TestArch", "tokenizer_config": {}, "chat_template": None}
        
        # Load model
        success, message = model_manager.load_model("test/model/path")
        
        assert success is True
        assert "successfully" in message.lower()
        assert model_manager.model_info is not None
        assert str(model_manager.model_info.model_path) == "test/model/path"
        
        # Verify load was called correctly
        mock_load.assert_called_once()
    
    @patch('mlx_engine_server.model_manager.Path.exists')
    def test_load_model_path_not_exists(self, mock_exists, model_manager):
        """Test loading model with non-existent path."""
        mock_exists.return_value = False
        
        success, message = model_manager.load_model("nonexistent/path")
        
        assert success is False
        assert "does not exist" in message
        assert model_manager.model_info is None
    
    @patch('mlx_engine_server.model_manager.Path.is_dir')
    @patch('mlx_engine_server.model_manager.Path.exists')
    def test_load_model_not_directory(self, mock_exists, mock_is_dir, model_manager):
        """Test loading model with file instead of directory."""
        mock_exists.return_value = True
        mock_is_dir.return_value = False
        
        success, message = model_manager.load_model("test/file.txt")
        
        assert success is False
        assert "must be a directory" in message
        assert model_manager.model_info is None
    
    @patch('mlx_engine_server.model_manager.detect_model_type')
    @patch('mlx_engine_server.model_manager.load')
    @patch('mlx_engine_server.model_manager.validate_model_path')
    @patch('mlx_engine_server.model_manager.Path.is_dir')
    @patch('mlx_engine_server.model_manager.Path.exists')
    def test_load_model_already_loaded(self, mock_exists, mock_is_dir, mock_validate, mock_load, mock_detect, model_manager, mock_model_and_tokenizer):
        """Test loading model when one is already loaded."""
        # Setup mocks
        mock_exists.return_value = True
        mock_is_dir.return_value = True
        mock_validate.return_value = True
        mock_load.return_value = mock_model_and_tokenizer
        mock_detect.return_value = {"type": "test", "architecture": "TestArch", "tokenizer_config": {}, "chat_template": None}
        
        # Load first model
        model_manager.load_model("test/model/path1")
        
        # Try to load second model
        success, message = model_manager.load_model("test/model/path2")
        
        assert success is False
        assert "already loaded" in message
        assert str(model_manager.model_info.model_path) == "test/model/path1"  # Still first model
    
    @patch('mlx_engine_server.model_manager.detect_model_type')
    @patch('mlx_engine_server.model_manager.load')
    @patch('mlx_engine_server.model_manager.validate_model_path')
    @patch('mlx_engine_server.model_manager.Path.is_dir')
    @patch('mlx_engine_server.model_manager.Path.exists')
    def test_load_model_with_exception(self, mock_exists, mock_is_dir, mock_validate, mock_load, mock_detect, model_manager):
        """Test model loading with exception."""
        mock_exists.return_value = True
        mock_is_dir.return_value = True
        mock_validate.return_value = True
        mock_detect.return_value = {"type": "test", "architecture": "TestArch", "tokenizer_config": {}, "chat_template": None}
        mock_load.side_effect = Exception("Load failed")
        
        success, message = model_manager.load_model("test/model/path")
        
        assert success is False
        assert "Load failed" in message
        assert model_manager.model_info is None
    
    def test_get_model_no_model_loaded(self, model_manager):
        """Test getting model when none is loaded."""
        result = model_manager.get_model()
        assert result is None
    
    @patch('mlx_engine_server.model_manager.detect_model_type')
    @patch('mlx_engine_server.model_manager.load')
    @patch('mlx_engine_server.model_manager.validate_model_path')
    @patch('mlx_engine_server.model_manager.Path.is_dir')
    @patch('mlx_engine_server.model_manager.Path.exists')
    def test_get_model_with_loaded_model(self, mock_exists, mock_is_dir, mock_validate, mock_load, mock_detect, model_manager, mock_model_and_tokenizer):
        """Test getting model when one is loaded."""
        # Setup and load model
        mock_exists.return_value = True
        mock_is_dir.return_value = True
        mock_validate.return_value = True
        mock_load.return_value = mock_model_and_tokenizer
        mock_detect.return_value = {"type": "test", "architecture": "TestArch", "tokenizer_config": {}, "chat_template": None}
        
        model_manager.load_model("test/model/path")
        result = model_manager.get_model()
        
        assert result is not None
        assert result == model_manager.model_info
    
    def test_get_model_info_no_model(self, model_manager):
        """Test getting model info when no model is loaded."""
        result = model_manager.get_model_info()
        assert result is None
    
    def test_get_status_no_model(self, model_manager):
        """Test getting status when no model is loaded."""
        status = model_manager.get_status()
        
        assert status["model_loaded"] is False
        assert status["model_info"] is None
    
    @patch('mlx_engine_server.model_manager.detect_model_type')
    @patch('mlx_engine_server.model_manager.load')
    @patch('mlx_engine_server.model_manager.validate_model_path')
    @patch('mlx_engine_server.model_manager.Path.is_dir')
    @patch('mlx_engine_server.model_manager.Path.exists')
    def test_get_status_with_model(self, mock_exists, mock_is_dir, mock_validate, mock_load, mock_detect, model_manager, mock_model_and_tokenizer):
        """Test getting status when model is loaded."""
        # Setup and load model
        mock_exists.return_value = True
        mock_is_dir.return_value = True
        mock_validate.return_value = True
        mock_load.return_value = mock_model_and_tokenizer
        mock_detect.return_value = {"type": "test", "architecture": "TestArch", "tokenizer_config": {}, "chat_template": None}
        
        model_manager.load_model("test/model/path")
        status = model_manager.get_status()
        
        assert status["model_loaded"] is True
        assert status["model_info"] is not None
        assert status["model_info"]["path"] == "test/model/path"
    
    def test_format_chat_template_no_model(self, model_manager):
        """Test formatting chat template when no model is loaded."""
        messages = [{"role": "user", "content": "Hello"}]
        
        with pytest.raises(ValueError, match="No model loaded"):
            model_manager.format_chat_template(messages)
    
    @patch('mlx_engine_server.model_manager.detect_model_type')
    @patch('mlx_engine_server.model_manager.load')
    @patch('mlx_engine_server.model_manager.validate_model_path')
    @patch('mlx_engine_server.model_manager.Path.is_dir')
    @patch('mlx_engine_server.model_manager.Path.exists')
    def test_format_chat_template_with_model(self, mock_exists, mock_is_dir, mock_validate, mock_load, mock_detect, model_manager, mock_model_and_tokenizer):
        """Test formatting chat template with loaded model."""
        # Setup and load model
        mock_exists.return_value = True
        mock_is_dir.return_value = True
        mock_validate.return_value = True
        mock_load.return_value = mock_model_and_tokenizer
        mock_detect.return_value = {"type": "test", "architecture": "TestArch", "tokenizer_config": {}, "chat_template": None}
        
        model_manager.load_model("test/model/path")
        messages = [{"role": "user", "content": "Hello"}]
        
        result = model_manager.format_chat_template(messages)
        
        # Should use tokenizer's apply_chat_template
        mock_model_and_tokenizer[1].apply_chat_template.assert_called_once()
        assert result == "formatted chat"
    
    @patch('mlx_engine_server.model_manager.detect_model_type')
    @patch('mlx_engine_server.model_manager.load')
    @patch('mlx_engine_server.model_manager.validate_model_path')
    @patch('mlx_engine_server.model_manager.Path.is_dir')
    @patch('mlx_engine_server.model_manager.Path.exists')
    def test_cleanup(self, mock_exists, mock_is_dir, mock_validate, mock_load, mock_detect, model_manager, mock_model_and_tokenizer):
        """Test model cleanup."""
        # Setup and load model
        mock_exists.return_value = True
        mock_is_dir.return_value = True
        mock_validate.return_value = True
        mock_load.return_value = mock_model_and_tokenizer
        mock_detect.return_value = {"type": "test", "architecture": "TestArch", "tokenizer_config": {}, "chat_template": None}
        
        model_manager.load_model("test/model/path")
        assert model_manager.model_info is not None
        
        # Cleanup
        model_manager.cleanup()
        assert model_manager.model_info is None


class TestModelDetection:
    """Test model type detection."""
    
    @patch('mlx_engine_server.utils.Path.exists')
    def test_detect_model_type_qwen(self, mock_exists):
        """Test detecting Qwen model type."""
        from mlx_engine_server.utils import detect_model_type
        
        # Mock config.json content
        config_content = {"model_type": "qwen2", "architectures": ["Qwen2ForCausalLM"]}
        
        with patch('builtins.open', create=True) as mock_open:
            with patch('json.load', return_value=config_content):
                mock_exists.return_value = True
                result = detect_model_type("test/path")
                
                assert result["type"] == "qwen"
                assert result["architecture"] == "Qwen2ForCausalLM"
    
    @patch('mlx_engine_server.utils.Path.exists')
    def test_detect_model_type_llama(self, mock_exists):
        """Test detecting Llama model type."""
        from mlx_engine_server.utils import detect_model_type
        
        config_content = {"model_type": "llama", "architectures": ["LlamaForCausalLM"]}
        
        with patch('builtins.open', create=True):
            with patch('json.load', return_value=config_content):
                mock_exists.return_value = True
                result = detect_model_type("test/path")
                
                assert result["type"] == "llama"
                assert result["architecture"] == "LlamaForCausalLM"
    
    @patch('mlx_engine_server.utils.Path.exists')
    def test_detect_model_type_no_config(self, mock_exists):
        """Test detecting model type when config.json doesn't exist."""
        from mlx_engine_server.utils import detect_model_type
        
        mock_exists.return_value = False
        
        result = detect_model_type("test/path")
        
        assert result["type"] == "unknown"
        assert result["architecture"] is None
    
    @patch('mlx_engine_server.utils.Path.exists')
    def test_detect_model_type_invalid_json(self, mock_exists):
        """Test detecting model type with invalid JSON."""
        from mlx_engine_server.utils import detect_model_type
        
        mock_exists.return_value = True
        
        with patch('builtins.open', create=True):
            with patch('json.load', side_effect=Exception("Invalid JSON")):
                result = detect_model_type("test/path")
                
                assert result["type"] == "unknown"
                assert result["architecture"] is None


if __name__ == "__main__":
    pytest.main([__file__])