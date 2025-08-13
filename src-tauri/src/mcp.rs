pub mod constants;
pub mod rpc;
pub mod serde_utils;
pub mod session;
pub mod store;

use serde::Serialize;
use std::io;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};

const JSONRPC_VERSION: &str = "2.0";
const METHOD_INITIALIZE: &str = "initialize";
const METHOD_TOOLS_LIST: &str = "tools/list";
const METHOD_TOOLS_CALL: &str = "tools/call";

#[derive(Serialize)]
pub struct McpToolInfo {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Serialize)]
pub struct McpCheckResult {
    pub ok: bool,
    pub tools_count: Option<u32>,
    pub tools: Option<Vec<McpToolInfo>>,
    pub warning: Option<String>,
    pub error: Option<String>,
}

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
        connect_timeout_ms: u64,
        list_tools_timeout_ms: u64,
    },
}

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

            let mut cmd = Command::new(command);
            cmd.args(args);
            cmd.stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());
            if let Some(cwd) = cwd {
                cmd.current_dir(cwd);
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
                Ok(Ok(c)) => c,
                Ok(Err(e)) => {
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some(format!("Failed to spawn: {}", e)),
                    }
                }
                Err(_) => {
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some("Timed out spawning process".into()),
                    }
                }
            };

            let Some(stdin) = child.stdin.take() else {
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

            if session
                .send(
                    METHOD_INITIALIZE,
                    serde_json::json!({
                        "client": { "name": "OpenChat", "version": "0.1.0" }
                    }),
                    connect_timeout_ms,
                )
                .await
                .is_err()
            {
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
                    METHOD_TOOLS_LIST,
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
                            .filter_map(|t| t.get("name").and_then(|n| n.as_str()))
                            .map(|name| McpToolInfo {
                                name: name.to_string(),
                                description: None,
                            })
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default(),
                Err(_) => {
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
            connect_timeout_ms,
            list_tools_timeout_ms,
        } => {
            let client = match reqwest::Client::builder()
                .timeout(Duration::from_millis(connect_timeout_ms))
                .build()
            {
                Ok(c) => c,
                Err(e) => {
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some(format!("Failed to build HTTP client: {}", e)),
                    }
                }
            };

            let mut session = McpSession::Http {
                client,
                url: url.to_string(),
                headers: None,
                next_id: 0,
            };

            if session
                .send(
                    METHOD_INITIALIZE,
                    serde_json::json!({
                        "client": { "name": "OpenChat", "version": "0.1.0" }
                    }),
                    connect_timeout_ms,
                )
                .await
                .is_err()
            {
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
                    METHOD_TOOLS_LIST,
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
                            .filter_map(|t| t.get("name").and_then(|n| n.as_str()))
                            .map(|name| McpToolInfo {
                                name: name.to_string(),
                                description: None,
                            })
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default(),
                Err(e) => {
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some(format!("Failed HTTP tools/list: {}", e)),
                    };
                }
            };

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
                let req = serde_json::json!({
                    "jsonrpc": JSONRPC_VERSION,
                    "id": *next_id,
                    "method": method,
                    "params": params,
                });
                let mut line = serde_json::to_string(&req).map_err(|e| e.to_string())?;
                line.push('\n');
                timeout(
                    Duration::from_millis(timeout_ms),
                    stdin.write_all(line.as_bytes()),
                )
                .await
                .map_err(|_| "write timeout".to_string())
                .and_then(|r| r.map_err(|e| e.to_string()))?;

                let mut buf = String::new();
                timeout(
                    Duration::from_millis(timeout_ms),
                    reader.read_line(&mut buf),
                )
                .await
                .map_err(|_| "read timeout".to_string())
                .and_then(|r| r.map_err(|e| e.to_string()))?;
                let v: serde_json::Value = serde_json::from_str(&buf).map_err(|e| e.to_string())?;
                if let Some(err) = v.get("error") {
                    let msg = err
                        .get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("rpc error")
                        .to_string();
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
                let req = serde_json::json!({
                    "jsonrpc": JSONRPC_VERSION,
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
                let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
                if let Some(err) = v.get("error") {
                    let msg = err
                        .get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("rpc error")
                        .to_string();
                    return Err(msg);
                }
                Ok(v.get("result").cloned().unwrap_or(serde_json::Value::Null))
            }
        }
    }
}

pub struct McpManager {
    sessions: Mutex<std::collections::HashMap<i64, McpSession>>,
}

impl McpManager {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            sessions: Mutex::new(std::collections::HashMap::new()),
        })
    }

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

        let mut cmd = Command::new(command);
        cmd.args(args);
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(cwd) = cwd {
            cmd.current_dir(cwd);
        }
        if let Some(env_obj) = env.as_object() {
            for (k, val) in env_obj.iter() {
                if let Some(s) = val.as_str() {
                    cmd.env(k, s);
                }
            }
        }

        let mut child = timeout(Duration::from_millis(connect_timeout_ms), async {
            cmd.spawn()
        })
        .await
        .map_err(|_| "spawn timeout".to_string())
        .and_then(|r| r.map_err(|e| e.to_string()))?;
        let stdin = child.stdin.take().ok_or("no stdin")?;
        let stdout = child.stdout.take().ok_or("no stdout")?;
        let mut session = McpSession::Stdio {
            child,
            stdin,
            reader: BufReader::new(stdout),
            next_id: 0,
        };
        let _ = session
            .send(
                METHOD_INITIALIZE,
                serde_json::json!({
                    "client": { "name": "OpenChat", "version": "0.1.0" }
                }),
                connect_timeout_ms,
            )
            .await?;
        sessions.insert(id, session);
        Ok(())
    }

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
        let _ = session
            .send(
                METHOD_INITIALIZE,
                serde_json::json!({
                    "client": { "name": "OpenChat", "version": "0.1.0" }
                }),
                connect_timeout_ms,
            )
            .await?;
        sessions.insert(id, session);
        Ok(())
    }

    pub async fn list_tools(&self, id: i64, timeout_ms: u64) -> Result<Vec<McpToolInfo>, String> {
        let mut sessions = self.sessions.lock().await;
        let s = sessions.get_mut(&id).ok_or("not connected")?;
        let result = s
            .send(METHOD_TOOLS_LIST, serde_json::json!({}), timeout_ms)
            .await?;
        let tools = result
            .get("tools")
            .and_then(|t| t.as_array())
            .ok_or("invalid tools")?;
        let mut out = Vec::with_capacity(tools.len());
        for t in tools {
            if let Some(name) = t.get("name").and_then(|n| n.as_str()) {
                out.push(McpToolInfo {
                    name: name.to_string(),
                    description: None,
                });
            }
        }
        Ok(out)
    }

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
                METHOD_TOOLS_CALL,
                serde_json::json!({ "name": tool, "arguments": args }),
                timeout_ms,
            )
            .await?;
        let content = result
            .get("content")
            .and_then(|c| c.as_str())
            .unwrap_or("")
            .to_string();
        Ok(content)
    }
}
