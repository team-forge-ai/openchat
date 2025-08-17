//! Minimal MCP (Model Context Protocol) client utilities for OpenChat.
//!
//! This module provides:
//! - A transport-agnostic session (`McpSession`) over either STDIO (spawning a
//!   child process) or HTTP (JSON-RPC over POST).
//! - A lightweight manager (`McpManager`) that caches sessions by identifier and
//!   exposes high-level operations such as listing tools and calling a tool.
//! - A convenience `check_server` helper to quickly verify connectivity and
//!   discover available tools, with timeouts for connection and listing.
//!
//! Design notes:
//! - Transport is abstracted behind a common `send` method.
//! - Timeouts are enforced at every boundary to avoid hanging the UI.
//! - No sensitive values (like env var contents or request bodies) are logged.
//!   Only small, metadata-level information is emitted via the `log` facade so
//!   logs remain useful and safe.
pub mod constants;
pub mod serde_utils;
pub mod session;
pub mod store;

use crate::mcp::constants::{
    MCP_JSONRPC_VERSION, MCP_METHOD_INITIALIZE, MCP_METHOD_TOOLS_CALL, MCP_METHOD_TOOLS_LIST,
};
use log::{debug, error, info, warn};
use serde::Serialize;
use std::io;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};

/// Returns true if the provided command string looks like a bare program name
/// without any path separators. In that case, we should prefer invoking it via
/// the user's login shell so that their configured PATH (nvm, rbenv, etc.) is
/// honored by the spawned process.
fn is_bare_command(command: &str) -> bool {
    #[cfg(target_family = "unix")]
    {
        !command.contains('/')
    }
    #[cfg(target_family = "windows")]
    {
        // On Windows, treat commands without a path separator or drive as bare
        !command.contains('\\') && !command.contains('/') && !command.contains(':')
    }
}

/// Very small shell-escape for use with single-quoted arguments.
/// This wraps the string in single quotes and escapes any internal single quotes
/// using the POSIX-safe pattern: ' -> '\''
fn sh_escape(arg: &str) -> String {
    let mut out = String::with_capacity(arg.len() + 2);
    out.push('\'');
    for ch in arg.chars() {
        if ch == '\'' {
            out.push_str("'\\''");
        } else {
            out.push(ch);
        }
    }
    out.push('\'');
    out
}

/// Basic metadata describing an MCP tool.
#[derive(Serialize)]
pub struct McpToolInfo {
    pub name: String,
    pub description: Option<String>,
    /// JSON schema describing the tool input. Serialized as `inputSchema` for the frontend.
    #[serde(rename = "inputSchema", skip_serializing_if = "Option::is_none")]
    pub input_schema: Option<serde_json::Value>,
}

/// Result of performing a best-effort server check.
#[derive(Serialize)]
pub struct McpCheckResult {
    pub ok: bool,
    pub tools_count: Option<u32>,
    pub tools: Option<Vec<McpToolInfo>>,
    pub warning: Option<String>,
    pub error: Option<String>,
}

/// Configuration for connecting to an MCP server.
pub enum TransportConfig<'a> {
    Stdio {
        command: &'a str,
        args: &'a [String],
        env: Option<&'a serde_json::Value>,
        cwd: Option<&'a str>,
        connect_timeout_ms: u64,
        list_tools_timeout_ms: u64,
    },
    Http {
        url: &'a str,
        headers: Option<&'a serde_json::Value>,
        connect_timeout_ms: u64,
        list_tools_timeout_ms: u64,
    },
}

/// Best-effort helper that attempts to connect and list tools for a given
/// transport configuration.
///
/// Returns `McpCheckResult` with tool metadata on success or an error/warning
/// message for diagnostics on failure.
pub async fn check_server(config: TransportConfig<'_>) -> McpCheckResult {
    match config {
        TransportConfig::Stdio {
            command,
            args,
            env,
            cwd,
            connect_timeout_ms,
            list_tools_timeout_ms,
        } => {
            if command.trim().is_empty() {
                return McpCheckResult {
                    ok: false,
                    tools_count: None,
                    tools: None,
                    warning: None,
                    error: Some("Command cannot be empty".into()),
                };
            }

            info!(
                "mcp.check: stdio connect (cmd='{}', args_count={}, cwd={:?}, connect_timeout_ms={}, list_tools_timeout_ms={})",
                command,
                args.len(),
                cwd,
                connect_timeout_ms,
                list_tools_timeout_ms
            );
            // If the command is a bare program name (e.g., "npx"), prefer executing
            // via the user's login shell so that their PATH (nvm, rbenv, etc.) is applied.
            let use_shell = is_bare_command(command);
            let mut cmd = if use_shell {
                let shell_path = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
                let mut composed = String::new();
                composed.push_str(&sh_escape(command));
                for a in args {
                    composed.push(' ');
                    composed.push_str(&sh_escape(a));
                }
                info!(
                    "mcp.check: using shell wrapper - shell='{}', composed_cmd='{}'",
                    shell_path, composed
                );
                let mut c = Command::new(shell_path);
                c.arg("-lc").arg(composed);
                c
            } else {
                info!(
                    "mcp.check: using direct command - cmd='{}', args={:?}",
                    command, args
                );
                let mut c = Command::new(command);
                c.args(args);
                c
            };
            cmd.stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());
            if let Some(cwd_val) = cwd {
                if cwd_val.trim().is_empty() {
                    info!("mcp.check: cwd is empty string; ignoring current_dir");
                } else {
                    cmd.current_dir(cwd_val);
                }
            }
            if let Some(env_obj) = env.and_then(|v| v.as_object()) {
                for (k, val) in env_obj.iter() {
                    if let Some(s) = val.as_str() {
                        cmd.env(k, s);
                    }
                }
            }

            let child_res = timeout(Duration::from_millis(connect_timeout_ms), async {
                cmd.spawn()
            })
            .await;
            let mut child = match child_res {
                Ok(Ok(c)) => {
                    debug!("mcp.check: stdio spawned child process (pid={:?})", c.id());
                    c
                }
                Ok(Err(e)) => {
                    error!(
                        "mcp.check: failed to spawn process - error={}, kind={:?}, raw_os_error={:?}",
                        e, e.kind(), e.raw_os_error()
                    );
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some(format!(
                            "Failed to spawn: {} (kind: {:?}, os_error: {:?})",
                            e,
                            e.kind(),
                            e.raw_os_error()
                        )),
                    };
                }
                Err(_) => {
                    warn!(
                        "mcp.check: timed out spawning process (timeout_ms={})",
                        connect_timeout_ms
                    );
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some("Timed out spawning process".into()),
                    };
                }
            };

            let Some(stdin) = child.stdin.take() else {
                error!("mcp.check: failed to open stdin to child");
                let _ = child.kill().await;
                return McpCheckResult {
                    ok: false,
                    tools_count: None,
                    tools: None,
                    warning: None,
                    error: Some("Failed to open stdin".into()),
                };
            };
            let stdout = child
                .stdout
                .take()
                .ok_or_else(|| io::Error::new(io::ErrorKind::Other, "no stdout"));
            let reader = match stdout {
                Ok(s) => BufReader::new(s),
                Err(e) => {
                    error!("mcp.check: failed to open stdout: {}", e);
                    let _ = child.kill().await;
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some(format!("Failed to open stdout: {}", e)),
                    };
                }
            };

            let mut session = McpSession::Stdio {
                child,
                stdin,
                reader,
                next_id: 0,
            };

            debug!("mcp.check: sending initialize over stdio");
            let init_params = serde_json::json!({
                "protocolVersion": crate::mcp::constants::MCP_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": { "name": "OpenChat", "version": "0.1.0" }
            });
            if session
                .send(MCP_METHOD_INITIALIZE, init_params, connect_timeout_ms)
                .await
                .is_err()
            {
                warn!("mcp.check: initialize failed over stdio");
                if let McpSession::Stdio { child, .. } = &mut session {
                    let _ = child.kill().await;
                }
                return McpCheckResult {
                    ok: false,
                    tools_count: None,
                    tools: None,
                    warning: None,
                    error: Some("Failed to send initialize".into()),
                };
            }

            let tools_res = session
                .send(
                    MCP_METHOD_TOOLS_LIST,
                    serde_json::json!({}),
                    list_tools_timeout_ms,
                )
                .await;
            let tools = match tools_res {
                Ok(v) => v
                    .get("tools")
                    .and_then(|t| t.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|tool| {
                                let name = tool.get("name").and_then(|n| n.as_str())?;
                                let description = tool
                                    .get("description")
                                    .and_then(|d| d.as_str())
                                    .map(|s| s.to_string());
                                // Support both inputSchema (camelCase) and input_schema (snake_case)
                                let schema_val = tool
                                    .get("inputSchema")
                                    .cloned()
                                    .or_else(|| tool.get("input_schema").cloned());
                                let input_schema =
                                    schema_val
                                        .and_then(|v| if v.is_object() { Some(v) } else { None });
                                Some(McpToolInfo {
                                    name: name.to_string(),
                                    description,
                                    input_schema,
                                })
                            })
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default(),
                Err(_) => {
                    warn!("mcp.check: tools/list failed over stdio");
                    if let McpSession::Stdio { child, .. } = &mut session {
                        let _ = child.kill().await;
                    }
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some("Failed to request tools/list".into()),
                    };
                }
            };

            if let McpSession::Stdio { child, .. } = &mut session {
                let _ = child.kill().await;
            }

            info!("mcp.check: stdio ok - tools_count={}", tools.len());
            McpCheckResult {
                ok: true,
                tools_count: Some(tools.len() as u32),
                tools: Some(tools),
                warning: None,
                error: None,
            }
        }
        TransportConfig::Http {
            url,
            headers,
            connect_timeout_ms,
            list_tools_timeout_ms,
        } => {
            info!(
                "mcp.check: http connect (url='{}', connect_timeout_ms={}, list_tools_timeout_ms={})",
                url,
                connect_timeout_ms,
                list_tools_timeout_ms
            );
            let client = match reqwest::Client::builder()
                .timeout(Duration::from_millis(connect_timeout_ms))
                .build()
            {
                Ok(c) => c,
                Err(e) => {
                    error!("mcp.check: failed to build HTTP client: {}", e);
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some(format!("Failed to build HTTP client: {}", e)),
                    };
                }
            };

            let mut session = McpSession::Http {
                client,
                url: url.to_string(),
                headers: headers.cloned(),
                next_id: 0,
            };

            debug!("mcp.check: sending initialize over http");
            let init_params = serde_json::json!({
                "protocolVersion": crate::mcp::constants::MCP_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": { "name": "OpenChat", "version": "0.1.0" }
            });
            if session
                .send(MCP_METHOD_INITIALIZE, init_params, connect_timeout_ms)
                .await
                .is_err()
            {
                warn!("mcp.check: http initialize failed");
                return McpCheckResult {
                    ok: false,
                    tools_count: None,
                    tools: None,
                    warning: None,
                    error: Some("Failed HTTP initialize".into()),
                };
            }

            let tools_res = session
                .send(
                    MCP_METHOD_TOOLS_LIST,
                    serde_json::json!({}),
                    list_tools_timeout_ms,
                )
                .await;
            let tools = match tools_res {
                Ok(v) => v
                    .get("tools")
                    .and_then(|t| t.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|tool| {
                                let name = tool.get("name").and_then(|n| n.as_str())?;
                                let description = tool
                                    .get("description")
                                    .and_then(|d| d.as_str())
                                    .map(|s| s.to_string());
                                let schema_val = tool
                                    .get("inputSchema")
                                    .cloned()
                                    .or_else(|| tool.get("input_schema").cloned());
                                let input_schema =
                                    schema_val
                                        .and_then(|v| if v.is_object() { Some(v) } else { None });
                                Some(McpToolInfo {
                                    name: name.to_string(),
                                    description,
                                    input_schema,
                                })
                            })
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default(),
                Err(e) => {
                    warn!("mcp.check: http tools/list failed: {}", e);
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some(format!("Failed HTTP tools/list: {}", e)),
                    };
                }
            };

            info!("mcp.check: http ok - tools_count={}", tools.len());
            McpCheckResult {
                ok: true,
                tools_count: Some(tools.len() as u32),
                tools: Some(tools),
                warning: None,
                error: None,
            }
        }
    }
}

/// A transport-agnostic MCP session.
pub enum McpSession {
    Stdio {
        child: tokio::process::Child,
        stdin: tokio::process::ChildStdin,
        reader: BufReader<tokio::process::ChildStdout>,
        next_id: u64,
    },
    Http {
        client: reqwest::Client,
        url: String,
        headers: Option<serde_json::Value>,
        next_id: u64,
    },
}

impl McpSession {
    /// Sends a JSON-RPC request over the underlying transport and returns the
    /// `result` value on success. RPC errors are converted into `Err(String)`.
    async fn send(
        &mut self,
        method: &str,
        params: serde_json::Value,
        timeout_ms: u64,
    ) -> Result<serde_json::Value, String> {
        match self {
            McpSession::Stdio {
                stdin,
                reader,
                next_id,
                ..
            } => {
                *next_id = next_id.saturating_add(1);
                debug!(
                    "mcp.send(stdio): id={} method={} timeout_ms={}",
                    *next_id, method, timeout_ms
                );
                let req = serde_json::json!({
                    "jsonrpc": MCP_JSONRPC_VERSION,
                    "id": *next_id,
                    "method": method,
                    "params": params,
                });
                let mut line = serde_json::to_string(&req).map_err(|e| e.to_string())?;
                line.push('\n');
                let write_res = timeout(
                    Duration::from_millis(timeout_ms),
                    stdin.write_all(line.as_bytes()),
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

                let mut buf = String::new();
                let read_res = timeout(
                    Duration::from_millis(timeout_ms),
                    reader.read_line(&mut buf),
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
            McpSession::Http {
                client,
                url,
                headers,
                next_id,
            } => {
                *next_id = next_id.saturating_add(1);
                debug!(
                    "mcp.send(http): id={} method={} timeout_ms={} url={}",
                    *next_id, method, timeout_ms, url
                );
                let req = serde_json::json!({
                    "jsonrpc": MCP_JSONRPC_VERSION,
                    "id": *next_id,
                    "method": method,
                    "params": params,
                });
                let mut request = client
                    .post(url.as_str())
                    .json(&req)
                    .timeout(Duration::from_millis(timeout_ms));
                if let Some(hs) = headers.as_ref().and_then(|v| v.as_object()) {
                    let mut rb = request;
                    for (k, val) in hs.iter() {
                        if let Some(s) = val.as_str() {
                            rb = rb.header(k, s);
                        }
                    }
                    request = rb;
                }
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
                let v: serde_json::Value = match serde_json::from_str(&body_text) {
                    Ok(val) => val,
                    Err(e) => {
                        warn!(
                            "mcp.send(http): response parse error - {} (body_len={})",
                            e,
                            body_text.len()
                        );
                        return Err(body_text.clone());
                    }
                };
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
        }
    }
}

/// Holds and reuses MCP sessions keyed by an application-level identifier.
pub struct McpManager {
    sessions: Mutex<std::collections::HashMap<i64, McpSession>>,
}

impl McpManager {
    /// Creates a new, empty `McpManager`.
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            sessions: Mutex::new(std::collections::HashMap::new()),
        })
    }

    /// Ensure a STDIO session exists for `id`, creating and initializing one if
    /// missing. Safe to call repeatedly.
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
            debug!("mcp.manager: stdio session already exists (id={})", id);
            return Ok(());
        }

        info!(
            "mcp.manager: creating stdio session (id={}, cmd='{}', args={:?}, cwd={:?})",
            id, command, args, cwd
        );
        // If the command is a bare program name (e.g., "npx"), prefer executing
        // via the user's login shell so that their PATH (nvm, rbenv, etc.) is applied.
        let use_shell = is_bare_command(command);
        let mut cmd = if use_shell {
            let shell_path = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
            let mut composed = String::new();
            composed.push_str(&sh_escape(command));
            for a in args {
                composed.push(' ');
                composed.push_str(&sh_escape(a));
            }
            info!(
                "mcp.manager: using shell wrapper - shell='{}', composed_cmd='{}'",
                shell_path, composed
            );
            let mut c = Command::new(shell_path);
            c.arg("-lc").arg(composed);
            c
        } else {
            info!(
                "mcp.manager: using direct command - cmd='{}', args={:?}",
                command, args
            );
            let mut c = Command::new(command);
            c.args(args);
            c
        };
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(cwd_val) = cwd {
            if cwd_val.trim().is_empty() {
                info!("mcp.manager: cwd is empty string; ignoring current_dir");
            } else {
                cmd.current_dir(cwd_val);
            }
        }
        if let Some(env_obj) = env.as_object() {
            for (k, val) in env_obj.iter() {
                if let Some(s) = val.as_str() {
                    cmd.env(k, s);
                }
            }
        }

        let mut child =
            timeout(Duration::from_millis(connect_timeout_ms), async {
                cmd.spawn()
            })
            .await
            .map_err(|_| "spawn timeout".to_string())
            .and_then(|r| {
                r.map_err(|e| {
                    error!(
                "mcp.manager: failed to spawn process - error={}, kind={:?}, raw_os_error={:?}",
                e, e.kind(), e.raw_os_error()
            );
                    format!(
                        "spawn error: {} (kind: {:?}, os_error: {:?})",
                        e,
                        e.kind(),
                        e.raw_os_error()
                    )
                })
            })?;
        debug!(
            "mcp.manager: stdio spawned child process (pid={:?})",
            child.id()
        );
        let stdin = child.stdin.take().ok_or("no stdin")?;
        let stdout = child.stdout.take().ok_or("no stdout")?;
        let mut session = McpSession::Stdio {
            child,
            stdin,
            reader: BufReader::new(stdout),
            next_id: 0,
        };
        let init_params = serde_json::json!({
            "protocolVersion": crate::mcp::constants::MCP_PROTOCOL_VERSION,
            "capabilities": {},
            "clientInfo": { "name": "OpenChat", "version": "0.1.0" }
        });
        let _ = session
            .send(MCP_METHOD_INITIALIZE, init_params, connect_timeout_ms)
            .await?;
        sessions.insert(id, session);
        info!("mcp.manager: stdio session ready (id={})", id);
        Ok(())
    }

    /// Ensure an HTTP session exists for `id`, creating and initializing one if
    /// missing. Safe to call repeatedly.
    pub async fn ensure_http(
        &self,
        id: i64,
        url: &str,
        headers: Option<&serde_json::Value>,
        connect_timeout_ms: u64,
    ) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if sessions.contains_key(&id) {
            debug!("mcp.manager: http session already exists (id={})", id);
            return Ok(());
        }

        info!(
            "mcp.manager: creating http session (id={}, url={})",
            id, url
        );
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(connect_timeout_ms))
            .build()
            .map_err(|e| e.to_string())?;

        let mut session = McpSession::Http {
            client,
            url: url.to_string(),
            headers: headers.cloned(),
            next_id: 0,
        };
        let init_params = serde_json::json!({
            "protocolVersion": crate::mcp::constants::MCP_PROTOCOL_VERSION,
            "capabilities": {},
            "clientInfo": { "name": "OpenChat", "version": "0.1.0" }
        });
        let _ = session
            .send(MCP_METHOD_INITIALIZE, init_params, connect_timeout_ms)
            .await?;
        sessions.insert(id, session);
        info!("mcp.manager: http session ready (id={})", id);
        Ok(())
    }

    /// Returns the list of available tools for the given session id.
    pub async fn list_tools(&self, id: i64, timeout_ms: u64) -> Result<Vec<McpToolInfo>, String> {
        let mut sessions = self.sessions.lock().await;
        let s = sessions.get_mut(&id).ok_or("not connected")?;
        let result = s
            .send(MCP_METHOD_TOOLS_LIST, serde_json::json!({}), timeout_ms)
            .await?;
        let tools = result
            .get("tools")
            .and_then(|t| t.as_array())
            .ok_or("invalid tools")?;
        let mut out = Vec::with_capacity(tools.len());
        for tool in tools {
            if let Some(name) = tool.get("name").and_then(|n| n.as_str()) {
                let description = tool
                    .get("description")
                    .and_then(|d| d.as_str())
                    .map(|s| s.to_string());
                let schema_val = tool
                    .get("inputSchema")
                    .cloned()
                    .or_else(|| tool.get("input_schema").cloned());
                let input_schema =
                    schema_val.and_then(|v| if v.is_object() { Some(v) } else { None });
                out.push(McpToolInfo {
                    name: name.to_string(),
                    description,
                    input_schema,
                });
            }
        }
        info!(
            "mcp.manager: list_tools ok (id={}, tools_count={})",
            id,
            out.len()
        );
        Ok(out)
    }

    /// Calls a named tool with the provided JSON arguments and returns its
    /// string content. The call is subject to `timeout_ms`.
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
                MCP_METHOD_TOOLS_CALL,
                serde_json::json!({ "name": tool, "arguments": args }),
                timeout_ms,
            )
            .await?;
        // Support both string content and array-of-blocks content per MCP
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
        info!(
            "mcp.manager: call_tool ok (id={}, tool='{}', content_len={})",
            id,
            tool,
            content.len()
        );
        Ok(content)
    }
}
