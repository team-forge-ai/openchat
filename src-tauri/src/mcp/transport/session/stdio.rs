//! STDIO session implementation for MCP

use crate::mcp::constants::MCP_JSONRPC_VERSION;
use async_trait::async_trait;
use log::{debug, error, warn};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::time::{timeout, Duration};

use super::McpTransport;

/// STDIO-based MCP session
#[derive(Debug)]
pub struct StdioSession {
    child: tokio::process::Child,
    stdin: tokio::process::ChildStdin,
    reader: BufReader<tokio::process::ChildStdout>,
    next_id: u64,
}

impl StdioSession {
    /// Creates a new STDIO session
    pub fn new(
        child: tokio::process::Child,
        stdin: tokio::process::ChildStdin,
        reader: BufReader<tokio::process::ChildStdout>,
    ) -> Self {
        Self {
            child,
            stdin,
            reader,
            next_id: 0,
        }
    }

    /// Kills the child process
    pub async fn kill_child(&mut self) -> Result<(), String> {
        self.child.kill().await.map_err(|e| e.to_string())
    }
}

#[async_trait]
impl McpTransport for StdioSession {
    async fn send(
        &mut self,
        method: &str,
        params: serde_json::Value,
        timeout_ms: u64,
    ) -> Result<serde_json::Value, String> {
        self.next_id = self.next_id.saturating_add(1);
        debug!(
            "mcp.send(stdio): id={} method={} timeout_ms={}",
            self.next_id, method, timeout_ms
        );

        // Build JSON-RPC request
        let req = serde_json::json!({
            "jsonrpc": MCP_JSONRPC_VERSION,
            "id": self.next_id,
            "method": method,
            "params": params,
        });

        // Serialize and send request
        let mut line = serde_json::to_string(&req).map_err(|e| e.to_string())?;
        line.push('\n');

        let write_res = timeout(
            Duration::from_millis(timeout_ms),
            self.stdin.write_all(line.as_bytes()),
        )
        .await;

        match write_res {
            Ok(Ok(())) => {}
            Ok(Err(e)) => {
                error!("mcp.send(stdio): write error - {}", e);
                return Err(e.to_string());
            }
            Err(_) => {
                warn!("mcp.send(stdio): write timeout (timeout_ms={})", timeout_ms);
                return Err("write timeout".to_string());
            }
        }

        // Read response
        let mut buf = String::new();
        let read_res = timeout(
            Duration::from_millis(timeout_ms),
            self.reader.read_line(&mut buf),
        )
        .await;

        match read_res {
            Ok(Ok(_)) => {}
            Ok(Err(e)) => {
                error!("mcp.send(stdio): read error - {}", e);
                return Err(e.to_string());
            }
            Err(_) => {
                warn!("mcp.send(stdio): read timeout (timeout_ms={})", timeout_ms);
                return Err("read timeout".to_string());
            }
        }

        // Parse and validate response
        let v: serde_json::Value = serde_json::from_str(&buf).map_err(|e| e.to_string())?;
        if let Some(err) = v.get("error") {
            let msg = err
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("rpc error")
                .to_string();
            warn!("mcp.send(stdio): rpc error - {}", msg);
            return Err(msg);
        }

        Ok(v.get("result").cloned().unwrap_or(serde_json::Value::Null))
    }

    fn transport_type(&self) -> &'static str {
        "stdio"
    }
}
