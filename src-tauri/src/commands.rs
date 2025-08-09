use crate::mcp;
use crate::mcp::McpManager;
use crate::mlx_server::{MLXServerManager, MLXServerStatus};
use serde::{Deserialize, Serialize};
use std::net::{SocketAddr, TcpListener};
use tauri::State;

/// Check if a port is available by attempting to bind to it
#[tauri::command]
pub async fn check_port_available(port: u16) -> Result<bool, String> {
    // Try to bind to the port on localhost
    let addr: SocketAddr = format!("127.0.0.1:{}", port)
        .parse()
        .map_err(|e| format!("Invalid address: {}", e))?;

    match TcpListener::bind(addr) {
        Ok(_listener) => {
            // Successfully bound to the port, it's available
            // The listener will be dropped and the port released
            Ok(true)
        }
        Err(e) => {
            // Failed to bind, check the error type
            match e.kind() {
                std::io::ErrorKind::AddrInUse => {
                    // Port is in use
                    Ok(false)
                }
                std::io::ErrorKind::PermissionDenied => {
                    // Permission denied (e.g., trying to bind to a privileged port)
                    Err(format!("Permission denied for port {}: {}", port, e))
                }
                _ => {
                    // Other error
                    Err(format!("Failed to check port {}: {}", port, e))
                }
            }
        }
    }
}

/// Get information about what's using a port (if possible)
#[tauri::command]
pub async fn get_port_info(port: u16) -> Result<PortInfo, String> {
    use std::time::Duration;
    use tokio::net::TcpStream;
    use tokio::time::timeout;

    let addr = format!("127.0.0.1:{}", port);

    // First check if port is open
    let is_open = match timeout(Duration::from_millis(100), TcpStream::connect(&addr)).await {
        Ok(Ok(_)) => true,
        _ => false,
    };

    if !is_open {
        return Ok(PortInfo {
            port,
            is_available: true,
            is_mlx_server: false,
        });
    }

    // Try to check if it's an MLX server by making an HTTP request
    let is_mlx = check_if_mlx_server(port).await;

    Ok(PortInfo {
        port,
        is_available: false,
        is_mlx_server: is_mlx,
    })
}

#[derive(serde::Serialize)]
pub struct PortInfo {
    port: u16,
    is_available: bool,
    is_mlx_server: bool,
}

async fn check_if_mlx_server(port: u16) -> bool {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;
    use tokio::time::{timeout, Duration};

    let addr = format!("127.0.0.1:{}", port);

    let Ok(Ok(mut stream)) = timeout(Duration::from_millis(500), TcpStream::connect(&addr)).await
    else {
        return false;
    };

    // Send a simple HTTP GET request to /health
    let request = format!(
        "GET /health HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
        port
    );

    if stream.write_all(request.as_bytes()).await.is_err() {
        return false;
    }

    let mut response = vec![0; 512];
    let Ok(Ok(n)) = timeout(Duration::from_millis(500), stream.read(&mut response)).await else {
        return false;
    };

    if n == 0 {
        return false;
    }

    // Check if response looks like it's from an MLX server
    let response_str = String::from_utf8_lossy(&response[..n]);

    // MLX server should return 200 OK on /health
    response_str.contains("200 OK") || response_str.contains("200 OK")
}

// MLX Server Management Commands

#[tauri::command]
pub async fn mlx_get_status(
    manager: State<'_, MLXServerManager>,
) -> Result<MLXServerStatus, String> {
    Ok(manager.get_status().await)
}

#[tauri::command]
pub async fn mlx_restart(manager: State<'_, MLXServerManager>) -> Result<MLXServerStatus, String> {
    manager.restart().await
}

#[tauri::command]
pub async fn mlx_health_check(manager: State<'_, MLXServerManager>) -> Result<bool, String> {
    Ok(manager.health_check().await)
}

// ------------------ MCP check command ------------------

#[derive(Deserialize)]
#[serde(tag = "transport")] // discriminated union by transport
pub enum McpServerConfig {
    #[serde(rename = "stdio")]
    Stdio {
        name: String,
        description: Option<String>,
        enabled: bool,
        connect_timeout_ms: Option<u64>,
        list_tools_timeout_ms: Option<u64>,
        command: String,
        args: Option<Vec<String>>,
        env: Option<serde_json::Value>,
        cwd: Option<String>,
    },
    #[serde(rename = "http")]
    Http {
        name: String,
        description: Option<String>,
        enabled: bool,
        connect_timeout_ms: Option<u64>,
        list_tools_timeout_ms: Option<u64>,
        url: String,
        headers: Option<serde_json::Value>,
        auth: Option<String>,
        heartbeat_sec: Option<u64>,
    },
}

pub use crate::mcp::{McpCheckResult, McpToolInfo};

#[tauri::command]
pub async fn mcp_check_server(config: McpServerConfig) -> Result<McpCheckResult, String> {
    let result = match config {
        McpServerConfig::Stdio {
            command,
            args,
            env,
            cwd,
            connect_timeout_ms,
            list_tools_timeout_ms,
            ..
        } => {
            let args_vec = args.unwrap_or_default();
            mcp::check_server(mcp::TransportConfig::Stdio {
                command: &command,
                args: &args_vec,
                env: env.as_ref(),
                cwd: cwd.as_deref(),
                connect_timeout_ms: connect_timeout_ms.unwrap_or(5_000),
                list_tools_timeout_ms: list_tools_timeout_ms.unwrap_or(5_000),
            })
            .await
        }
        McpServerConfig::Http {
            url,
            connect_timeout_ms,
            list_tools_timeout_ms,
            ..
        } => {
            mcp::check_server(mcp::TransportConfig::Http {
                url: &url,
                connect_timeout_ms: connect_timeout_ms.unwrap_or(5_000),
                list_tools_timeout_ms: list_tools_timeout_ms.unwrap_or(5_000),
            })
            .await
        }
    };
    Ok(result)
}

// ------------------ MCP list/call commands ------------------

#[tauri::command]
pub async fn mcp_list_tools(
    id: i64,
    manager: tauri::State<'_, std::sync::Arc<McpManager>>,
) -> Result<Vec<mcp::McpToolInfo>, String> {
    // Default timeout for listing
    manager.list_tools(id, 5_000).await
}

#[tauri::command]
pub async fn mcp_call_tool(
    id: i64,
    tool: String,
    args: serde_json::Value,
    manager: tauri::State<'_, std::sync::Arc<McpManager>>,
) -> Result<String, String> {
    // Default timeout for calling a tool
    manager.call_tool(id, &tool, args, 20_000).await
}
