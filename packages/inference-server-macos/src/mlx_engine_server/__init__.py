"""MLX Engine Server - OpenAI-compatible inference server for Apple Silicon."""

__version__ = "0.2.0"
__author__ = "MLX Engine Server Contributors"

from .config import ServerConfig
from .model_manager import MLXModelManager

__all__ = ["ServerConfig", "MLXModelManager", "__version__"]