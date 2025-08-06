"""Utility functions for MLX Engine Server."""

import os
import sys
import json
import time
import psutil
import logging
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, List, Union
from datetime import datetime, timedelta
import hashlib
import mlx.core as mx

logger = logging.getLogger(__name__)


# Logging Configuration
def setup_logging(
    log_level: str = "INFO",
    log_file: Optional[Path] = None,
    format_string: Optional[str] = None
) -> None:
    """
    Set up logging configuration for the server.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional path to log file
        format_string: Optional custom format string
    """
    if format_string is None:
        format_string = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    handlers = [logging.StreamHandler(sys.stdout)]
    
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file))
    
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format=format_string,
        handlers=handlers,
        force=True
    )
    
    # Set specific loggers
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


# System Monitoring
class SystemMonitor:
    """Monitor system resources and MLX device status."""
    
    def __init__(self):
        self.start_time = time.time()
        self.process = psutil.Process()
    
    def get_memory_usage(self) -> Dict[str, Any]:
        """Get current memory usage statistics."""
        memory = psutil.virtual_memory()
        process_memory = self.process.memory_info()
        
        return {
            "system": {
                "total_gb": memory.total / (1024**3),
                "available_gb": memory.available / (1024**3),
                "used_gb": memory.used / (1024**3),
                "percent": memory.percent
            },
            "process": {
                "rss_gb": process_memory.rss / (1024**3),
                "vms_gb": process_memory.vms / (1024**3) if hasattr(process_memory, 'vms') else None
            }
        }
    
    def get_gpu_usage(self) -> Dict[str, Any]:
        """Get GPU usage statistics for Apple Silicon."""
        try:
            # Use MLX to check device
            device = mx.default_device()
            device_type = "gpu" if device == mx.gpu else "cpu"
            
            # Try to get Metal GPU info using system_profiler
            gpu_info = self._get_metal_gpu_info()
            
            return {
                "device": device_type,
                "mlx_version": mx.__version__,
                "metal_info": gpu_info
            }
        except Exception as e:
            logger.warning(f"Could not get GPU usage: {e}")
            return {"device": "unknown", "error": str(e)}
    
    def _get_metal_gpu_info(self) -> Optional[Dict[str, Any]]:
        """Get Metal GPU information on macOS."""
        if sys.platform != "darwin":
            return None
        
        try:
            result = subprocess.run(
                ["system_profiler", "SPDisplaysDataType", "-json"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                data = json.loads(result.stdout)
                displays = data.get("SPDisplaysDataType", [])
                if displays:
                    return {
                        "chipset": displays[0].get("sppci_model", "Unknown"),
                        "vendor": displays[0].get("sppci_vendor", "Apple"),
                    }
        except Exception as e:
            logger.debug(f"Could not get Metal GPU info: {e}")
        
        return None
    
    def get_cpu_usage(self) -> Dict[str, Any]:
        """Get CPU usage statistics."""
        return {
            "percent": psutil.cpu_percent(interval=0.1),
            "count": psutil.cpu_count(),
            "frequency": psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None
        }
    
    def get_uptime(self) -> str:
        """Get server uptime as a formatted string."""
        uptime_seconds = time.time() - self.start_time
        return str(timedelta(seconds=int(uptime_seconds)))
    
    def get_system_info(self) -> Dict[str, Any]:
        """Get comprehensive system information."""
        return {
            "platform": sys.platform,
            "python_version": sys.version,
            "memory": self.get_memory_usage(),
            "cpu": self.get_cpu_usage(),
            "gpu": self.get_gpu_usage(),
            "uptime": self.get_uptime()
        }


# Model Utilities
def detect_model_type(model_path: Union[str, Path]) -> Dict[str, Any]:
    """
    Auto-detect model type from config.json.
    
    Args:
        model_path: Path to the model directory
    
    Returns:
        Dictionary with model type and recommended settings
    """
    model_path = Path(model_path)
    config_path = model_path / "config.json"
    
    model_info = {
        "type": "unknown",
        "architecture": None,
        "tokenizer_config": {},
        "chat_template": None
    }
    
    if not config_path.exists():
        logger.warning(f"No config.json found at {config_path}")
        return model_info
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Get model type from architectures or model_type
        architectures = config.get("architectures", [])
        model_type = config.get("model_type", "")
        
        # Detect based on architecture
        if architectures:
            arch = architectures[0].lower()
            if "qwen" in arch:
                model_info["type"] = "qwen"
                model_info["tokenizer_config"] = {"eos_token": "<|im_end|>"}
            elif "llama" in arch:
                model_info["type"] = "llama"
                model_info["tokenizer_config"] = {"eos_token": "</s>"}
            elif "mistral" in arch:
                model_info["type"] = "mistral"
                model_info["tokenizer_config"] = {"eos_token": "</s>"}
            elif "phi" in arch:
                model_info["type"] = "phi"
                model_info["tokenizer_config"] = {"eos_token": "<|endoftext|>"}
            else:
                model_info["type"] = arch.split("for")[0].lower()
        
        model_info["architecture"] = architectures[0] if architectures else model_type
        
        # Check for chat template in tokenizer_config.json
        tokenizer_config_path = model_path / "tokenizer_config.json"
        if tokenizer_config_path.exists():
            with open(tokenizer_config_path, 'r') as f:
                tokenizer_config = json.load(f)
                if "chat_template" in tokenizer_config:
                    model_info["chat_template"] = tokenizer_config["chat_template"]
        
        logger.info(f"Detected model type: {model_info['type']} ({model_info['architecture']})")
        
    except Exception as e:
        logger.error(f"Error detecting model type: {e}")
    
    return model_info


def generate_id(prefix: str = "mlx") -> str:
    """Generate a unique ID with optional prefix."""
    timestamp = int(time.time() * 1000)
    random_part = hashlib.md5(os.urandom(16)).hexdigest()[:8]
    return f"{prefix}-{timestamp}-{random_part}"


def format_bytes(bytes_value: int) -> str:
    """Format bytes to human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_value < 1024.0:
            return f"{bytes_value:.2f} {unit}"
        bytes_value /= 1024.0
    return f"{bytes_value:.2f} PB"


def validate_model_path(model_path: Union[str, Path]) -> bool:
    """
    Validate that a model path contains necessary files.
    
    Args:
        model_path: Path to the model directory
    
    Returns:
        True if valid, False otherwise
    """
    model_path = Path(model_path)
    
    if not model_path.exists():
        logger.error(f"Model path does not exist: {model_path}")
        return False
    
    # Check for essential files
    required_files = ["config.json"]
    for file in required_files:
        if not (model_path / file).exists():
            logger.error(f"Missing required file: {file}")
            return False
    
    # Check for model weights (safetensors or bin files)
    has_weights = any(
        model_path.glob("*.safetensors")
    ) or any(
        model_path.glob("*.bin")
    )
    
    if not has_weights:
        logger.error("No model weight files found (.safetensors or .bin)")
        return False
    
    return True


class ProcessManager:
    """Manage server process lifecycle on macOS."""
    
    def __init__(self, pid_file: Path = Path("mlx_server.pid")):
        self.pid_file = pid_file
    
    def write_pid(self) -> None:
        """Write current process PID to file."""
        try:
            self.pid_file.write_text(str(os.getpid()))
            logger.info(f"PID {os.getpid()} written to {self.pid_file}")
        except Exception as e:
            logger.error(f"Failed to write PID file: {e}")
    
    def read_pid(self) -> Optional[int]:
        """Read PID from file."""
        try:
            if self.pid_file.exists():
                return int(self.pid_file.read_text().strip())
        except Exception as e:
            logger.error(f"Failed to read PID file: {e}")
        return None
    
    def is_running(self, pid: int) -> bool:
        """Check if process with given PID is running."""
        try:
            process = psutil.Process(pid)
            return process.is_running()
        except psutil.NoSuchProcess:
            return False
    
    def stop_server(self) -> bool:
        """Stop the server process."""
        pid = self.read_pid()
        if pid and self.is_running(pid):
            try:
                process = psutil.Process(pid)
                process.terminate()
                logger.info(f"Sent termination signal to PID {pid}")
                
                # Wait for graceful shutdown
                try:
                    process.wait(timeout=10)
                except psutil.TimeoutExpired:
                    logger.warning("Process did not terminate, forcing...")
                    process.kill()
                
                self.cleanup()
                return True
            except Exception as e:
                logger.error(f"Failed to stop server: {e}")
        return False
    
    def cleanup(self) -> None:
        """Clean up PID file."""
        if self.pid_file.exists():
            self.pid_file.unlink()
            logger.info("Cleaned up PID file")


# Response formatting utilities
def format_openai_error(error_type: str, message: str, code: Optional[str] = None) -> Dict[str, Any]:
    """Format error response in OpenAI style."""
    return {
        "error": {
            "message": message,
            "type": error_type,
            "code": code
        }
    }


def format_timestamp() -> int:
    """Get current Unix timestamp."""
    return int(time.time())


# Async utilities
async def run_in_thread(func, *args, **kwargs):
    """Run a blocking function in a thread pool."""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, func, *args, **kwargs)