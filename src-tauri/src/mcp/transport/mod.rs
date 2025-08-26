//! Transport layer for MCP (Model Context Protocol)
//!
//! This module provides transport-agnostic session management for MCP servers
//! supporting both STDIO and HTTP transports.

pub mod config;
pub mod http;
pub mod parsing;
pub mod session;
pub mod stdio;
pub mod validation;

// Re-export main types and functions for backwards compatibility
pub use config::TransportConfig;
pub use http::create_http_session;
pub use parsing::parse_tools_array;
pub use session::{McpSession, McpTransport};
pub use stdio::spawn_stdio_session;
pub use validation::check_server;
