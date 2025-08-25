use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener};
use std::time::Duration;

use crate::model_download::ensure_hf_model_cached;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};
use tokio::sync::{Mutex, RwLock};

/// Default model used when the `MLC_MODEL` env var is not set.
pub const DEFAULT_MLC_MODEL: &str = "lmstudio-community/Qwen3-30B-A3B-Instruct-2507-MLX-4bit";

/// Event name emitted to the frontend whenever the status changes.
pub const MLC_STATUS_CHANGED_EVENT: &str = "mlc-status-changed";

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub struct MLCServerStatus {
    pub is_running: bool,
    pub is_http_ready: bool,
    pub port: Option<u16>,
    pub model_path: Option<String>,
    pub pid: Option<u32>,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MLCServerConfig {
    pub host: String,
    pub port: u16,
    pub model: Option<String>,
}

impl Default for MLCServerConfig {
    fn default() -> Self {
        let model = std::env::var("MLC_MODEL")
            .ok()
            .or_else(|| Some(DEFAULT_MLC_MODEL.to_string()));
        Self {
            host: "127.0.0.1".to_string(),
            port: 8000,
            model,
        }
    }
}

pub struct MLCServerManager {
    app_handle: AppHandle,
    status: Mutex<MLCServerStatus>,
    child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
    config: RwLock<MLCServerConfig>,
}

impl MLCServerManager {
    /// Creates a new manager with default configuration.
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            status: Mutex::new(MLCServerStatus::default()),
            child: Mutex::new(None),
            config: RwLock::new(MLCServerConfig::default()),
        }
    }

    /// Returns a snapshot of the current status.
    pub async fn get_status(&self) -> MLCServerStatus {
        self.status.lock().await.clone()
    }

    /// Updates internal status and emits an event to the frontend.
    async fn update_status_and_emit(&self, new_status: MLCServerStatus) {
        {
            let mut guard = self.status.lock().await;
            *guard = new_status.clone();
        }
        let _ = self.app_handle.emit(MLC_STATUS_CHANGED_EVENT, new_status);
    }

    /// Performs a lightweight HTTP readiness check against `/v1/models`.
    async fn health_check(&self, port: u16) -> anyhow::Result<()> {
        http_get_models_reqwest(port).await
    }

    /// Polls HTTP readiness up to 50 times (2s interval). Updates `is_http_ready` on success.
    async fn poll_health_check(&self) {
        let mut attempts_remaining: u32 = 50;

        loop {
            let current_status = self.get_status().await;
            let Some(port) = current_status.port else {
                log::warn!("poll_health_check: no port assigned yet");
                return;
            };

            match self.health_check(port).await {
                Ok(_) => {
                    let mut new_status = current_status.clone();
                    if !new_status.is_http_ready {
                        new_status.is_http_ready = true;
                        new_status.error = None;
                        self.update_status_and_emit(new_status).await;
                    }
                    return;
                }
                Err(err) => {
                    attempts_remaining = attempts_remaining.saturating_sub(1);
                    if attempts_remaining == 0 {
                        let mut new_status = current_status.clone();
                        new_status.is_http_ready = false;
                        new_status.error = Some(format!("HTTP health check timed out: {err}"));
                        self.update_status_and_emit(new_status).await;
                        return;
                    }
                }
            }

            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    }

    /// Restarts the server by delegating to `start`.
    pub async fn restart(self: &std::sync::Arc<Self>) -> Result<MLCServerStatus, String> {
        self.start().await
    }

    /// Starts the `openchat-mlx-server` process and wires up health checks.
    pub async fn start(self: &std::sync::Arc<Self>) -> Result<MLCServerStatus, String> {
        let config = { self.config.read().await.clone() };

        let model_path = config.model.clone().ok_or_else(|| {
            "No model configured; set MLC_MODEL or provide a model in config".to_string()
        })?;

        // Ensure model is present in the local Hugging Face hub cache before starting the server
        ensure_hf_model_cached(&self.app_handle, &model_path).await?;

        // Defensive stop of any existing process
        let _ = self.stop().await;

        // Find an available port near the desired one
        let desired_port = config.port;
        let port = find_available_port(desired_port, 10)
            .ok_or_else(|| format!("No available port found near {desired_port}"))?;

        // Optionally set bundled python sidecar path
        let python_path = self.app_handle.shell().sidecar("python3").ok().map(|cmd| {
            let std_cmd: std::process::Command = cmd.into();
            std::path::PathBuf::from(std_cmd.get_program().to_owned())
        });

        log::info!(
            "Starting openchat-mlx-server: host={} port={} model={}",
            config.host,
            port,
            model_path
        );

        // Build and spawn sidecar using Tauri's shell plugin
        let mut sidecar_cmd = self
            .app_handle
            .shell()
            .sidecar("openchat-mlx-server")
            .map_err(|e| format!("Failed to resolve openchat-mlx-server sidecar: {e}"))?
            .args([
                "--host",
                &config.host,
                "--port",
                &port.to_string(),
                "--model",
                &model_path,
            ]);

        if let Some(py) = python_path {
            sidecar_cmd = sidecar_cmd.env("OPENCHAT_MLX_SERVER_PYTHON", py);
        }

        let (rx, child) = sidecar_cmd
            .spawn()
            .map_err(|e| format!("Failed to start openchat-mlx-server: {e}"))?;

        // Drain and log stdout/stderr
        spawn_command_log_relay("[mlx-server]", rx);

        let pid = child.pid();

        // Save child handle
        {
            let mut guard = self.child.lock().await;
            *guard = Some(child);
        }

        // Update and emit running status
        let new_status = MLCServerStatus {
            is_running: true,
            is_http_ready: false,
            port: Some(port),
            model_path: Some(model_path),
            pid: Some(pid),
            error: None,
        };
        self.update_status_and_emit(new_status.clone()).await;

        // Kick off health polling in the background
        let manager = std::sync::Arc::clone(self);
        tauri::async_runtime::spawn(async move {
            manager.poll_health_check().await;
        });

        Ok(new_status)
    }

    /// Stops the server process if running and emits a non-running status.
    pub async fn stop(self: &std::sync::Arc<Self>) -> Result<(), String> {
        let mut maybe_child = self.child.lock().await;
        if let Some(child) = maybe_child.take() {
            log::info!("Stopping openchat-mlx-server (pid={})", child.pid());

            // Try graceful shutdown first on Unix by sending SIGINT to the child PID
            #[cfg(unix)]
            {
                let pid_i32 = child.pid() as i32;
                unsafe {
                    let res = libc::kill(pid_i32, libc::SIGINT);
                    if res == 0 {
                        log::info!("Sent SIGINT to openchat-mlx-server (pid={})", pid_i32);
                    } else {
                        let err = std::io::Error::last_os_error();
                        log::warn!(
                            "Failed to send SIGINT to openchat-mlx-server (pid={}): {}",
                            pid_i32,
                            err
                        );
                    }
                }
                // Give the process a short grace period to exit cleanly
                tokio::time::sleep(Duration::from_millis(300)).await;
            }

            if let Err(err) = child.kill() {
                log::warn!("Failed to kill child process: {err}");
            }
        }

        let mut status = self.status.lock().await.clone();
        status.is_running = false;
        status.is_http_ready = false;
        status.pid = None;
        self.update_status_and_emit(status).await;
        Ok(())
    }

    // Removed manual resource resolver; sidecar paths are resolved via Shell plugin.
}

/// Spawns a task that relays and logs CommandEvent output with a consistent prefix.
fn spawn_command_log_relay(
    prefix: impl Into<String>,
    rx: tauri::async_runtime::Receiver<CommandEvent>,
) {
    let prefix = prefix.into();
    tauri::async_runtime::spawn(async move {
        let mut rx = rx;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    if let Ok(line) = String::from_utf8(bytes) {
                        let line = line.trim_end_matches('\n');
                        if !line.is_empty() {
                            log::info!("{} {}", prefix, line);
                        }
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    if let Ok(line) = String::from_utf8(bytes) {
                        let line = line.trim_end_matches('\n');
                        if !line.is_empty() {
                            log::error!("{} {}", prefix, line);
                        }
                    }
                }
                CommandEvent::Error(err) => {
                    log::error!("{} error: {}", prefix, err);
                }
                CommandEvent::Terminated(payload) => {
                    log::info!(
                        "{} terminated: code={:?} signal={:?}",
                        prefix,
                        payload.code,
                        payload.signal
                    );
                }
                _ => {}
            }
        }
    });
}

/// GET /v1/models with a short timeout; ensures a JSON response containing a `data` array.
async fn http_get_models_reqwest(port: u16) -> anyhow::Result<()> {
    let url = format!("http://127.0.0.1:{}/v1/models", port);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(800))
        .build()?;
    let resp = client.get(&url).send().await?;
    if !resp.status().is_success() {
        anyhow::bail!("HTTP {}", resp.status());
    }
    let json: serde_json::Value = resp.json().await?;
    match json.get("data") {
        Some(value) if value.is_array() => Ok(()),
        _ => anyhow::bail!("Missing or invalid `data` field in response"),
    }
}

/// Attempts to find an available port by binding sequentially starting at `start` for `range` ports.
fn find_available_port(start: u16, range: u16) -> Option<u16> {
    let host = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
    for port in start..start.saturating_add(range) {
        let addr = SocketAddr::new(host, port);
        if TcpListener::bind(addr).is_ok() {
            return Some(port);
        }
    }
    None
}
