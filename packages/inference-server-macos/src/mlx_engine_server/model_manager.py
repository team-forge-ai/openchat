"""Single model manager for MLX Engine Server."""

import json
import time
from pathlib import Path
from typing import Optional, Any, Dict, Tuple
from dataclasses import dataclass
from datetime import datetime
import logging

import mlx.core as mx
from mlx_lm import load

from .utils import (
    detect_model_type,
    validate_model_path,
    format_bytes,
    SystemMonitor
)

logger = logging.getLogger(__name__)


@dataclass
class ModelInfo:
    """Information about the loaded model."""
    
    model_path: Path
    model: Any  # MLX model object
    tokenizer: Any  # Tokenizer object
    model_type: str
    architecture: Optional[str]
    tokenizer_config: Dict[str, Any]
    chat_template: Optional[str]
    loaded_at: datetime
    memory_usage: Optional[int] = None  # in bytes


class MLXModelManager:
    """
    Manages a single MLX model loaded at startup.
    
    Features:
    - Auto-detection of model type
    - Proper tokenizer configuration
    - Memory usage tracking
    """
    
    def __init__(self):
        """Initialize the model manager."""
        self.model_info: Optional[ModelInfo] = None
        self.system_monitor = SystemMonitor()
        
        logger.info("Model manager initialized")
    
    def load_model(
        self,
        model_path: str,
        config: Optional[Dict[str, Any]] = None,
        adapter_path: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Load the model at startup.
        
        Args:
            model_path: Path to the model directory
            config: Optional configuration overrides
            adapter_path: Optional path to LoRA adapter
        
        Returns:
            Tuple of (success, message)
        """
        if self.model_info is not None:
            return False, "Model already loaded"
        
        model_path = Path(model_path)
        
        # Validate model path
        if not validate_model_path(model_path):
            return False, f"Invalid model path: {model_path}"
        
        try:
            logger.info(f"Loading model from {model_path}")
            start_time = time.time()
            
            # Auto-detect model type and get configuration
            model_metadata = detect_model_type(model_path)
            
            # Merge configurations (priority: explicit > auto-detected > defaults)
            tokenizer_config = model_metadata.get("tokenizer_config", {})
            if config and "tokenizer_config" in config:
                tokenizer_config.update(config["tokenizer_config"])
            
            # Load the model and tokenizer
            model, tokenizer = self._load_mlx_model(
                model_path,
                tokenizer_config,
                adapter_path
            )
            
            # Get memory usage
            memory_usage = self._estimate_model_memory(model)
            
            # Create model info
            self.model_info = ModelInfo(
                model_path=model_path,
                model=model,
                tokenizer=tokenizer,
                model_type=model_metadata["type"],
                architecture=model_metadata.get("architecture"),
                tokenizer_config=tokenizer_config,
                chat_template=model_metadata.get("chat_template"),
                loaded_at=datetime.now(),
                memory_usage=memory_usage
            )
            
            load_time = time.time() - start_time
            logger.info(
                f"Model loaded successfully in {load_time:.2f}s "
                f"(type: {model_metadata['type']}, memory: {format_bytes(memory_usage or 0)})"
            )
            
            return True, f"Model from {model_path.name} loaded successfully"
        
        except Exception as e:
            logger.error(f"Failed to load model: {e}", exc_info=True)
            return False, f"Failed to load model: {str(e)}"
    
    def _load_mlx_model(
        self,
        model_path: Path,
        tokenizer_config: Dict[str, Any],
        adapter_path: Optional[str] = None
    ) -> Tuple[Any, Any]:
        """
        Load MLX model and tokenizer with proper configuration.
        
        Args:
            model_path: Path to the model
            tokenizer_config: Tokenizer configuration
            adapter_path: Optional adapter path
        
        Returns:
            Tuple of (model, tokenizer)
        """
        # Load model using mlx_lm
        model, tokenizer = load(
            str(model_path),
            adapter_path=adapter_path,
            tokenizer_config=tokenizer_config
        )
        
        # Ensure tokenizer has necessary attributes
        if not hasattr(tokenizer, "eos_token_id") and "eos_token" in tokenizer_config:
            tokenizer.eos_token = tokenizer_config["eos_token"]
            if hasattr(tokenizer, "convert_tokens_to_ids"):
                tokenizer.eos_token_id = tokenizer.convert_tokens_to_ids(tokenizer.eos_token)
        
        return model, tokenizer
    
    def get_model(self) -> Optional[ModelInfo]:
        """
        Get the loaded model.
        
        Returns:
            ModelInfo or None if not loaded
        """
        return self.model_info
    
    def get_model_info(self) -> Optional[Dict[str, Any]]:
        """
        Get information about the loaded model.
        
        Returns:
            Model information dictionary or None
        """
        if not self.model_info:
            return None
        
        return {
            "path": str(self.model_info.model_path),
            "type": self.model_info.model_type,
            "architecture": self.model_info.architecture,
            "loaded_at": self.model_info.loaded_at.isoformat(),
            "memory_usage": format_bytes(self.model_info.memory_usage or 0)
        }
    
    def format_chat_template(
        self,
        messages: list[Dict[str, str]],
        add_generation_prompt: bool = True
    ) -> str:
        """
        Apply chat template formatting for better response quality.
        
        Args:
            messages: List of message dictionaries
            add_generation_prompt: Whether to add generation prompt
        
        Returns:
            Formatted prompt string
        """
        if not self.model_info:
            raise RuntimeError("No model loaded")
        
        tokenizer = self.model_info.tokenizer
        
        # Try to use tokenizer's chat template if available
        if hasattr(tokenizer, "apply_chat_template"):
            try:
                prompt = tokenizer.apply_chat_template(
                    messages,
                    tokenize=False,
                    add_generation_prompt=add_generation_prompt
                )
                return prompt
            except Exception as e:
                logger.warning(f"Failed to apply chat template: {e}")
        
        # Fallback to manual formatting
        formatted_messages = []
        for message in messages:
            role = message.get("role", "user")
            content = message.get("content", "")
            
            if role == "system":
                formatted_messages.append(f"System: {content}")
            elif role == "user":
                formatted_messages.append(f"User: {content}")
            elif role == "assistant":
                formatted_messages.append(f"Assistant: {content}")
            else:
                formatted_messages.append(f"{role}: {content}")
        
        prompt = "\n\n".join(formatted_messages)
        if add_generation_prompt:
            prompt += "\n\nAssistant:"
        
        return prompt
    
    def _estimate_model_memory(self, model: Any) -> int:
        """
        Estimate memory usage of a model.
        
        Args:
            model: MLX model object
        
        Returns:
            Estimated memory in bytes
        """
        try:
            # This is a rough estimation
            # MLX doesn't provide direct memory usage info
            total_params = 0
            
            if hasattr(model, "parameters"):
                for param in model.parameters():
                    if hasattr(param, "size"):
                        total_params += param.size
            
            # Assume 2 bytes per parameter (fp16)
            return total_params * 2
        except Exception as e:
            logger.warning(f"Could not estimate model memory: {e}")
            return 0
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get comprehensive status of the model manager.
        
        Returns:
            Status dictionary
        """
        system_info = self.system_monitor.get_system_info()
        
        return {
            "model_loaded": self.model_info is not None,
            "model_info": self.get_model_info(),
            "system": system_info
        }
    
    def cleanup(self) -> None:
        """Clean up the loaded model."""
        if self.model_info:
            logger.info("Cleaning up loaded model")
            
            try:
                # Clean up model
                del self.model_info.model
                del self.model_info.tokenizer
                self.model_info = None
                
                # Force garbage collection
                import gc
                gc.collect()
                
                logger.info("Model cleanup complete")
            except Exception as e:
                logger.error(f"Error during cleanup: {e}")