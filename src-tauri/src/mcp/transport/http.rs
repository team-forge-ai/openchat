//! HTTP transport implementation for MCP

use crate::mcp::constants::{MCP_METHOD_INITIALIZE, MCP_PROTOCOL_VERSION};
use crate::mcp::transport::session::{McpSession, McpTransport};
use tokio::time::Duration;

/// Creates initialization parameters for MCP session
fn init_params() -> serde_json::Value {
    serde_json::json!({
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "capabilities": {},
        "clientInfo": { "name": "OpenChat", "version": "0.1.0" },
    })
}

/// Builds an HTTP client with specified timeout
fn build_http_client(timeout_ms: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| e.to_string())
}

/// Creates a new HTTP-based MCP session
pub async fn create_http_session(
    url: &str,
    headers: Option<&serde_json::Value>,
    connect_timeout_ms: u64,
) -> Result<McpSession, String> {
    let client = build_http_client(connect_timeout_ms)?;
    let mut session = McpSession::new_http(client, url.to_string(), headers.cloned());
    let _ = session
        .send(MCP_METHOD_INITIALIZE, init_params(), connect_timeout_ms)
        .await?;
    Ok(session)
}
