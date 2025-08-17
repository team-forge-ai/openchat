use crate::mcp;
use crate::mcp::constants::{
    MCP_DEFAULT_CONNECT_TIMEOUT_MS, MCP_DEFAULT_LIST_TOOLS_TIMEOUT_MS,
    MCP_DEFAULT_TOOL_CALL_TIMEOUT_MS,
};
use crate::mcp::serde_utils::merge_auth_header;
use crate::mcp::session::ensure_mcp_session;
use crate::mcp::McpManager;
use crate::mlc_server::{MLCServerManager, MLCServerStatus};
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

type CmdResult<T> = Result<T, String>;

// MLC Server Management Commands

#[tauri::command]
pub async fn mlc_get_status(
    manager: State<'_, std::sync::Arc<MLCServerManager>>,
) -> CmdResult<MLCServerStatus> {
    Ok(manager.get_status().await)
}

#[tauri::command]
pub async fn mlc_restart(
    manager: State<'_, std::sync::Arc<MLCServerManager>>,
) -> CmdResult<MLCServerStatus> {
    manager.restart().await
}

// ------------------ MCP check command ------------------

#[allow(dead_code)]
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
pub async fn mcp_check_server(config: McpServerConfig) -> CmdResult<McpCheckResult> {
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
                connect_timeout_ms: connect_timeout_ms.unwrap_or(MCP_DEFAULT_CONNECT_TIMEOUT_MS),
                list_tools_timeout_ms: list_tools_timeout_ms
                    .unwrap_or(MCP_DEFAULT_LIST_TOOLS_TIMEOUT_MS),
            })
            .await
        }
        McpServerConfig::Http {
            url,
            headers,
            auth,
            connect_timeout_ms,
            list_tools_timeout_ms,
            ..
        } => {
            // Merge Authorization header consistently
            let merged_headers = merge_auth_header(headers.as_ref(), auth.as_deref());

            mcp::check_server(mcp::TransportConfig::Http {
                url: &url,
                headers: merged_headers.as_ref(),
                connect_timeout_ms: connect_timeout_ms.unwrap_or(MCP_DEFAULT_CONNECT_TIMEOUT_MS),
                list_tools_timeout_ms: list_tools_timeout_ms
                    .unwrap_or(MCP_DEFAULT_LIST_TOOLS_TIMEOUT_MS),
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
    pool: tauri::State<'_, SqlitePool>,
) -> CmdResult<Vec<mcp::McpToolInfo>> {
    ensure_session_for_id(id, &manager, &pool).await?;
    // Default timeout for listing
    manager
        .list_tools(id, MCP_DEFAULT_LIST_TOOLS_TIMEOUT_MS)
        .await
}

#[tauri::command]
pub async fn mcp_call_tool(
    id: i64,
    tool: String,
    args: serde_json::Value,
    manager: tauri::State<'_, std::sync::Arc<McpManager>>,
    pool: tauri::State<'_, SqlitePool>,
) -> CmdResult<String> {
    ensure_session_for_id(id, &manager, &pool).await?;
    // Default timeout for calling a tool
    manager
        .call_tool(id, &tool, args, MCP_DEFAULT_TOOL_CALL_TIMEOUT_MS)
        .await
}

// ------------------ Environment Variable Commands ------------------

#[tauri::command]
pub async fn get_env_var(name: String) -> CmdResult<Option<String>> {
    Ok(std::env::var(&name).ok())
}

async fn ensure_session_for_id(
    id: i64,
    manager: &std::sync::Arc<McpManager>,
    pool: &SqlitePool,
) -> CmdResult<()> {
    ensure_mcp_session(id, manager, pool).await
}
