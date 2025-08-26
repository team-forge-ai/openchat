//! Response parsing utilities for MCP protocol

use crate::mcp::types::McpToolInfo;

/// Parses the tools array from an MCP tools/list response
pub fn parse_tools_array(result_value: &serde_json::Value) -> Vec<McpToolInfo> {
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
