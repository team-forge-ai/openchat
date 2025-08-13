use crate::model_download::ensure_hf_model_cached;
use crate::model_store::{is_model_cached, parse_hf_uri};
use serde::{Deserialize, Serialize};
use std::net::TcpListener;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncBufReadExt;
use tokio::process::{Child, Command};
use tokio::sync::{Mutex, RwLock};

/// Default MLC model to use when MLC_MODEL environment variable is not set
const DEFAULT_MLC_MODEL: &str = "HF://mlc-ai/Qwen3-14B-q4f16_1-MLC";

/// Status structure sent to the frontend. Keep snake_case to match TS converter.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MLCServerStatus {
    pub is_running: bool,
    pub is_http_ready: bool,
    pub port: Option<u16>,
    pub model_path: Option<String>,
    pub pid: Option<u32>,
    pub error: Option<String>,
}

/// Minimal configuration for server startup
#[derive(Debug, Clone)]
pub struct MLCServerConfig {
    pub host: String,
    pub port: u16,
    pub model: Option<String>,
}

impl Default for MLCServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8000,
            model: std::env::var("MLC_MODEL")
                .ok()
                .or_else(|| Some(DEFAULT_MLC_MODEL.to_string())),
        }
    }
}

/// Manager responsible for starting/stopping and tracking the MLC server process.
pub struct MLCServerManager {
    app_handle: AppHandle,
    status: RwLock<MLCServerStatus>,
    child: Mutex<Option<Child>>,
    config: RwLock<MLCServerConfig>,
}

impl MLCServerManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            status: RwLock::new(MLCServerStatus::default()),
            child: Mutex::new(None),
            config: RwLock::new(MLCServerConfig::default()),
        }
    }

    /// Get current status snapshot
    pub async fn get_status(&self) -> MLCServerStatus {
        self.status.read().await.clone()
    }

    /// Update status and emit change event to frontend
    async fn update_status_and_emit(&self, update: MLCServerStatus) {
        {
            let mut guard = self.status.write().await;
            *guard = update.clone();
        }
        let _ = self.app_handle.emit("mlc-status-changed", update);
    }

    /// Health check by hitting /v1/models via HTTP and validating JSON
    pub async fn health_check(&self) -> bool {
        let port = { self.config.read().await.port };
        Self::http_get_models_reqwest(port).await
    }

    /// Restart the server (stop if running, then start)
    pub async fn restart(&self) -> Result<MLCServerStatus, String> {
        self.stop().await;
        self.start().await?;

        // Poll readiness a few times
        let mut attempts = 0usize;
        let max_attempts = 30usize; // ~30s
        while attempts < max_attempts {
            if self.health_check().await {
                let mut status = self.status.read().await.clone();
                status.is_http_ready = true;
                self.update_status_and_emit(status.clone()).await;
                return Ok(status);
            }
            attempts += 1;
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        }

        let mut status = self.status.read().await.clone();
        status.is_http_ready = false;
        status.error = Some("Timeout waiting for MLC server readiness".into());
        self.update_status_and_emit(status.clone()).await;
        Ok(status)
    }

    /// Start mlc_llm server process using current config
    async fn start(&self) -> Result<(), String> {
        let config = self.config.read().await.clone();
        let model = config
            .model
            .clone()
            .ok_or_else(|| "MLC_MODEL not set. Please set env var to model folder".to_string())?;

        // If model URI points to Hugging Face, ensure it's present in local cache before spawning mlc_llm
        if let Some(repo_id) = parse_hf_uri(&model) {
            if !is_model_cached(&repo_id) {
                ensure_hf_model_cached(&self.app_handle, &repo_id).await?;
            }
        }

        // If already running, stop first (defensive)
        self.stop().await;

        // Determine an available port (scan small range)
        let desired_port = config.port;
        let chosen_port = Self::find_available_port(desired_port, 10)
            .ok_or_else(|| format!("No available port found near {}", desired_port))?;

        let mut cmd = Command::new("mlc_llm");
        cmd.arg("serve")
            .arg(model.clone())
            .arg("--host")
            .arg(config.host.clone())
            .arg("--port")
            .arg(chosen_port.to_string())
            .kill_on_drop(true)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to start mlc_llm: {e}"))?;

        // Track child pid
        let pid = child.id();

        // Spawn background tasks to pipe stdout/stderr to log
        if let Some(out) = child.stdout.take() {
            tokio::spawn(async move {
                let reader = tokio::io::BufReader::new(out);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    log::info!(target: "mlc_llm", "STDOUT: {}", line);
                }
            });
        }
        if let Some(err) = child.stderr.take() {
            tokio::spawn(async move {
                let reader = tokio::io::BufReader::new(err);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    log::warn!(target: "mlc_llm", "STDERR: {}", line);
                }
            });
        }

        // Save child handle
        {
            let mut guard = self.child.lock().await;
            *guard = Some(child);
        }

        // Update status
        let mut status = self.status.read().await.clone();
        status.is_running = true;
        status.is_http_ready = false;
        status.port = Some(chosen_port);
        status.model_path = Some(model);
        status.pid = pid;
        status.error = None;
        self.update_status_and_emit(status).await;

        Ok(())
    }

    /// Stop the server if running
    pub async fn stop(&self) {
        if let Some(mut child) = self.child.lock().await.take() {
            let _ = child.kill().await; // ensure termination
            let _ = child.wait().await;
        }

        // Update status
        let mut status = self.status.read().await.clone();
        status.is_running = false;
        status.is_http_ready = false;
        status.pid = None;
        self.update_status_and_emit(status).await;
    }

    /// Robust HTTP GET using reqwest with timeouts and JSON validation
    async fn http_get_models_reqwest(port: u16) -> bool {
        const TIMEOUT_MS: u64 = 800;
        let url = format!("http://127.0.0.1:{}/v1/models", port);
        let client = match reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(TIMEOUT_MS))
            .build()
        {
            Ok(c) => c,
            Err(_) => return false,
        };
        let resp = match client.get(url).send().await {
            Ok(r) => r,
            Err(_) => return false,
        };
        if !resp.status().is_success() {
            return false;
        }
        match resp.json::<serde_json::Value>().await {
            Ok(json) => json.get("data").is_some(),
            Err(_) => false,
        }
    }

    /// Try to bind to desired port; if in use, scan next `range` ports
    fn find_available_port(start: u16, range: u16) -> Option<u16> {
        for offset in 0..=range {
            let port = start.saturating_add(offset);
            let addr = format!("127.0.0.1:{}", port);
            if let Ok(listener) = TcpListener::bind(&addr) {
                // immediately free the port and use it
                drop(listener);
                return Some(port);
            }
        }
        None
    }
}
