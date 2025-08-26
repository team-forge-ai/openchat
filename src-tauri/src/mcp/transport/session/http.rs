//! HTTP session implementation for MCP

use crate::mcp::constants::MCP_JSONRPC_VERSION;
use async_trait::async_trait;
use log::{debug, warn};
use tokio::time::Duration;

use super::McpTransport;

/// HTTP-based MCP session
#[derive(Debug)]
pub struct HttpSession {
    client: reqwest::Client,
    url: String,
    headers: Option<serde_json::Value>,
    next_id: u64,
}

impl HttpSession {
    /// Creates a new HTTP session
    pub fn new(client: reqwest::Client, url: String, headers: Option<serde_json::Value>) -> Self {
        Self {
            client,
            url,
            headers,
            next_id: 0,
        }
    }
}

#[async_trait]
impl McpTransport for HttpSession {
    async fn send(
        &mut self,
        method: &str,
        params: serde_json::Value,
        timeout_ms: u64,
    ) -> Result<serde_json::Value, String> {
        self.next_id = self.next_id.saturating_add(1);
        debug!(
            "mcp.send(http): id={} method={} timeout_ms={} url={}",
            self.next_id, method, timeout_ms, self.url
        );

        // Build JSON-RPC request
        let req = serde_json::json!({
            "jsonrpc": MCP_JSONRPC_VERSION,
            "id": self.next_id,
            "method": method,
            "params": params,
        });

        // Build HTTP request
        let mut request = self
            .client
            .post(self.url.as_str())
            .json(&req)
            .timeout(Duration::from_millis(timeout_ms));

        // Apply headers if present
        if let Some(hs) = self.headers.as_ref().and_then(|v| v.as_object()) {
            let mut rb = request;
            for (k, val) in hs.iter() {
                if let Some(s) = val.as_str() {
                    rb = rb.header(k, s);
                }
            }
            request = rb;
        }

        // Send request and get response
        let resp = request.send().await.map_err(|e| e.to_string())?;
        let status = resp.status();
        let body_text = resp.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            warn!(
                "mcp.send(http): http error status={} body_len={}",
                status.as_u16(),
                body_text.len()
            );
            return Err(format!("HTTP {}: {}", status.as_u16(), body_text));
        }

        // Parse and validate response
        let v: serde_json::Value =
            serde_json::from_str(&body_text).map_err(|_e| body_text.clone())?;
        if let Some(err) = v.get("error") {
            let msg = err
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("rpc error")
                .to_string();
            warn!("mcp.send(http): rpc error - {}", msg);
            return Err(msg);
        }

        Ok(v.get("result").cloned().unwrap_or(serde_json::Value::Null))
    }

    async fn send_notification(
        &mut self,
        method: &str,
        params: Option<serde_json::Value>,
        timeout_ms: u64,
    ) -> Result<(), String> {
        debug!(
            "mcp.send_notification(http): method={} timeout_ms={} url={}",
            method, timeout_ms, self.url
        );

        // Build JSON-RPC notification (no id field)
        let mut req = serde_json::json!({
            "jsonrpc": MCP_JSONRPC_VERSION,
            "method": method,
        });

        if let Some(params_val) = params {
            req["params"] = params_val;
        }

        // Build HTTP request
        let mut request = self
            .client
            .post(self.url.as_str())
            .json(&req)
            .timeout(Duration::from_millis(timeout_ms));

        // Apply headers if present
        if let Some(hs) = self.headers.as_ref().and_then(|v| v.as_object()) {
            let mut rb = request;
            for (k, val) in hs.iter() {
                if let Some(s) = val.as_str() {
                    rb = rb.header(k, s);
                }
            }
            request = rb;
        }

        // Send notification and get response (but don't expect meaningful response)
        let resp = request.send().await.map_err(|e| e.to_string())?;
        let status = resp.status();

        if !status.is_success() {
            warn!(
                "mcp.send_notification(http): http error status={}",
                status.as_u16()
            );
            return Err(format!("HTTP {}", status.as_u16()));
        }

        Ok(())
    }

    fn transport_type(&self) -> &'static str {
        "http"
    }
}
