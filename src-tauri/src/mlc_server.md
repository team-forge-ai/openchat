The `mlc_server.rs` file implements a comprehensive server management system for the `mlc_llm` binary.

###

Launch the Server¶
To launch the MLC Server for MLC-LLM, run the following command in your terminal.

mlc_llm serve MODEL [--model-lib PATH-TO-MODEL-LIB] [--device DEVICE] [--mode MODE] \
 [--additional-models ADDITIONAL-MODELS] \
 [--speculative-mode SPECULATIVE-MODE] \
 [--overrides OVERRIDES] \
 [--enable-tracing] \
 [--host HOST] \
 [--port PORT] \
 [--allow-credentials] \
 [--allowed-origins ALLOWED_ORIGINS] \
 [--allowed-methods ALLOWED_METHODS] \
 [--allowed-headers ALLOWED_HEADERS]
MODEL The model folder after compiling with MLC-LLM build process. The parameter
can either be the model name with its quantization scheme (e.g. Llama-2-7b-chat-hf-q4f16_1), or a full path to the model folder. In the former case, we will use the provided name to search for the model folder over possible paths.

--model-lib
A field to specify the full path to the model library file to use (e.g. a .so file).

--device
The description of the device to run on. User should provide a string in the form of device_name:device_id or device_name, where device_name is one of cuda, metal, vulkan, rocm, opencl, auto (automatically detect the local device), and device_id is the device id to run on. The default value is auto, with the device id set to 0 for default.

--mode
The engine mode in MLC LLM. We provide three preset modes: local, interactive and server. The default mode is local.

The choice of mode decides the values of “max_num_sequence”, “max_total_sequence_length” and “prefill_chunk_size” when they are not explicitly specified.

1. Mode “local” refers to the local server deployment which has low request concurrency. So the max batch size will be set to 4, and max total sequence length and prefill chunk size are set to the context window size (or sliding window size) of the model.

2. Mode “interactive” refers to the interactive use of server, which has at most 1 concurrent request. So the max batch size will be set to 1, and max total sequence length and prefill chunk size are set to the context window size (or sliding window size) of the model.

3. Mode “server” refers to the large server use case which may handle many concurrent request and want to use GPU memory as much as possible. In this mode, we will automatically infer the largest possible max batch size and max total sequence length.

You can manually specify arguments “max_num_sequence”, “max_total_seq_length” and “prefill_chunk_size” via --overrides to override the automatic inferred values. For example: --overrides "max_num_sequence=32;max_total_seq_length=4096".

--additional-models
The model paths and (optional) model library paths of additional models (other than the main model).

When engine is enabled with speculative decoding, additional models are needed. We only support one additional model for speculative decoding now. The way of specifying the additional model is: --additional-models model_path_1 or --additional-models model_path_1,model_lib_1.

When the model lib of a model is not given, JIT model compilation will be activated to compile the model automatically.

--speculative-mode
The speculative decoding mode. Right now four options are supported:

disable, where speculative decoding is not enabled,

small_draft, denoting the normal speculative decoding (small draft) style,

eagle, denoting the eagle-style speculative decoding.

medusa, denoting the medusa-style speculative decoding.

--overrides
Overriding extra configurable fields of EngineConfig.

Supporting fields that can be be overridden: tensor_parallel_shards, max_num_sequence, max_total_seq_length, prefill_chunk_size, max_history_size, gpu_memory_utilization, spec_draft_length, prefix_cache_max_num_recycling_seqs, context_window_size, sliding_window_size, attention_sink_size.

Please check out the documentation of EngineConfig in mlc_llm/serve/config.py for detailed docstring of each field. Example: --overrides "max_num_sequence=32;max_total_seq_length=4096;tensor_parallel_shards=2"

--enable-tracing
A boolean indicating if to enable event logging for requests.

--host
The host at which the server should be started, defaults to 127.0.0.1.

--port
The port on which the server should be started, defaults to 8000.

--allow-credentials
A flag to indicate whether the server should allow credentials. If set, the server will include the CORS header in the response

--allowed-origins
Specifies the allowed origins. It expects a JSON list of strings, with the default value being ["*"], allowing all origins.

--allowed-methods
Specifies the allowed methods. It expects a JSON list of strings, with the default value being ["*"], allowing all methods.

--allowed-headers
Specifies the allowed headers. It expects a JSON list of strings, with the default value being ["*"], allowing all headers.

You can access http://127.0.0.1:PORT/docs (replace PORT with the port number you specified) to see the list of supported endpoints.

API Endpoints¶
The REST API provides the following endpoints:

GET /v1/models¶
POST /v1/chat/completions¶

We should use the /v1/models endpoint to check if the server is ready.

### 📋 **Core Data Structures**

1. **MLCServerConfig** - Server configuration with:
   - Port (default: 8000)
   - Host (default: 127.0.0.1)
   - Log level (default: INFO)
   - Max tokens (default: 32,000)
   - Model (default: llama3-8b-8192)
   - Other model params as detailed in the mlc_llm serve command

2. **MLCServerStatus** - Server state tracking:
   - `process_running` - Boolean indicating if the process is running
   - `http_available` - Boolean indicating if the HTTP endpoint is available
   - `port` - Active port number
   - `pid` - Process ID
   - `error` - Error message if the process is not running

### 🔄 **Lifecycle Management**

- **`auto_start()`** - Automatic server startup on app launch
- **`start_server()`** - Manual server startup with configuration
- **`stop_server()`** - Graceful server shutdown
- **`restart()`** - Complete restart cycle (stop → delay → start)
- **`kill_sync()`** - Emergency synchronous process termination (cross-platform)

### 🌐 **Port Management**

- **Dynamic port allocation** - Automatically finds available ports if default is occupied
- **Port availability checking** - Tests TCP binding before use
- **Port range scanning** - Searches up to 100 ports from the starting port

### 🏥 **Health Monitoring**

- **`health_check()`** - HTTP endpoint health verification
- **`wait_for_server_ready()`** - Startup readiness polling (60 attempts, 1-second intervals)

### 📡 **Process Management**

- Assume the `mlc_llm` binary is in the `PATH`
- Listen to stdout/stderr streams
- **PID tracking** - Atomic storage for cross-thread access

### 📢 **Event System**

- **Status change events** - Emits `mlc-status-changed` to frontend
- **Real-time status updates** - Automatic event emission on state changes
- **Error propagation** - Forwards server errors to the UI

### 🛠️ **Configuration & Arguments**

- **Command argument building** - Constructs CLI arguments from config
- **Configurable timeouts** - Startup delays, health check intervals, restart delays

### 🔧 **Cross-Platform Support**

- **Unix signal handling** - SIGINT/SIGKILL for process termination
- **Windows process termination** - Uses Win32 API for process management
- **Platform-specific compilation** - Conditional compilation for OS differences

### 📊 **Status Reporting**

- **`get_status()`** - Current server status retrieval
- **Real-time status updates** - Immediate status changes on events
- **Error state management** - Captures and reports server errors
