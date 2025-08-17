use crate::mcp::constants::{MCP_JSONRPC_VERSION, MCP_METHOD_INITIALIZE, MCP_METHOD_TOOLS_LIST};
use crate::mcp::types::{McpCheckResult, McpToolInfo};
use log::{debug, error, info, warn};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::time::{timeout, Duration};

/// Transport configuration for establishing a session.
#[derive(Debug)]
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

/// A transport-agnostic MCP session.
#[derive(Debug)]
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
    /// Sends a JSON-RPC request over the underlying transport and returns the `result` value.
    pub async fn send(
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
        }
    }
}

// -------------------------------------------------------------------------------------------------
// Common helpers
// -------------------------------------------------------------------------------------------------

fn is_bare_command(command: &str) -> bool {
    #[cfg(target_family = "unix")]
    {
        !command.contains('/')
    }
    #[cfg(target_family = "windows")]
    {
        !command.contains('\\') && !command.contains('/') && !command.contains(':')
    }
}

fn sh_escape(arg: &str) -> String {
    let mut out = String::with_capacity(arg.len() + 2);
    out.push('\'');
    for ch in arg.chars() {
        if ch == '\'' {
            out.push_str("'\\\''");
        } else {
            out.push(ch);
        }
    }
    out.push('\'');
    out
}

fn init_params() -> serde_json::Value {
    serde_json::json!({
        "protocolVersion": crate::mcp::constants::MCP_PROTOCOL_VERSION,
        "capabilities": {},
        "clientInfo": { "name": "OpenChat", "version": "0.1.0" },
    })
}

pub(crate) fn parse_tools_array(result_value: &serde_json::Value) -> Vec<McpToolInfo> {
    let tools = result_value
        .get("tools")
        .and_then(|t| t.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = Vec::with_capacity(tools.len());
    for tool in tools.iter() {
        let Some(name) = tool.get("name").and_then(|n| n.as_str()) else {
            continue;
        };
        let description = tool
            .get("description")
            .and_then(|d| d.as_str())
            .map(|s| s.to_string());
        let schema_val = tool
            .get("inputSchema")
            .cloned()
            .or_else(|| tool.get("input_schema").cloned());
        let input_schema = schema_val.and_then(|v| if v.is_object() { Some(v) } else { None });
        out.push(McpToolInfo {
            name: name.to_string(),
            description,
            input_schema,
        });
    }
    out
}

fn build_stdio_command(command: &str, args: &[String]) -> Command {
    if is_bare_command(command) {
        let shell_path = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let mut composed = String::new();
        composed.push_str(&sh_escape(command));
        for a in args {
            composed.push(' ');
            composed.push_str(&sh_escape(a));
        }
        info!(
            "mcp: using shell wrapper - shell='{}', composed_cmd='{}'",
            shell_path, composed
        );
        let mut c = Command::new(shell_path);
        c.arg("-lc").arg(composed);
        c
    } else {
        info!(
            "mcp: using direct command - cmd='{}', args={:?}",
            command, args
        );
        let mut c = Command::new(command);
        c.args(args);
        c
    }
}

fn apply_env_and_cwd(cmd: &mut Command, env: Option<&serde_json::Value>, cwd: Option<&str>) {
    if let Some(cwd_val) = cwd {
        if cwd_val.trim().is_empty() {
            info!("mcp: cwd is empty string; ignoring current_dir");
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
}

pub(crate) async fn spawn_stdio_session(
    command: &str,
    args: &[String],
    env: Option<&serde_json::Value>,
    cwd: Option<&str>,
    connect_timeout_ms: u64,
) -> Result<McpSession, String> {
    let mut cmd = build_stdio_command(command, args);
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_env_and_cwd(&mut cmd, env, cwd);
    let mut child = timeout(Duration::from_millis(connect_timeout_ms), async {
        cmd.spawn()
    })
    .await
    .map_err(|_| "spawn timeout".to_string())
    .and_then(|r| {
        r.map_err(|e| {
            error!(
                "mcp: failed to spawn process - error={}, kind={:?}, raw_os_error={:?}",
                e,
                e.kind(),
                e.raw_os_error()
            );
            format!(
                "spawn error: {} (kind: {:?}, os_error: {:?})",
                e,
                e.kind(),
                e.raw_os_error()
            )
        })
    })?;
    debug!("mcp: stdio spawned child process (pid={:?})", child.id());
    let stdin = child.stdin.take().ok_or("no stdin")?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let mut session = McpSession::Stdio {
        child,
        stdin,
        reader: BufReader::new(stdout),
        next_id: 0,
    };
    let _ = session
        .send(MCP_METHOD_INITIALIZE, init_params(), connect_timeout_ms)
        .await?;
    Ok(session)
}

fn build_http_client(timeout_ms: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| e.to_string())
}

pub(crate) async fn create_http_session(
    url: &str,
    headers: Option<&serde_json::Value>,
    connect_timeout_ms: u64,
) -> Result<McpSession, String> {
    let client = build_http_client(connect_timeout_ms)?;
    let mut session = McpSession::Http {
        client,
        url: url.to_string(),
        headers: headers.cloned(),
        next_id: 0,
    };
    let _ = session
        .send(MCP_METHOD_INITIALIZE, init_params(), connect_timeout_ms)
        .await?;
    Ok(session)
}

/// Best-effort helper that attempts to connect and list tools for a given transport configuration.
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
            info!("mcp.check: stdio connect (cmd='{}', args_count={}, cwd={:?}, connect_timeout_ms={}, list_tools_timeout_ms={})", command, args.len(), cwd, connect_timeout_ms, list_tools_timeout_ms);
            let mut session =
                match spawn_stdio_session(command, args, env, cwd, connect_timeout_ms).await {
                    Ok(s) => s,
                    Err(e) => {
                        return McpCheckResult {
                            ok: false,
                            tools_count: None,
                            tools: None,
                            warning: None,
                            error: Some(e),
                        };
                    }
                };
            let tools_res = session
                .send(
                    MCP_METHOD_TOOLS_LIST,
                    serde_json::json!({}),
                    list_tools_timeout_ms,
                )
                .await;
            let tools = match tools_res {
                Ok(v) => parse_tools_array(&v),
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
            info!("mcp.check: http connect (url='{}', connect_timeout_ms={}, list_tools_timeout_ms={})", url, connect_timeout_ms, list_tools_timeout_ms);
            let mut session = match create_http_session(url, headers, connect_timeout_ms).await {
                Ok(s) => s,
                Err(e) => {
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some(e),
                    };
                }
            };
            let tools_res = session
                .send(
                    MCP_METHOD_TOOLS_LIST,
                    serde_json::json!({}),
                    list_tools_timeout_ms,
                )
                .await;
            let tools = match tools_res {
                Ok(v) => parse_tools_array(&v),
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

// (Manager lives in manager.rs)

#[cfg(test)]
mod tests {
    use super::parse_tools_array;
    use serde_json::json;

    #[test]
    fn parse_tools_array_handles_both_schema_keys_and_missing() {
        let input = json!({
            "tools": [
                {
                    "name": "apple_execute",
                    "description": "Run AppleScript",
                    "inputSchema": {
                        "type": "object",
                        "properties": { "code_snippet": { "type": "string" } }
                    }
                },
                {
                    "name": "lowercase",
                    "input_schema": {
                        "type": "object",
                        "properties": { "text": { "type": "string" } }
                    }
                },
                { "name": "no_schema" },
                { "description": "missing name" }
            ]
        });

        let tools = parse_tools_array(&input);
        assert_eq!(tools.len(), 3);

        assert_eq!(tools[0].name, "apple_execute");
        assert_eq!(tools[0].description.as_deref(), Some("Run AppleScript"));
        assert!(tools[0].input_schema.is_some());
        let schema0 = tools[0].input_schema.as_ref().unwrap();
        assert_eq!(schema0.get("type").and_then(|v| v.as_str()), Some("object"));

        assert_eq!(tools[1].name, "lowercase");
        assert!(tools[1].input_schema.is_some());
        let schema1 = tools[1].input_schema.as_ref().unwrap();
        assert_eq!(schema1.get("type").and_then(|v| v.as_str()), Some("object"));

        assert_eq!(tools[2].name, "no_schema");
        assert!(tools[2].input_schema.is_none());
    }
}
