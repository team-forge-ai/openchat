use serde::{Deserialize, Serialize};
use std::io;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::time::{timeout, Duration};

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

            // Spawn with timeout for connect phase
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

            // Minimal MCP JSON-RPC over stdio: send initialize, then tools/list
            let Some(mut stdin) = child.stdin.take() else {
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
            let mut reader = match stdout {
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

            #[derive(Serialize)]
            struct JsonRpcReq<'a, T> {
                jsonrpc: &'a str,
                id: u64,
                method: &'a str,
                params: T,
            }

            #[derive(Serialize)]
            struct InitializeParams<'a> {
                client: ClientInfo<'a>,
            }

            #[derive(Serialize)]
            struct ClientInfo<'a> {
                name: &'a str,
                version: &'a str,
            }

            #[derive(Deserialize)]
            struct JsonRpcResp<T> {
                jsonrpc: String,
                id: Option<u64>,
                result: Option<T>,
                error: Option<JsonRpcError>,
            }

            #[derive(Deserialize)]
            struct JsonRpcError {
                code: i64,
                message: String,
            }

            #[derive(Deserialize)]
            struct ListToolsResult {
                tools: Vec<ToolDesc>,
            }

            #[derive(Deserialize)]
            struct ToolDesc {
                name: String,
                #[allow(dead_code)]
                description: Option<String>,
            }

            // Send initialize
            let init = JsonRpcReq {
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: InitializeParams {
                    client: ClientInfo {
                        name: "OpenChat",
                        version: "0.1.0",
                    },
                },
            };
            let mut line = serde_json::to_string(&init).unwrap_or_else(|_| String::new());
            line.push('\n');
            let init_res = timeout(Duration::from_millis(connect_timeout_ms), async {
                stdin.write_all(line.as_bytes()).await
            })
            .await;
            if init_res.is_err() || init_res.unwrap().is_err() {
                let _ = child.kill().await;
                return McpCheckResult {
                    ok: false,
                    tools_count: None,
                    tools: None,
                    warning: None,
                    error: Some("Failed to send initialize".into()),
                };
            }

            // Read until we get an initialize response (best-effort)
            let mut buf = String::new();
            let _ = timeout(
                Duration::from_millis(connect_timeout_ms),
                reader.read_line(&mut buf),
            )
            .await;

            // Send tools/list
            let list_req = JsonRpcReq {
                jsonrpc: "2.0",
                id: 2,
                method: "tools/list",
                params: serde_json::json!({}),
            };
            let mut list_line = serde_json::to_string(&list_req).unwrap_or_else(|_| String::new());
            list_line.push('\n');
            let list_send = timeout(Duration::from_millis(list_tools_timeout_ms), async {
                stdin.write_all(list_line.as_bytes()).await
            })
            .await;
            if list_send.is_err() || list_send.unwrap().is_err() {
                let _ = child.kill().await;
                return McpCheckResult {
                    ok: false,
                    tools_count: None,
                    tools: None,
                    warning: None,
                    error: Some("Failed to request tools/list".into()),
                };
            }

            // Read response line for tools/list
            let mut resp_line = String::new();
            let read_res = timeout(
                Duration::from_millis(list_tools_timeout_ms),
                reader.read_line(&mut resp_line),
            )
            .await;
            let tools = match read_res {
                Ok(Ok(_n)) => {
                    let parsed: Result<JsonRpcResp<ListToolsResult>, _> =
                        serde_json::from_str(&resp_line);
                    match parsed {
                        Ok(resp) => {
                            if let Some(err) = resp.error {
                                let _ = child.kill().await;
                                return McpCheckResult {
                                    ok: false,
                                    tools_count: None,
                                    tools: None,
                                    warning: None,
                                    error: Some(format!("Server error: {}", err.message)),
                                };
                            }
                            let list = resp.result.map(|r| r.tools).unwrap_or_default();
                            list.into_iter()
                                .map(|t| McpToolInfo {
                                    name: t.name,
                                    description: None,
                                })
                                .collect::<Vec<_>>()
                        }
                        Err(e) => {
                            let _ = child.kill().await;
                            return McpCheckResult {
                                ok: false,
                                tools_count: None,
                                tools: None,
                                warning: None,
                                error: Some(format!("Invalid response: {}", e)),
                            };
                        }
                    }
                }
                _ => {
                    let _ = child.kill().await;
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some("Timed out waiting for tools/list".into()),
                    };
                }
            };

            let count = tools.len() as u32;
            let _ = child.kill().await;
            McpCheckResult {
                ok: true,
                tools_count: Some(count),
                tools: Some(tools),
                warning: None,
                error: None,
            }
        }
        TransportConfig::Http { .. } => McpCheckResult {
            ok: false,
            tools_count: None,
            tools: None,
            warning: None,
            error: Some("HTTP transport validation not implemented yet".into()),
        },
    }
}
