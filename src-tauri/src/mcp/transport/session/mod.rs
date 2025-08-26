//! MCP session types and transport trait

pub mod http;
pub mod stdio;

use async_trait::async_trait;

/// Transport-agnostic interface for MCP communication
#[async_trait]
pub trait McpTransport {
    /// Sends a JSON-RPC request and returns the result value
    async fn send(
        &mut self,
        method: &str,
        params: serde_json::Value,
        timeout_ms: u64,
    ) -> Result<serde_json::Value, String>;

    /// Gets the transport type name for logging/debugging
    #[allow(dead_code)]
    fn transport_type(&self) -> &'static str;
}

/// A transport-agnostic MCP session that delegates to specific transport implementations
#[derive(Debug)]
pub enum McpSession {
    Stdio(stdio::StdioSession),
    Http(http::HttpSession),
}

#[async_trait]
impl McpTransport for McpSession {
    async fn send(
        &mut self,
        method: &str,
        params: serde_json::Value,
        timeout_ms: u64,
    ) -> Result<serde_json::Value, String> {
        match self {
            McpSession::Stdio(session) => session.send(method, params, timeout_ms).await,
            McpSession::Http(session) => session.send(method, params, timeout_ms).await,
        }
    }

    fn transport_type(&self) -> &'static str {
        match self {
            McpSession::Stdio(_) => "stdio",
            McpSession::Http(_) => "http",
        }
    }
}

impl McpSession {
    /// Creates a new STDIO session
    pub fn new_stdio(
        child: tokio::process::Child,
        stdin: tokio::process::ChildStdin,
        reader: tokio::io::BufReader<tokio::process::ChildStdout>,
    ) -> Self {
        McpSession::Stdio(stdio::StdioSession::new(child, stdin, reader))
    }

    /// Creates a new HTTP session
    pub fn new_http(
        client: reqwest::Client,
        url: String,
        headers: Option<serde_json::Value>,
    ) -> Self {
        McpSession::Http(http::HttpSession::new(client, url, headers))
    }

    /// Kills the child process if this is a STDIO session
    pub async fn kill_child(&mut self) -> Result<(), String> {
        match self {
            McpSession::Stdio(session) => session.kill_child().await,
            McpSession::Http(_) => Ok(()), // No-op for HTTP
        }
    }
}
