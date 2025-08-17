//! MCP (Model Context Protocol) module
//!
//! Folder-based module exposing:
//! - `McpManager` session cache and high-level operations
//! - `McpSession` transport (STDIO/HTTP)
//! - `check_server` best-effort connectivity probe
//! - `McpToolInfo`/`McpCheckResult` data types

pub mod constants;
pub mod serde_utils;
pub mod session; // DB-backed session ensure (existing)
pub mod store; // DB store helpers (existing)

mod manager;
mod transport;
mod types;

pub use manager::McpManager;
pub use transport::{check_server, TransportConfig};
pub use types::{McpCheckResult, McpToolInfo};
