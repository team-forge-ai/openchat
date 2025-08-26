use serde::Serialize;

/// Basic metadata describing an MCP tool, including optional input schema.
#[derive(Serialize, Debug, Clone)]
pub struct McpToolInfo {
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "inputSchema", skip_serializing_if = "Option::is_none")]
    pub input_schema: Option<serde_json::Value>,
}

/// Result for a best-effort server check (connect + list tools).
#[derive(Serialize, Debug, Clone)]
pub struct McpCheckResult {
    pub ok: bool,
    pub tools_count: Option<u32>,
    pub tools: Option<Vec<McpToolInfo>>,
    pub warning: Option<String>,
    pub error: Option<String>,
}
