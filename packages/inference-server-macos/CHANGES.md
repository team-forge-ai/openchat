# MLX Engine Server - Single Model Architecture

## Version 0.2.0 - Major Refactoring

The MLX Engine Server has been refactored to use a **single-model architecture** for improved performance, reliability, and simplicity.

## Key Changes

### Architecture Simplification

**Before:**

- Dynamic model loading/unloading via API
- Support for multiple models in memory
- Model switching capabilities
- Complex model management state

**After:**

- Single model loaded at startup (required)
- Model stays in memory for server lifetime
- No dynamic model management
- Simplified, predictable behavior

### Usage Changes

**Before:**

```bash
# Start server without model
mlx-server

# Load model via API
curl -X POST /v1/mlx/models/load -d '{"model_path": "/path/to/model"}'
```

**After:**

```bash
# Model path is required at startup
mlx-server /path/to/model

# Model is immediately available for inference
```

### API Changes

#### Removed Endpoints

- `POST /v1/mlx/models/load` - No longer needed
- `DELETE /v1/mlx/models/{model_id}` - No longer needed
- `POST /v1/mlx/models/{model_id}/reload` - No longer needed
- `GET /v1/models/{model_id}` - No longer needed

#### Updated Endpoints

- `POST /v1/chat/completions` - `model` parameter now optional (uses loaded model)
- `POST /v1/completions` - `model` parameter now optional (uses loaded model)
- `GET /v1/models` - Returns single loaded model info
- `GET /v1/mlx/status` - Simplified status for single model

### Configuration Changes

**Removed Settings:**

- `max_loaded_models` - No longer relevant
- `model_cache_size_gb` - No longer relevant
- `auto_unload_timeout` - No longer relevant
- `models_cache_dir` - No longer needed

**New Settings:**

- `model_path` - Path to model (can be set via CLI, env, or config)
- `adapter_path` - Optional LoRA adapter path

### Benefits

1. **Faster Startup**: Model loads once at startup
2. **Predictable Performance**: No model switching overhead
3. **Simpler Code**: ~40% less complexity in model management
4. **Better Reliability**: Fewer edge cases and state management issues
5. **Clearer Usage**: Model path required upfront, no confusion

### Migration Guide

If you're upgrading from v0.1.x:

1. **Update startup scripts** to include model path:

   ```bash
   # Old
   mlx-server --model /path/to/model

   # New (model is positional argument)
   mlx-server /path/to/model
   ```

2. **Remove model management code** from clients:
   - No need to call load/unload endpoints
   - Model is ready immediately after server starts

3. **Update API calls** (optional):
   - `model` parameter can be omitted in chat/completion requests
   - Server uses the single loaded model automatically

### Environment Variables

```bash
# New/Updated
MLX_SERVER_MODEL_PATH=/path/to/model  # Model to load
MLX_SERVER_ADAPTER_PATH=/path/to/adapter  # Optional adapter

# Removed
MLX_SERVER_MODELS_DIR  # No longer used
```

### Example Usage

```python
import requests

# Server must be started with model: mlx-server /path/to/model

# Chat completion (no model parameter needed)
response = requests.post(
    "http://localhost:8000/v1/chat/completions",
    json={
        "messages": [
            {"role": "user", "content": "Hello!"}
        ]
    }
)
```

## Files Modified

### Core Changes

- `src/mlx_engine_server/model_manager.py` - Simplified to single model
- `src/mlx_engine_server/server.py` - Removed dynamic endpoints
- `src/mlx_engine_server/main.py` - Model path now required argument
- `src/mlx_engine_server/config.py` - Removed multi-model settings
- `src/mlx_engine_server/api_models.py` - Made model parameter optional

### Documentation Updates

- `README.md` - Updated for single model usage
- `QUICKSTART.md` - Simplified instructions
- `config.example.json` - Removed multi-model settings
- `examples/client.py` - Removed model management code
- `run_server.sh` - Updated to require model path

## Backwards Compatibility

This is a **breaking change** from v0.1.x. Clients that rely on dynamic model loading will need to be updated. The `model` parameter in API requests is now optional but still accepted for compatibility with OpenAI clients.

## Future Considerations

The single-model architecture is designed for:

- Desktop applications with dedicated model usage
- Edge deployments with resource constraints
- Development and testing scenarios
- Production deployments where model switching is handled at the infrastructure level

For multi-model scenarios, run multiple server instances on different ports, each with its own model.
