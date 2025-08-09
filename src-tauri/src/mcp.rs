use serde::Serialize;
use std::process::Stdio;
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
    WebSocket {
        url: &'a str,
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

            // Placeholder: we don't have rmcp wired yet, so just report success on spawn
            // and immediately kill the process.
            let _ = timeout(Duration::from_millis(list_tools_timeout_ms), async {
                // Here is where we'd use rmcp stdio transport to list tools.
            })
            .await;

            let _ = child.kill().await;
            McpCheckResult {
                ok: true,
                tools_count: Some(0),
                tools: Some(vec![]),
                warning: Some("Tool listing not yet implemented".into()),
                error: None,
            }
        }
        TransportConfig::WebSocket { .. } | TransportConfig::Http { .. } => McpCheckResult {
            ok: true,
            tools_count: Some(0),
            tools: Some(vec![]),
            warning: Some("Network transports not yet validated".into()),
            error: None,
        },
    }
}
