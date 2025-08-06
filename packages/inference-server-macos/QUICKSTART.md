# MLX Engine Server - Quick Start Guide

## 🚀 Installation (5 minutes)

### Option 1: Install from source

```bash
# Clone the repository
git clone https://github.com/team-forge-ai/openchat-mlx-server.git
cd openchat-mlx-server

# Install dependencies
pip install -r requirements.txt

# Or install as package
pip install -e .
```

### Option 2: Use pre-built binary

```bash
# Download latest release
curl -L https://github.com/team-forge-ai/openchat-mlx-server/releases/latest/download/openchat-mlx-server-macos-arm64.tar.gz -o openchat-mlx-server.tar.gz

# Extract
tar -xzf openchat-mlx-server.tar.gz

# Run
./openchat-mlx-server-dist/openchat-mlx-server
```

## 🎯 First Run (2 minutes)

### 1. Start the server

```bash
# Basic start
openchat-mlx-server

# Or with the run script
./run_server.sh start

# Or with make
make run
```

The server will start on `http://localhost:8000`

### 2. Check it's working

```bash
# Health check
curl http://localhost:8000/health

# API documentation
open http://localhost:8000/docs
```

## 📦 Load Your First Model (3 minutes)

### 1. Get a model

If you don't have an MLX model, convert one:

```bash
# Install mlx-lm
pip install mlx-lm

# Convert a small model from Hugging Face
python -m mlx_lm.convert \
  --hf-path "Qwen/Qwen2.5-0.5B-Instruct" \
  -q \
  --mlx-path "./models/qwen2.5-0.5b-instruct"
```

### 2. Load the model

```bash
# Start server with model
openchat-mlx-server --model ./models/qwen2.5-0.5b-instruct

# Or load via API
curl -X POST http://localhost:8000/v1/mlx/models/load \
  -H "Content-Type: application/json" \
  -d '{
    "model_path": "./models/qwen2.5-0.5b-instruct",
    "model_id": "qwen-chat"
  }'
```

## 💬 Your First Chat (1 minute)

### Using curl

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-chat",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "max_tokens": 100
  }'
```

### Using the example client

```bash
python examples/client.py \
  --model ./models/qwen2.5-0.5b-instruct \
  --prompt "Tell me a joke about programming"
```

### Using Python

```python
import requests

response = requests.post(
    "http://localhost:8000/v1/chat/completions",
    json={
        "model": "qwen-chat",
        "messages": [
            {"role": "user", "content": "Hello!"}
        ]
    }
)

print(response.json()["choices"][0]["message"]["content"])
```

## 🌊 Streaming Responses

### With curl

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-chat",
    "messages": [{"role": "user", "content": "Write a haiku"}],
    "stream": true
  }'
```

### With Python

```python
import requests
import json

response = requests.post(
    "http://localhost:8000/v1/chat/completions",
    json={
        "model": "qwen-chat",
        "messages": [{"role": "user", "content": "Tell me a story"}],
        "stream": True
    },
    stream=True
)

for line in response.iter_lines():
    if line and line.startswith(b"data: "):
        data = line[6:]
        if data != b"[DONE]":
            chunk = json.loads(data)
            if content := chunk["choices"][0]["delta"].get("content"):
                print(content, end="", flush=True)
```

## 🛠️ Common Operations

### List loaded models

```bash
curl http://localhost:8000/v1/models
```

### Check server status

```bash
curl http://localhost:8000/v1/mlx/status
```

### Unload a model

```bash
curl -X DELETE http://localhost:8000/v1/mlx/models/qwen-chat
```

### Stop the server

```bash
openchat-mlx-server --stop
# Or
./run_server.sh stop
```

## ⚙️ Configuration

### Using environment variables

```bash
export MLX_SERVER_PORT=8080
export MLX_SERVER_LOG_LEVEL=DEBUG
openchat-mlx-server
```

### Using config file

```json
// config.json
{
  "port": 8080,
  "max_loaded_models": 2,
  "default_max_tokens": 200,
  "log_level": "INFO"
}
```

```bash
openchat-mlx-server --config config.json
```

### Command line arguments

```bash
openchat-mlx-server \
  --port 8080 \
  --model ./models/my-model \
  --max-tokens 200 \
  --log-level DEBUG
```

## 🔧 Troubleshooting

### Server won't start

```bash
# Check if already running
openchat-mlx-server --stop

# Check port is free
lsof -i :8000

# Start with debug logging
openchat-mlx-server --log-level DEBUG
```

### Model won't load

```bash
# Verify model files
ls -la ./models/your-model/
# Should contain: config.json, *.safetensors files

# Check model compatibility
python -c "import mlx_lm; mlx_lm.load('./models/your-model')"
```

### Slow inference

- Use smaller models (0.5B - 3B parameters work best)
- Reduce `max_tokens` parameter
- Check memory usage: `curl http://localhost:8000/v1/mlx/status`

## 📚 Next Steps

1. **Explore the API**: Visit http://localhost:8000/docs
2. **Try different models**: Convert more models from Hugging Face
3. **Build an app**: Use the OpenAI-compatible API in your application
4. **Optimize performance**: Tune generation parameters for your use case
5. **Deploy**: Set up as a system service for production use

## 🆘 Getting Help

- **Documentation**: See [README.md](README.md)
- **Examples**: Check the `examples/` directory
- **Issues**: [GitHub Issues](https://github.com/team-forge-ai/openchat-mlx-server/issues)

## 🎉 That's it!

You now have a local LLM server running on your Mac! The server is OpenAI-compatible, so you can use it with any library that supports the OpenAI API.
