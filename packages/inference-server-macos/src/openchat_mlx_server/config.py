"""Configuration management for MLX Engine Server."""

import os
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
import json
import logging

logger = logging.getLogger(__name__)


@dataclass
class ServerConfig:
    """Server configuration management."""
    
    # Server settings
    host: str = "127.0.0.1"
    port: int = 8000
    workers: int = 1
    reload: bool = False
    log_level: str = "INFO"
    
    # Generation defaults
    default_max_tokens: int = 150
    default_temperature: float = 0.7
    default_top_p: float = 0.9
    default_repetition_penalty: float = 1.0
    
    # Model settings
    model_path: Optional[str] = None  # Required model path
    adapter_path: Optional[str] = None  # Optional LoRA adapter path
    
    # Paths
    logs_dir: Path = field(default_factory=lambda: Path("./logs"))
    config_file: Optional[Path] = None
    
    # Performance settings
    request_timeout: int = 300  # Seconds
    max_concurrent_requests: int = 10
    enable_streaming: bool = True
    
    # Security
    cors_enabled: bool = True
    cors_origins: list = field(default_factory=lambda: ["*"])
    api_key: Optional[str] = None
    
    def __post_init__(self):
        """Validate and create necessary directories."""
        # Ensure paths are Path objects
        self.logs_dir = Path(self.logs_dir)
        
        # Create directories if they don't exist
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        
        # Load from config file if provided
        if self.config_file:
            self.load_from_file(self.config_file)
    
    def load_from_file(self, config_path: Path) -> None:
        """Load configuration from JSON file."""
        try:
            with open(config_path, 'r') as f:
                config_data = json.load(f)
                self.update(config_data)
                logger.info(f"Loaded configuration from {config_path}")
        except Exception as e:
            logger.error(f"Failed to load config from {config_path}: {e}")
    
    def save_to_file(self, config_path: Path) -> None:
        """Save configuration to JSON file."""
        try:
            config_dict = self.to_dict()
            with open(config_path, 'w') as f:
                json.dump(config_dict, f, indent=2, default=str)
                logger.info(f"Saved configuration to {config_path}")
        except Exception as e:
            logger.error(f"Failed to save config to {config_path}: {e}")
    
    def update(self, updates: Dict[str, Any]) -> None:
        """Update configuration with new values."""
        for key, value in updates.items():
            if hasattr(self, key):
                # Convert paths if necessary
                if key.endswith('_dir') or key.endswith('_file'):
                    value = Path(value) if value else None
                setattr(self, key, value)
                logger.debug(f"Updated config: {key} = {value}")
            else:
                logger.warning(f"Unknown config key: {key}")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary."""
        return {
            key: str(value) if isinstance(value, Path) else value
            for key, value in self.__dict__.items()
            if not key.startswith('_')
        }
    
    @classmethod
    def from_env(cls) -> "ServerConfig":
        """Create configuration from environment variables."""
        config = cls()
        
        # Map environment variables to config fields
        env_mapping = {
            "MLX_SERVER_HOST": "host",
            "MLX_SERVER_PORT": "port",
            "MLX_SERVER_LOG_LEVEL": "log_level",
            "MLX_SERVER_API_KEY": "api_key",
            "MLX_SERVER_MAX_TOKENS": "default_max_tokens",
            "MLX_SERVER_TEMPERATURE": "default_temperature",
            "MLX_SERVER_MODEL_PATH": "model_path",
            "MLX_SERVER_ADAPTER_PATH": "adapter_path",
            "MLX_SERVER_LOGS_DIR": "logs_dir",
        }
        
        updates = {}
        for env_key, config_key in env_mapping.items():
            if env_value := os.getenv(env_key):
                # Convert types as needed
                if config_key == "port" or config_key.startswith("default_max"):
                    updates[config_key] = int(env_value)
                elif config_key.startswith("default_") and "temperature" in config_key:
                    updates[config_key] = float(env_value)
                else:
                    updates[config_key] = env_value
        
        if updates:
            config.update(updates)
            logger.info(f"Loaded {len(updates)} settings from environment")
        
        return config