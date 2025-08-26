use std::sync::Arc;

use crate::mcp::transport::{
    create_http_session, parse_tools_array, spawn_stdio_session, McpSession, McpTransport,
};
use crate::mcp::types::McpToolInfo;

// (check_server is re-exported from mod.rs directly)

/// High-level manager that caches `McpSession`s keyed by id and exposes
/// convenience operations. Thin wrapper over transport helpers.
pub struct McpManager {
    pub(super) sessions: tokio::sync::Mutex<std::collections::HashMap<i64, McpSession>>,
}

impl McpManager {
    /// Creates a new, empty manager instance.
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            sessions: tokio::sync::Mutex::new(std::collections::HashMap::new()),
        })
    }

    /// Ensures a stdio session exists for `id`, creating it if needed and sending initialize.
    pub async fn ensure_stdio(
        &self,
        id: i64,
        command: &str,
        args: &[String],
        env: &serde_json::Value,
        cwd: Option<&str>,
        connect_timeout_ms: u64,
    ) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if sessions.contains_key(&id) {
            return Ok(());
        }
        let session =
            spawn_stdio_session(command, args, Some(env), cwd, connect_timeout_ms).await?;
        sessions.insert(id, session);
        Ok(())
    }

    /// Ensures an http session exists for `id`, creating it if needed and sending initialize.
    pub async fn ensure_http(
        &self,
        id: i64,
        url: &str,
        headers: Option<&serde_json::Value>,
        connect_timeout_ms: u64,
    ) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if sessions.contains_key(&id) {
            return Ok(());
        }
        let session = create_http_session(url, headers, connect_timeout_ms).await?;
        sessions.insert(id, session);
        Ok(())
    }

    /// Lists available tools for `id`.
    pub async fn list_tools(&self, id: i64, timeout_ms: u64) -> Result<Vec<McpToolInfo>, String> {
        let mut sessions = self.sessions.lock().await;
        let s = sessions.get_mut(&id).ok_or("not connected")?;
        let result = s
            .send(
                crate::mcp::constants::MCP_METHOD_TOOLS_LIST,
                serde_json::Value::Null,
                timeout_ms,
            )
            .await?;
        Ok(parse_tools_array(&result))
    }

    /// Calls a tool for `id` with JSON args; returns concatenated text content.
    pub async fn call_tool(
        &self,
        id: i64,
        tool: &str,
        args: serde_json::Value,
        timeout_ms: u64,
    ) -> Result<String, String> {
        let mut sessions = self.sessions.lock().await;
        let s = sessions.get_mut(&id).ok_or("not connected")?;
        let result = s
            .send(
                crate::mcp::constants::MCP_METHOD_TOOLS_CALL,
                serde_json::json!({ "name": tool, "arguments": args }),
                timeout_ms,
            )
            .await?;
        let content = match result.get("content") {
            Some(val) if val.is_string() => val.as_str().unwrap_or("").to_string(),
            Some(val) if val.is_array() => {
                let mut out = String::new();
                if let Some(items) = val.as_array() {
                    for item in items {
                        if let Some(t) = item.get("type").and_then(|t| t.as_str()) {
                            if t == "text" {
                                if let Some(txt) = item.get("text").and_then(|t| t.as_str()) {
                                    if !out.is_empty() {
                                        out.push_str("\n");
                                    }
                                    out.push_str(txt);
                                }
                            }
                        }
                    }
                }
                out
            }
            _ => String::new(),
        };
        Ok(content)
    }
}

// Re-exports handled by parent mod
