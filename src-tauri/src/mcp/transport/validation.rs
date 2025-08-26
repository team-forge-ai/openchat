//! Server validation and connectivity checking for MCP

use crate::mcp::constants::{MCP_METHOD_TOOLS_LIST};
use crate::mcp::transport::config::TransportConfig;
use crate::mcp::transport::http::create_http_session;
use crate::mcp::transport::parsing::parse_tools_array;
use crate::mcp::transport::session::McpTransport;
use crate::mcp::transport::stdio::spawn_stdio_session;
use crate::mcp::types::McpCheckResult;
use log::{info, warn};

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
                    let _ = session.kill_child().await;
                    return McpCheckResult {
                        ok: false,
                        tools_count: None,
                        tools: None,
                        warning: None,
                        error: Some("Failed to request tools/list".into()),
                    };
                }
            };
            let _ = session.kill_child().await;
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
