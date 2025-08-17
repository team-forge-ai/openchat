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

/// Merge an Authorization header into an optional JSON headers object.
/// - If `headers` is Some and contains an object, insert Authorization if absent.
/// - If `headers` is None and `auth` is Some, create a new headers object.
/// - Never overwrites an existing Authorization header.
pub fn merge_auth_header(
    headers: Option<&serde_json::Value>,
    auth: Option<&str>,
) -> Option<serde_json::Value> {
    let mut out: Option<serde_json::Value> = headers.cloned();
    if let Some(token) = auth {
        match out {
            Some(ref mut v) => {
                if let Some(obj) = v.as_object_mut() {
                    if !obj.contains_key("Authorization") {
                        obj.insert(
                            "Authorization".to_string(),
                            serde_json::Value::String(token.to_string()),
                        );
                    }
                }
            }
            None => {
                let mut map = serde_json::Map::new();
                map.insert(
                    "Authorization".to_string(),
                    serde_json::Value::String(token.to_string()),
                );
                out = Some(serde_json::Value::Object(map));
            }
        }
    }
    out
}
