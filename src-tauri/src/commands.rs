use crate::mcp;
use crate::mcp::McpManager;
use crate::mlc_server::{MLCServerManager, MLCServerStatus};
use serde::Deserialize;
use tauri::State;

// MLC Server Management Commands

#[tauri::command]
pub async fn mlc_get_status(
    manager: State<'_, std::sync::Arc<MLCServerManager>>,
) -> Result<MLCServerStatus, String> {
    Ok(manager.get_status().await)
}

#[tauri::command]
pub async fn mlc_restart(
    manager: State<'_, std::sync::Arc<MLCServerManager>>,
) -> Result<MLCServerStatus, String> {
    manager.restart().await
}

// ------------------ MCP check command ------------------

#[derive(Deserialize)]
#[serde(tag = "transport")] // discriminated union by transport
pub enum McpServerConfig {
    #[serde(rename = "stdio")]
    Stdio {
        name: String,
        description: Option<String>,
        enabled: bool,
        connect_timeout_ms: Option<u64>,
        list_tools_timeout_ms: Option<u64>,
        command: String,
        args: Option<Vec<String>>,
        env: Option<serde_json::Value>,
        cwd: Option<String>,
    },
    #[serde(rename = "http")]
    Http {
        name: String,
        description: Option<String>,
        enabled: bool,
        connect_timeout_ms: Option<u64>,
        list_tools_timeout_ms: Option<u64>,
        url: String,
        headers: Option<serde_json::Value>,
        auth: Option<String>,
        heartbeat_sec: Option<u64>,
    },
}

pub use crate::mcp::McpCheckResult;

#[tauri::command]
pub async fn mcp_check_server(config: McpServerConfig) -> Result<McpCheckResult, String> {
    let result = match config {
        McpServerConfig::Stdio {
            command,
            args,
            env,
            cwd,
            connect_timeout_ms,
            list_tools_timeout_ms,
            ..
        } => {
            let args_vec = args.unwrap_or_default();
            mcp::check_server(mcp::TransportConfig::Stdio {
                command: &command,
                args: &args_vec,
                env: env.as_ref(),
                cwd: cwd.as_deref(),
                connect_timeout_ms: connect_timeout_ms.unwrap_or(5_000),
                list_tools_timeout_ms: list_tools_timeout_ms.unwrap_or(5_000),
            })
            .await
        }
        McpServerConfig::Http {
            url,
            connect_timeout_ms,
            list_tools_timeout_ms,
            ..
        } => {
            mcp::check_server(mcp::TransportConfig::Http {
                url: &url,
                connect_timeout_ms: connect_timeout_ms.unwrap_or(5_000),
                list_tools_timeout_ms: list_tools_timeout_ms.unwrap_or(5_000),
            })
            .await
        }
    };
    Ok(result)
}

// ------------------ MCP list/call commands ------------------

#[tauri::command]
pub async fn mcp_list_tools(
    id: i64,
    manager: tauri::State<'_, std::sync::Arc<McpManager>>,
) -> Result<Vec<mcp::McpToolInfo>, String> {
    // Default timeout for listing
    manager.list_tools(id, 5_000).await
}

#[tauri::command]
pub async fn mcp_call_tool(
    id: i64,
    tool: String,
    args: serde_json::Value,
    manager: tauri::State<'_, std::sync::Arc<McpManager>>,
) -> Result<String, String> {
    // Default timeout for calling a tool
    manager.call_tool(id, &tool, args, 20_000).await
}
