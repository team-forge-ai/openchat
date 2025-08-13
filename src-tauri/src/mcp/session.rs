use std::sync::Arc;

use sqlx::SqlitePool;

use crate::mcp::constants::MCP_DEFAULT_CONNECT_TIMEOUT_MS;
use crate::mcp::serde_utils::{
    parse_mcp_json_object, parse_mcp_json_object_opt, parse_mcp_string_array,
};
use crate::mcp::store::{fetch_mcp_server, DbMcpServer};
use crate::mcp::McpManager;

type ResultT<T> = Result<T, String>;

pub async fn ensure_mcp_session(
    id: i64,
    manager: &Arc<McpManager>,
    pool: &SqlitePool,
) -> ResultT<()> {
    let row = fetch_mcp_server(pool, id).await?;
    let connect_ms: u64 = normalize_connect_timeout(row.connect_timeout_ms);
    match Transport::try_from(row.transport.as_str())? {
        Transport::Stdio => ensure_stdio_from_row(manager, id, &row, connect_ms).await,
        Transport::Http => ensure_http_from_row(manager, id, &row, connect_ms).await,
    }
}

enum Transport {
    Stdio,
    Http,
}

impl TryFrom<&str> for Transport {
    type Error = String;
    fn try_from(value: &str) -> ResultT<Self> {
        match value {
            "stdio" => Ok(Transport::Stdio),
            "http" => Ok(Transport::Http),
            other => Err(format!("unsupported transport: {}", other)),
        }
    }
}

fn normalize_connect_timeout(value: Option<i64>) -> u64 {
    value
        .and_then(|v| if v < 0 { None } else { Some(v as u64) })
        .unwrap_or(MCP_DEFAULT_CONNECT_TIMEOUT_MS)
}

async fn ensure_stdio_from_row(
    manager: &Arc<McpManager>,
    id: i64,
    row: &DbMcpServer,
    connect_ms: u64,
) -> ResultT<()> {
    let command = row
        .command
        .as_deref()
        .ok_or_else(|| "missing command".to_string())?;
    let args_vec = parse_mcp_string_array(row.args.as_deref());
    let env_val = parse_mcp_json_object(row.env.as_deref());
    manager
        .ensure_stdio(
            id,
            command,
            &args_vec,
            &env_val,
            row.cwd.as_deref(),
            connect_ms,
        )
        .await
}

async fn ensure_http_from_row(
    manager: &Arc<McpManager>,
    id: i64,
    row: &DbMcpServer,
    connect_ms: u64,
) -> ResultT<()> {
    let url = row
        .url
        .as_deref()
        .ok_or_else(|| "missing url".to_string())?;
    let headers_val = parse_mcp_json_object_opt(row.headers.as_deref());
    manager
        .ensure_http(id, url, headers_val.as_ref(), connect_ms)
        .await
}
