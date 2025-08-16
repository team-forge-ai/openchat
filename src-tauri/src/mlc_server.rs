use serde::{Deserialize, Serialize};
use std::net::TcpListener;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::{Mutex, RwLock};

/// Default MLC model to use when MLC_MODEL environment variable is not set
const DEFAULT_MLC_MODEL: &str = "lmstudio-community/Qwen3-30B-A3B-Instruct-2507-MLX-4bit";

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
    child: Mutex<Option<CommandChild>>,
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

    /// Health check by hitting /v1/models and a minimal /v1/chat/completions request
    pub async fn health_check(&self) -> bool {
        let config = { self.config.read().await.clone() };
        let port = config.port;
        if !Self::http_get_models_reqwest(port).await {
            return false;
        }

        let model = match config.model {
            Some(m) => m,
            None => DEFAULT_MLC_MODEL.to_string(),
        };

        Self::http_post_chat_completions_reqwest(port, &model).await
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

    /// Start openchat-mlx-server sidecar using current config
    async fn start(&self) -> Result<(), String> {
        let config = self.config.read().await.clone();
        let model = config
            .model
            .clone()
            .ok_or_else(|| "MLC_MODEL not set. Please set env var to model folder".to_string())?;

        // If model URI points to Hugging Face, ensure it's present in local cache before spawning mlc_llm
        // if let Some(repo_id) = parse_hf_uri(&model) {
        //     if !is_model_cached(&repo_id) {
        //         ensure_hf_model_cached(&self.app_handle, &repo_id).await?;
        //     }
        // }

        // If already running, stop first (defensive)
        self.stop().await;

        // Determine an available port (scan small range)
        let desired_port = config.port;
        let chosen_port = Self::find_available_port(desired_port, 10)
            .ok_or_else(|| format!("No available port found near {}", desired_port))?;

        // Build and spawn the sidecar via Tauri Shell plugin
        let command = self
            .app_handle
            .shell()
            .sidecar("openchat-mlx-server")
            .map_err(|e| format!("Failed to create sidecar command: {e}"))?
            .args([
                // "--model",
                // &model,
                "--host",
                &config.host,
                "--port",
                &chosen_port.to_string(),
            ]);

        let (mut rx, child) = command
            .spawn()
            .map_err(|e| format!("Failed to spawn openchat-mlx-server: {e}"))?;

        // Track child pid
        let pid = child.pid();

        // Pipe stdout/stderr events to log
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        log::info!(
                            target: "openchat-mlx-server",
                            "STDOUT: {}",
                            String::from_utf8_lossy(&line)
                        );
                    }
                    CommandEvent::Stderr(line) => {
                        log::warn!(
                            target: "openchat-mlx-server",
                            "STDERR: {}",
                            String::from_utf8_lossy(&line)
                        );
                    }
                    _ => {}
                }
            }
        });

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
        status.pid = Some(pid);
        status.error = None;
        self.update_status_and_emit(status).await;

        Ok(())
    }

    /// Stop the server if running
    pub async fn stop(&self) {
        if let Some(child) = self.child.lock().await.take() {
            // tauri_plugin_shell CommandChild currently exposes sync kill; no async wait is required
            let _ = child.kill();
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

    /// Minimal chat completion POST to verify the model can answer a trivial prompt
    async fn http_post_chat_completions_reqwest(port: u16, model: &str) -> bool {
        const TIMEOUT_MS: u64 = 3000;
        let url = format!("http://127.0.0.1:{}/v1/chat/completions", port);
        let client = match reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(TIMEOUT_MS))
            .build()
        {
            Ok(c) => c,
            Err(_) => return false,
        };

        let body = serde_json::json!({
            "model": model,
            "messages": [
                { "role": "system", "content": "You are a helpful assistant." },
                { "role": "user", "content": "Say 'hello'." }
            ],
            "max_tokens": 4,
            "temperature": 0,
            "stream": false
        });

        let resp = match client
            .post(url)
            .header("Authorization", "Bearer dummy")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(_) => return false,
        };

        if !resp.status().is_success() {
            return false;
        }

        match resp.json::<serde_json::Value>().await {
            Ok(json) => {
                let content_present = json
                    .get("choices")
                    .and_then(|c| c.as_array())
                    .and_then(|arr| arr.get(0))
                    .and_then(|c0| c0.get("message"))
                    .and_then(|m| m.get("content"))
                    .and_then(|v| v.as_str())
                    .map(|s| !s.is_empty())
                    .unwrap_or(false);
                content_present
            }
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
