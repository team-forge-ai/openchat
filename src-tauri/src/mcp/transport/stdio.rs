//! STDIO transport implementation for MCP

use crate::mcp::constants::{MCP_METHOD_INITIALIZE, MCP_PROTOCOL_VERSION};
use crate::mcp::transport::session::{McpSession, McpTransport};
use log::{error, info};
use std::process::Stdio;
use tokio::io::BufReader;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

/// Checks if a command is a bare command (no path separators)
fn is_bare_command(command: &str) -> bool {
    #[cfg(target_family = "unix")]
    {
        !command.contains('/')
    }
    #[cfg(target_family = "windows")]
    {
        !command.contains('\\') && !command.contains('/') && !command.contains(':')
    }
}

/// Escapes a shell argument for safe execution
fn sh_escape(arg: &str) -> String {
    let mut out = String::with_capacity(arg.len() + 2);
    out.push('\'');
    for ch in arg.chars() {
        if ch == '\'' {
            out.push_str("'\\\''");
        } else {
            out.push(ch);
        }
    }
    out.push('\'');
    out
}

/// Creates initialization parameters for MCP session
fn init_params() -> serde_json::Value {
    serde_json::json!({
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "capabilities": {},
        "clientInfo": { "name": "OpenChat", "version": "0.1.0" },
    })
}

/// Builds a command for STDIO execution, handling both bare commands and full paths
fn build_stdio_command(command: &str, args: &[String]) -> Command {
    if is_bare_command(command) {
        let shell_path = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let mut composed = String::new();
        composed.push_str(&sh_escape(command));
        for a in args {
            composed.push(' ');
            composed.push_str(&sh_escape(a));
        }
        info!(
            "mcp: using shell wrapper - shell='{}', composed_cmd='{}'",
            shell_path, composed
        );
        let mut c = Command::new(shell_path);
        c.arg("-lc").arg(composed);
        c
    } else {
        info!(
            "mcp: using direct command - cmd='{}', args={:?}",
            command, args
        );
        let mut c = Command::new(command);
        c.args(args);
        c
    }
}

/// Applies environment variables and working directory to a command
fn apply_env_and_cwd(cmd: &mut Command, env: Option<&serde_json::Value>, cwd: Option<&str>) {
    if let Some(cwd_val) = cwd {
        if cwd_val.trim().is_empty() {
            info!("mcp: cwd is empty string; ignoring current_dir");
        } else {
            cmd.current_dir(cwd_val);
        }
    }
    if let Some(env_obj) = env.and_then(|v| v.as_object()) {
        for (k, val) in env_obj.iter() {
            if let Some(s) = val.as_str() {
                cmd.env(k, s);
            }
        }
    }
}

/// Spawns a new STDIO-based MCP session
pub async fn spawn_stdio_session(
    command: &str,
    args: &[String],
    env: Option<&serde_json::Value>,
    cwd: Option<&str>,
    connect_timeout_ms: u64,
) -> Result<McpSession, String> {
    let mut cmd = build_stdio_command(command, args);
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_env_and_cwd(&mut cmd, env, cwd);
    let mut child = timeout(Duration::from_millis(connect_timeout_ms), async {
        cmd.spawn()
    })
    .await
    .map_err(|_| "spawn timeout".to_string())
    .and_then(|r| {
        r.map_err(|e| {
            error!(
                "mcp: failed to spawn process - error={}, kind={:?}, raw_os_error={:?}",
                e,
                e.kind(),
                e.raw_os_error()
            );
            format!(
                "spawn error: {} (kind: {:?}, os_error: {:?})",
                e,
                e.kind(),
                e.raw_os_error()
            )
        })
    })?;
    log::debug!("mcp: stdio spawned child process (pid={:?})", child.id());
    let stdin = child.stdin.take().ok_or("no stdin")?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let mut session = McpSession::new_stdio(child, stdin, BufReader::new(stdout));
    let _ = session
        .send(MCP_METHOD_INITIALIZE, init_params(), connect_timeout_ms)
        .await?;
    Ok(session)
}
