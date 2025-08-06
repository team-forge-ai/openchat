#!/usr/bin/env python3
"""Main entry point for MLX Engine Server."""

import argparse
import json
import logging
import os
import signal
import sys
from pathlib import Path
from typing import Optional

from .config import ServerConfig
from .server import MLXServer
from .utils import setup_logging, ProcessManager

logger = logging.getLogger(__name__)


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="MLX Engine Server - OpenAI-compatible inference server for Apple Silicon",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Start server with a model
  openchat-mlx-server /path/to/model
  
  # Start server on custom port
  openchat-mlx-server /path/to/model --port 8080
  
  # Start with configuration file
  openchat-mlx-server /path/to/model --config config.json
  
  # Start with debug logging
  openchat-mlx-server /path/to/model --log-level DEBUG
  
  # Stop running server
  openchat-mlx-server --stop
        """
    )
    
    # Positional argument for model path
    parser.add_argument(
        "model_path",
        type=str,
        nargs='?',
        help="Path to the MLX model directory (required unless using --stop)"
    )
    
    # Server configuration
    parser.add_argument(
        "--host",
        type=str,
        default=None,
        help="Host address to bind to (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Port number to listen on (default: 8000)"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=None,
        help="Number of worker processes (default: 1)"
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development"
    )
    
    # Model configuration
    parser.add_argument(
        "--adapter",
        type=str,
        default=None,
        help="Path to LoRA adapter (optional)"
    )
    
    # Generation defaults
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=None,
        help="Default maximum tokens for generation (default: 150)"
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=None,
        help="Default temperature for generation (default: 0.7)"
    )
    parser.add_argument(
        "--top-p",
        type=float,
        default=None,
        help="Default top-p for generation (default: 1.0)"
    )
    
    # Paths
    parser.add_argument(
        "--logs-dir",
        type=str,
        default=None,
        help="Directory for log files"
    )
    
    # Configuration
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to configuration file (JSON)"
    )
    parser.add_argument(
        "--save-config",
        type=str,
        default=None,
        help="Save current configuration to file"
    )
    
    # Logging
    parser.add_argument(
        "--log-level",
        type=str,
        default=None,
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Logging level (default: INFO)"
    )
    parser.add_argument(
        "--log-file",
        type=str,
        default=None,
        help="Path to log file"
    )
    
    # Security
    parser.add_argument(
        "--api-key",
        type=str,
        default=None,
        help="API key for authentication"
    )
    parser.add_argument(
        "--no-cors",
        action="store_true",
        help="Disable CORS"
    )
    
    # Process management
    parser.add_argument(
        "--stop",
        action="store_true",
        help="Stop running server"
    )
    parser.add_argument(
        "--pid-file",
        type=str,
        default="mlx_server.pid",
        help="Path to PID file"
    )
    
    # Version
    parser.add_argument(
        "--version",
        action="version",
        version=f"MLX Engine Server {__import__('openchat_mlx_server').__version__}"
    )
    
    return parser.parse_args()


def load_configuration(args: argparse.Namespace) -> ServerConfig:
    """
    Load configuration from various sources.
    
    Priority: CLI args > config file > environment > defaults
    
    Args:
        args: Parsed command-line arguments
    
    Returns:
        Server configuration
    """
    # Start with environment variables
    config = ServerConfig.from_env()
    
    # Load from config file if specified
    if args.config:
        config_path = Path(args.config)
        if config_path.exists():
            config.load_from_file(config_path)
        else:
            logger.error(f"Configuration file not found: {config_path}")
            sys.exit(1)
    
    # Override with command-line arguments
    updates = {}
    
    if args.model_path is not None:
        updates["model_path"] = args.model_path
    if args.adapter is not None:
        updates["adapter_path"] = args.adapter
    
    if args.host is not None:
        updates["host"] = args.host
    if args.port is not None:
        updates["port"] = args.port
    if args.workers is not None:
        updates["workers"] = args.workers
    if args.reload:
        updates["reload"] = True
    
    if args.max_tokens is not None:
        updates["default_max_tokens"] = args.max_tokens
    if args.temperature is not None:
        updates["default_temperature"] = args.temperature
    if args.top_p is not None:
        updates["default_top_p"] = args.top_p
    
    if args.logs_dir is not None:
        updates["logs_dir"] = args.logs_dir
    
    if args.log_level is not None:
        updates["log_level"] = args.log_level
    if args.api_key is not None:
        updates["api_key"] = args.api_key
    if args.no_cors:
        updates["cors_enabled"] = False
    
    if updates:
        config.update(updates)
    
    # Save configuration if requested
    if args.save_config:
        save_path = Path(args.save_config)
        config.save_to_file(save_path)
        print(f"Configuration saved to {save_path}")
    
    return config


def setup_signal_handlers(server: MLXServer):
    """
    Set up signal handlers for graceful shutdown.
    
    Args:
        server: MLX server instance
    """
    def signal_handler(signum, frame):
        """Handle shutdown signals."""
        logger.info(f"Received signal {signum}, shutting down...")
        sys.exit(0)
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    if hasattr(signal, 'SIGHUP'):
        signal.signal(signal.SIGHUP, signal_handler)


def stop_server(pid_file: str) -> bool:
    """
    Stop a running server.
    
    Args:
        pid_file: Path to PID file
    
    Returns:
        True if server was stopped, False otherwise
    """
    process_manager = ProcessManager(Path(pid_file))
    
    if process_manager.stop_server():
        print("Server stopped successfully")
        return True
    else:
        print("No running server found or failed to stop")
        return False


def main():
    """Main entry point."""
    # Parse arguments
    args = parse_arguments()
    
    # Handle stop command
    if args.stop:
        success = stop_server(args.pid_file)
        sys.exit(0 if success else 1)
    
    # Check for required model path
    if not args.model_path:
        print("Error: Model path is required")
        print("Usage: openchat-mlx-server /path/to/model [options]")
        print("       openchat-mlx-server --stop")
        sys.exit(1)
    
    # Load configuration
    config = load_configuration(args)
    
    # Set up logging
    log_file = None
    if args.log_file:
        log_file = Path(args.log_file)
    elif config.logs_dir:
        log_file = config.logs_dir / "mlx_server.log"
    
    setup_logging(
        log_level=config.log_level,
        log_file=log_file
    )
    
    logger.info("Starting MLX Engine Server")
    logger.info(f"Configuration: {config.to_dict()}")
    
    # Check for existing server
    process_manager = ProcessManager(Path(args.pid_file))
    existing_pid = process_manager.read_pid()
    if existing_pid and process_manager.is_running(existing_pid):
        logger.error(f"Server already running with PID {existing_pid}")
        print(f"Server already running with PID {existing_pid}")
        print("Use --stop to stop the existing server")
        sys.exit(1)
    
    # Create and configure server
    try:
        # Validate model path exists
        if not Path(config.model_path).exists():
            logger.error(f"Model path does not exist: {config.model_path}")
            print(f"Error: Model path does not exist: {config.model_path}")
            sys.exit(1)
        
        server = MLXServer(config)
        
        # Set up signal handlers
        setup_signal_handlers(server)
        
        # Load the model at startup
        logger.info(f"Loading model from: {config.model_path}")
        print(f"Loading model from: {config.model_path}")
        
        success, message = server.model_manager.load_model(
            model_path=config.model_path,
            adapter_path=config.adapter_path
        )
        
        if not success:
            logger.error(f"Failed to load model: {message}")
            print(f"Failed to load model: {message}")
            sys.exit(1)
        
        logger.info(f"Model loaded: {message}")
        print(f"Model loaded successfully")
        
        # Start server
        logger.info(f"Server starting on http://{config.host}:{config.port}")
        print(f"MLX Engine Server starting on http://{config.host}:{config.port}")
        print("Press Ctrl+C to stop")
        
        server.run()
        
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
        print("\nServer stopped")
    except Exception as e:
        logger.error(f"Server failed to start: {e}", exc_info=True)
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        # Clean up
        process_manager.cleanup()


if __name__ == "__main__":
    main()