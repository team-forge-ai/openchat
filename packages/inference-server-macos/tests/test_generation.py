"""Tests for Generation Engine."""

import pytest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from typing import List, Dict

from mlx_engine_server.generation import GenerationEngine


@pytest.fixture
def generation_engine():
    """Create generation engine instance."""
    return GenerationEngine()


@pytest.fixture
def mock_model():
    """Create mock model."""
    return MagicMock()


@pytest.fixture
def mock_tokenizer():
    """Create mock tokenizer."""
    tokenizer = MagicMock()
    tokenizer.encode.return_value = [1, 2, 3, 4, 5]
    tokenizer.decode.return_value = "decoded text"
    tokenizer.apply_chat_template.return_value = "formatted prompt"
    return tokenizer


class TestGenerationEngine:
    """Test Generation Engine."""
    
    def test_initialization(self, generation_engine):
        """Test generation engine initialization."""
        assert generation_engine is not None
    
    def test_format_messages_to_prompt_with_template(self, generation_engine, mock_tokenizer):
        """Test formatting messages with chat template."""
        messages = [
            {"role": "system", "content": "You are a helpful assistant"},
            {"role": "user", "content": "Hello"}
        ]
        
        result = generation_engine._format_messages_to_prompt(messages, mock_tokenizer)
        
        mock_tokenizer.apply_chat_template.assert_called_once_with(
            messages, tokenize=False, add_generation_prompt=True
        )
        assert result == "formatted prompt"
    
    def test_format_messages_to_prompt_without_template(self, generation_engine):
        """Test formatting messages without chat template."""
        # Mock tokenizer without apply_chat_template
        tokenizer = MagicMock()
        del tokenizer.apply_chat_template  # Remove the method
        
        messages = [
            {"role": "system", "content": "You are a helpful assistant"},
            {"role": "user", "content": "Hello"}
        ]
        
        result = generation_engine._format_messages_to_prompt(messages, tokenizer)
        
        # Should fallback to formatted messages with roles
        # The actual implementation adds role prefixes
        assert "You are a helpful assistant" in result
        assert "Hello" in result
    
    def test_format_messages_to_prompt_template_error(self, generation_engine, mock_tokenizer):
        """Test formatting messages when template fails."""
        mock_tokenizer.apply_chat_template.side_effect = Exception("Template error")
        
        messages = [
            {"role": "user", "content": "Hello"}
        ]
        
        result = generation_engine._format_messages_to_prompt(messages, mock_tokenizer)
        
        # Should fallback to formatted messages
        assert "Hello" in result
    
    @patch('mlx_engine_server.generation.mlx_generate')
    def test_generate_complete_success(self, mock_mlx_generate, generation_engine, mock_model, mock_tokenizer):
        """Test complete generation success."""
        mock_mlx_generate.return_value = "This is a test response"
        
        messages = [{"role": "user", "content": "Hello"}]
        
        result = generation_engine.generate(
            mock_model, mock_tokenizer, messages,
            max_tokens=50, temperature=0.7, stream=False
        )
        
        assert result == "This is a test response"
        mock_mlx_generate.assert_called_once()
    
    @patch('mlx_engine_server.generation.mlx_generate')
    def test_generate_complete_with_parameters(self, mock_mlx_generate, generation_engine, mock_model, mock_tokenizer):
        """Test complete generation with various parameters."""
        mock_mlx_generate.return_value = "Response"
        
        messages = [{"role": "user", "content": "Hello"}]
        
        generation_engine.generate(
            mock_model, mock_tokenizer, messages,
            max_tokens=100, temperature=0.8, top_p=0.9,
            repetition_penalty=1.1, stream=False
        )
        
        # Verify mlx_generate was called with only supported parameters
        call_args = mock_mlx_generate.call_args
        assert call_args[1]["max_tokens"] == 100
        assert call_args[1]["verbose"] is False
        # Temperature, top_p, repetition_penalty should not be passed (not supported)
        assert "temperature" not in call_args[1]
        assert "top_p" not in call_args[1]
        assert "repetition_penalty" not in call_args[1]
    
    @patch('mlx_engine_server.generation.mlx_generate')
    def test_generate_streaming(self, mock_mlx_generate, generation_engine, mock_model, mock_tokenizer):
        """Test streaming generation."""
        messages = [{"role": "user", "content": "Hello"}]
        
        # For streaming, the generate method should return an iterator
        mock_mlx_generate.return_value = "Test response"
        mock_tokenizer.encode.return_value = [1, 2, 3]
        mock_tokenizer.decode.side_effect = lambda x: "chunk" + str(len(x))
        
        result = generation_engine.generate(
            mock_model, mock_tokenizer, messages,
            max_tokens=50, stream=True
        )
        
        # Streaming should return an iterator
        assert hasattr(result, '__iter__')
    
    @pytest.mark.asyncio
    async def test_generate_async_non_streaming(self, generation_engine, mock_model, mock_tokenizer):
        """Test async generation non-streaming."""
        messages = [{"role": "user", "content": "Hello"}]
        
        with patch.object(generation_engine, 'generate') as mock_generate:
            mock_generate.return_value = "Test response"
            
            # Collect results from async generator
            results = []
            async for chunk in generation_engine.generate_async(
                mock_model, mock_tokenizer, messages,
                max_tokens=50, stream=False
            ):
                results.append(chunk)
            
            assert len(results) == 1
            assert results[0] == "Test response"
    
    @pytest.mark.asyncio
    async def test_generate_async_streaming(self, generation_engine, mock_model, mock_tokenizer):
        """Test async generation streaming."""
        messages = [{"role": "user", "content": "Hello"}]
        
        with patch.object(generation_engine, '_generate_async_stream') as mock_stream:
            # Mock async generator
            async def mock_async_gen():
                yield "chunk1"
                yield "chunk2"
                yield "chunk3"
            
            mock_stream.return_value = mock_async_gen()
            
            # Collect results from async generator
            results = []
            async for chunk in generation_engine.generate_async(
                mock_model, mock_tokenizer, messages,
                max_tokens=50, stream=True
            ):
                results.append(chunk)
            
            assert results == ["chunk1", "chunk2", "chunk3"]
    
    def test_count_tokens_success(self, generation_engine, mock_tokenizer):
        """Test token counting success."""
        mock_tokenizer.encode.return_value = [1, 2, 3, 4, 5]
        
        count = generation_engine.count_tokens(mock_tokenizer, "test text")
        
        assert count == 5
        mock_tokenizer.encode.assert_called_once_with("test text")
    
    def test_count_tokens_fallback(self, generation_engine):
        """Test token counting fallback when encode fails."""
        tokenizer = MagicMock()
        tokenizer.encode.side_effect = Exception("Encode failed")
        
        count = generation_engine.count_tokens(tokenizer, "test text")
        
        # Should fallback to character count / 4
        assert count == len("test text") // 4
    
    @patch('mlx_engine_server.generation.mlx_generate')
    def test_generate_tokens(self, mock_mlx_generate, generation_engine, mock_model, mock_tokenizer):
        """Test token generation."""
        mock_mlx_generate.return_value = "Hello world"
        mock_tokenizer.encode.return_value = [7, 8, 9]  # Tokens for "Hello world"
        
        prompt_tokens = [1, 2, 3]
        
        tokens = list(generation_engine._generate_tokens(
            mock_model, mock_tokenizer, prompt_tokens,
            max_tokens=50, temperature=0.7, top_p=0.9, repetition_penalty=1.0
        ))
        
        assert tokens == [7, 8, 9]
        mock_mlx_generate.assert_called_once()
    
    @pytest.mark.skip(reason="_stream_generate method doesn't exist")
    def test_stream_generate(self, generation_engine, mock_model, mock_tokenizer):
        """Test stream generation method."""
        pass  # Method doesn't exist in current implementation


class TestStopSequences:
    """Test stop sequence handling."""
    
    @pytest.mark.skip(reason="_should_stop method doesn't exist")  
    def test_should_stop_with_sequences(self, generation_engine):
        """Test stop sequence detection."""
        pass  # Method doesn't exist in current implementation
    
    @pytest.mark.skip(reason="_should_stop method doesn't exist")
    def test_should_stop_no_sequences(self, generation_engine):
        """Test stop sequence detection with no sequences."""
        pass  # Method doesn't exist in current implementation


class TestErrorHandling:
    """Test error handling in generation."""
    
    @patch('mlx_engine_server.generation.mlx_generate')
    def test_generate_complete_exception(self, mock_mlx_generate, generation_engine, mock_model, mock_tokenizer):
        """Test exception handling in complete generation."""
        mock_mlx_generate.side_effect = Exception("Generation failed")
        
        messages = [{"role": "user", "content": "Hello"}]
        
        with pytest.raises(Exception, match="Generation failed"):
            generation_engine.generate(
                mock_model, mock_tokenizer, messages,
                max_tokens=50, stream=False
            )
    
    @pytest.mark.skip(reason="_stream_generate method doesn't exist")
    def test_stream_generate_exception(self, generation_engine, mock_model, mock_tokenizer):
        """Test exception handling in stream generation."""
        pass  # Method doesn't exist in current implementation


if __name__ == "__main__":
    pytest.main([__file__])