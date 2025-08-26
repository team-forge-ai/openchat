//! Transport configuration types for MCP sessions

/// Transport configuration for establishing a session.
#[derive(Debug)]
pub enum TransportConfig<'a> {
    Stdio {
        command: &'a str,
        args: &'a [String],
        env: Option<&'a serde_json::Value>,
        cwd: Option<&'a str>,
        connect_timeout_ms: u64,
        list_tools_timeout_ms: u64,
    },
    Http {
        url: &'a str,
        headers: Option<&'a serde_json::Value>,
        connect_timeout_ms: u64,
        list_tools_timeout_ms: u64,
    },
}
