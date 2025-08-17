use sqlx::SqlitePool;

pub const SELECT_MCP_SERVER_BY_ID: &str =
    "SELECT transport, command, args, env, cwd, url, headers, auth, heartbeat_sec, connect_timeout_ms, enabled FROM mcp_servers WHERE id = ?";

#[derive(sqlx::FromRow)]
pub struct DbMcpServer {
    pub transport: String,
    pub command: Option<String>,
    pub args: Option<String>,
    pub env: Option<String>,
    pub cwd: Option<String>,
    pub url: Option<String>,
    pub headers: Option<String>,
    pub auth: Option<String>,
    pub heartbeat_sec: Option<i64>,
    pub connect_timeout_ms: Option<i64>,
    pub enabled: i64,
}

pub async fn fetch_mcp_server(pool: &SqlitePool, id: i64) -> Result<DbMcpServer, String> {
    let row_opt: Option<DbMcpServer> = sqlx::query_as::<_, DbMcpServer>(SELECT_MCP_SERVER_BY_ID)
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;
    let row = row_opt.ok_or_else(|| "server not found".to_string())?;
    if row.enabled == 0 {
        return Err("server disabled".into());
    }
    Ok(row)
}
