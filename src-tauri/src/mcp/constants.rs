pub const MCP_JSONRPC_VERSION: &str = "2.0";
/// MCP protocol version understood by this client. Align with server expectations.
/// See https://spec.modelcontextprotocol.io for the latest.
pub const MCP_PROTOCOL_VERSION: &str = "2024-11-05";

pub const MCP_METHOD_INITIALIZE: &str = "initialize";
pub const MCP_METHOD_TOOLS_LIST: &str = "tools/list";
pub const MCP_METHOD_TOOLS_CALL: &str = "tools/call";
pub const MCP_NOTIFICATION_INITIALIZED: &str = "notifications/initialized";

pub const MCP_DEFAULT_CONNECT_TIMEOUT_MS: u64 = 5_000;
pub const MCP_DEFAULT_LIST_TOOLS_TIMEOUT_MS: u64 = 5_000;
pub const MCP_DEFAULT_TOOL_CALL_TIMEOUT_MS: u64 = 20_000;
