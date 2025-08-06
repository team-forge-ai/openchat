# MLX Engine Server

A production-ready OpenAI-compatible inference server for Apple Silicon, powered by MLX. Provides fast local LLM inference with model caching, streaming support, and comprehensive API compatibility.

## Features

- 🚀 **Fast Inference**: Model loaded at startup for ~0.03-0.9s response times
- 🔌 **OpenAI Compatible**: Drop-in replacement for OpenAI API endpoints
- 🍎 **Apple Silicon Optimized**: Leverages MLX for optimal performance on M1/M2/M3
- 📡 **Streaming Support**: Real-time token streaming for chat completions
- 🎯 **Auto Model Detection**: Automatically detects model type and applies optimal settings
- 📊 **Comprehensive Monitoring**: Built-in health checks, metrics, and status endpoints
- 🔒 **Production Ready**: Proper error handling, logging, and process management
- ⚡ **Simple Architecture**: Single model focus for maximum performance and reliability

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/mlx-engine-server.git
cd mlx-engine-server

# Install dependencies
pip install -e .

# Run the server
mlx-server
```

### Using Pre-built Binary

```bash
# Download the latest release
curl -L https://github.com/yourusername/mlx-engine-server/releases/latest/download/mlx-server-macos-arm64.tar.gz -o mlx-server.tar.gz

# Extract
tar -xzf mlx-server.tar.gz

# Run
./mlx-server-dist/mlx-server
```

### Building from Source

```bash
# Install build dependencies
pip install pyinstaller

# Build binary
python build.py

# Create distribution package
python build.py --dist
```

## Quick Start

### Basic Usage

```bash
# Start server with a model (required)
mlx-server ./models/qwen2.5-0.5b-instruct-mlx

# Start on custom port
mlx-server ./models/qwen2.5-0.5b-instruct-mlx --port 8080 --host 0.0.0.0

# Use configuration file
mlx-server ./models/qwen2.5-0.5b-instruct-mlx --config config.json

# Stop the server
mlx-server --stop
```

### Preparing Models

The model must be specified at startup and must be in MLX format (safetensors + config.json). You can convert models using `mlx-lm`:

```bash
# Install mlx-lm
pip install mlx-lm

# Convert a Hugging Face model
python -m mlx_lm.convert --hf-path "Qwen/Qwen2.5-0.5B-Instruct" -q
```

### API Usage

#### Chat Completions

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is machine learning?"}
    ],
    "max_tokens": 150,
    "temperature": 0.7
  }'
```

#### Streaming Response

```python
import requests
import json

response = requests.post(
    "http://localhost:8000/v1/chat/completions",
    json={
        "messages": [{"role": "user", "content": "Tell me a story"}],
        "stream": True
    },
    stream=True
)

for line in response.iter_lines():
    if line:
        if line.startswith(b"data: "):
            data = line[6:]
            if data != b"[DONE]":
                chunk = json.loads(data)
                if chunk["choices"][0]["delta"].get("content"):
                    print(chunk["choices"][0]["delta"]["content"], end="")
```

## API Endpoints

### OpenAI Compatible

- `POST /v1/chat/completions` - Chat completions (streaming supported)
- `POST /v1/completions` - Text completions (legacy)
- `GET /v1/models` - Get loaded model information

### MLX Specific

- `GET /v1/mlx/status` - Get server status

### Health & Monitoring

- `GET /health` - Health check endpoint
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation

## Configuration

### Configuration File

Create a `config.json` file:

```json
{
  "host": "127.0.0.1",
  "port": 8000,
  "log_level": "INFO",
  "model_path": "/path/to/model",
  "adapter_path": null,
  "default_max_tokens": 150,
  "default_temperature": 0.7,
  "logs_dir": "./logs",
  "cors_enabled": true,
  "cors_origins": ["*"]
}
```

### Environment Variables

```bash
export MLX_SERVER_HOST=0.0.0.0
export MLX_SERVER_PORT=8080
export MLX_SERVER_MODEL_PATH=/path/to/model
export MLX_SERVER_LOG_LEVEL=DEBUG
export MLX_SERVER_API_KEY=your-secret-key
```

### Command Line Arguments

```bash
mlx-server /path/to/model \
  --host 0.0.0.0 \
  --port 8080 \
  --adapter /path/to/adapter \
  --max-tokens 200 \
  --temperature 0.8 \
  --log-level DEBUG \
  --log-file server.log \
  --api-key secret-key
```

## Model Management

### Model Loading

The model is loaded once at server startup and remains in memory for the lifetime of the server process. To use a different model, restart the server with the new model path.

```bash
# Start with a model
mlx-server /path/to/model

# Start with a model and adapter
mlx-server /path/to/model --adapter /path/to/lora-adapter
```

### Supported Model Types

The server auto-detects and configures:

- **Qwen** models - Applies Qwen-specific tokenizer settings
- **LLaMA** models - Configures for LLaMA chat format
- **Mistral** models - Optimizes for Mistral architecture
- **Phi** models - Sets up Phi-specific parameters

### Model Requirements

- Models must be in MLX format (safetensors)
- Required files:
  - `config.json` - Model configuration
  - `*.safetensors` - Model weights
  - `tokenizer.json` or `tokenizer_config.json` - Tokenizer configuration

## Performance

### Benchmarks

On Apple M2 Max with Qwen 2.5 0.5B model:

- Model loading: ~3-5 seconds
- First token latency: ~0.1-0.3 seconds
- Streaming throughput: ~30-50 tokens/second
- Memory usage: Model size + ~500MB overhead

### Optimization Tips

1. **Choose the right model size**: Smaller models = faster inference
2. **Adjust generation parameters**: Lower `max_tokens` for faster responses
3. **Enable streaming**: For better perceived performance
4. **Monitor resources**: Use `/v1/mlx/status` to track usage
5. **Use fast SSDs**: Model loading time depends on disk speed

## Development

### Project Structure

```
mlx-engine-server/
├── src/
│   └── mlx_engine_server/
│       ├── __init__.py
│       ├── api_models.py      # Request/response models
│       ├── config.py          # Configuration management
│       ├── generation.py      # Generation engine
│       ├── main.py           # CLI entry point
│       ├── model_manager.py  # Model lifecycle management
│       ├── server.py         # FastAPI application
│       └── utils.py          # Utilities
├── tests/
│   ├── test_api.py
│   ├── test_generation.py
│   └── test_models.py
├── build.py                  # Build script
├── pyproject.toml           # Project configuration
└── README.md
```

### Running Tests

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/

# With coverage
pytest --cov=mlx_engine_server tests/
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Deployment

### Systemd Service (Linux/macOS)

Create `/etc/systemd/system/mlx-server.service`:

```ini
[Unit]
Description=MLX Engine Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/mlx-engine-server
ExecStart=/usr/local/bin/mlx-server --config /etc/mlx-server/config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Docker (Experimental)

```dockerfile
FROM python:3.11-slim

# Note: Requires macOS host for Apple Silicon support
RUN pip install mlx-engine-server

EXPOSE 8000
CMD ["mlx-server", "--host", "0.0.0.0"]
```

### Process Management

```bash
# Start server
mlx-server

# Stop server
mlx-server --stop

# Check status
curl http://localhost:8000/health
```

## Troubleshooting

### Common Issues

1. **Model fails to load**
   - Ensure model is in MLX format
   - Check file permissions
   - Verify sufficient memory

2. **Slow inference**
   - Check GPU utilization: `/v1/mlx/status`
   - Reduce `max_tokens` or batch size
   - Use smaller models

3. **Memory errors**
   - Unload unused models
   - Reduce `max_loaded_models`
   - Monitor with `psutil`

### Debug Mode

```bash
# Enable debug logging
mlx-server --log-level DEBUG --log-file debug.log

# Check logs
tail -f debug.log
```

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [MLX](https://github.com/ml-explore/mlx) - Apple's ML framework
- [MLX-LM](https://github.com/ml-explore/mlx-examples) - Language modeling with MLX
- [FastAPI](https://fastapi.tiangolo.com/) - Modern web framework
- OpenAI for API specification

## Support

- Issues: [GitHub Issues](https://github.com/yourusername/mlx-engine-server/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/mlx-engine-server/discussions)
- Documentation: [Wiki](https://github.com/yourusername/mlx-engine-server/wiki)
