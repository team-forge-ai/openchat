use crate::mcp::constants::MCP_JSONRPC_VERSION;

pub fn make_mcp_rpc_req(id: u64, method: &str, params: serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": MCP_JSONRPC_VERSION,
        "id": id,
        "method": method,
        "params": params,
    })
}

pub fn extract_mcp_result_or_error(v: serde_json::Value) -> Result<serde_json::Value, String> {
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
