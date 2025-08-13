pub fn parse_mcp_string_array(s: Option<&str>) -> Vec<String> {
    match s {
        Some(raw) if !raw.is_empty() => {
            serde_json::from_str(raw).unwrap_or_else(|_| Vec::<String>::new())
        }
        _ => Vec::new(),
    }
}

pub fn parse_mcp_json_object(s: Option<&str>) -> serde_json::Value {
    match s {
        Some(raw) if !raw.is_empty() => {
            serde_json::from_str::<serde_json::Value>(raw).unwrap_or(serde_json::json!({}))
        }
        _ => serde_json::json!({}),
    }
}

pub fn parse_mcp_json_object_opt(s: Option<&str>) -> Option<serde_json::Value> {
    match s {
        Some(raw) if !raw.is_empty() => serde_json::from_str::<serde_json::Value>(raw).ok(),
        _ => None,
    }
}
