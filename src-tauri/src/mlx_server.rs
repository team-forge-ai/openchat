use serde::{Deserialize, Serialize};
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use tauri::async_runtime::Mutex;
use tauri::async_runtime::RwLock;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

// Constants for server configuration and timeouts
const DEFAULT_MODEL_PATH: &str = "models/Qwen3-0.6B-MLX-4bit";
const DEFAULT_PORT: u16 = 8000;
const DEFAULT_HOST: &str = "127.0.0.1";
const DEFAULT_LOG_LEVEL: &str = "INFO";
const DEFAULT_MAX_TOKENS: u32 = 32000;
const MAX_PORT_SEARCH_RANGE: u16 = 100;

const STARTUP_DELAY_SECS: u64 = 2;
const HEALTH_CHECK_MAX_ATTEMPTS: usize = 60;
const HEALTH_CHECK_DELAY_SECS: u64 = 1;
const HEALTH_CHECK_TIMEOUT_SECS: u64 = 5;
const RESTART_DELAY_MILLIS: u64 = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLXServerConfig {
    pub model_path: String,
    pub port: u16,
    pub host: String,
    pub log_level: Option<String>,
    pub max_tokens: Option<u32>,
}

impl Default for MLXServerConfig {
    fn default() -> Self {
        Self {
            model_path: DEFAULT_MODEL_PATH.to_string(),
            port: DEFAULT_PORT,
            host: DEFAULT_HOST.to_string(),
            log_level: Some(DEFAULT_LOG_LEVEL.to_string()),
            max_tokens: Some(DEFAULT_MAX_TOKENS),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLXServerStatus {
    pub is_running: bool,
    pub is_ready: bool,
    pub port: Option<u16>,
    pub model_path: Option<String>,
    pub pid: Option<u32>,
    pub error: Option<String>,
}

impl Default for MLXServerStatus {
    fn default() -> Self {
        Self {
            is_running: false,
            is_ready: false,
            port: None,
            model_path: None,
            pid: None,
            error: None,
        }
    }
}

// Store the command child to manage the process
struct ProcessHandle {
    child: tauri_plugin_shell::process::CommandChild,
}

#[derive(Clone)]
pub struct MLXServerManager {
    process_handle: Arc<Mutex<Option<ProcessHandle>>>,
    config: Arc<RwLock<MLXServerConfig>>,
    status: Arc<RwLock<MLXServerStatus>>,
    startup_complete: Arc<AtomicBool>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    pid_atomic: Arc<AtomicU32>,
}

impl MLXServerManager {
    pub fn new() -> Self {
        Self {
            process_handle: Arc::new(Mutex::new(None)),
            config: Arc::new(RwLock::new(MLXServerConfig::default())),
            status: Arc::new(RwLock::new(MLXServerStatus::default())),
            startup_complete: Arc::new(AtomicBool::new(false)),
            app_handle: Arc::new(Mutex::new(None)),
            pid_atomic: Arc::new(AtomicU32::new(0)),
        }
    }

    // ============================================================================
    // LIFECYCLE MANAGEMENT
    // ============================================================================

    pub async fn set_app_handle(&self, handle: AppHandle) {
        let mut app_handle = self.app_handle.lock().await;
        *app_handle = Some(handle);
    }

    pub async fn auto_start(&self) -> Result<(), String> {
        log::info!("Auto-starting MLX server...");

        // Start the server with default config
        let config = self.config.read().await.clone();
        self.start_server(config).await?;

        self.startup_complete.store(true, Ordering::SeqCst);
        log::info!("MLX server auto-start complete");
        Ok(())
    }

    // ============================================================================
    // PORT MANAGEMENT METHODS
    // ============================================================================

    /// Check if a port is available for binding
    fn is_port_available(host: &str, port: u16) -> bool {
        match TcpListener::bind(format!("{}:{}", host, port)) {
            Ok(_) => true,
            Err(_) => false,
        }
    }

    /// Find an available port starting from the default port
    fn find_available_port(host: &str, start_port: u16) -> Result<u16, String> {
        for port in start_port..start_port + MAX_PORT_SEARCH_RANGE {
            if Self::is_port_available(host, port) {
                return Ok(port);
            }
        }
        Err(format!(
            "No available ports found in range {}-{}",
            start_port,
            start_port + MAX_PORT_SEARCH_RANGE - 1
        ))
    }

    // ============================================================================
    // HELPER METHODS
    // ============================================================================

    /// Build command arguments for the MLX server
    fn build_command_args(config: &MLXServerConfig) -> Vec<String> {
        let mut args = vec![
            config.model_path.clone(),
            "--port".to_string(),
            config.port.to_string(),
            "--host".to_string(),
            config.host.clone(),
        ];

        // Add PID file with port prefix to avoid clashes
        let pid_file = format!("{}_mlx_server.pid", config.port);
        args.push("--pid-file".to_string());
        args.push(pid_file);

        if let Some(log_level) = &config.log_level {
            args.push("--log-level".to_string());
            args.push(log_level.clone());
        }

        if let Some(max_tokens) = &config.max_tokens {
            args.push("--max-tokens".to_string());
            args.push(max_tokens.to_string());
        }

        args
    }

    /// Update server status to running state
    async fn update_status_running(&self, config: &MLXServerConfig, pid: u32) {
        let mut status = self.status.write().await;
        status.is_running = true;
        status.is_ready = false;
        status.port = Some(config.port);
        status.model_path = Some(config.model_path.clone());
        status.pid = Some(pid);
        status.error = None;
    }

    /// Update server status to stopped state
    async fn update_status_stopped(&self) {
        let mut status = self.status.write().await;
        status.is_running = false;
        status.is_ready = false;
        status.port = None;
        status.model_path = None;
        status.pid = None;
        self.pid_atomic.store(0, Ordering::SeqCst);
    }

    /// Get the app handle, returning an error if not set
    async fn get_app_handle(&self) -> Result<AppHandle, String> {
        let app_handle = self.app_handle.lock().await;
        app_handle
            .as_ref()
            .ok_or_else(|| "App handle not set".to_string())
            .map(|handle| handle.clone())
    }

    /// Spawn the MLX server process using the sidecar
    async fn spawn_mlx_process(
        &self,
        app: AppHandle,
        args: Vec<String>,
    ) -> Result<
        (
            tokio::sync::mpsc::Receiver<tauri_plugin_shell::process::CommandEvent>,
            tauri_plugin_shell::process::CommandChild,
        ),
        String,
    > {
        app.shell()
            .sidecar("openchat-mlx-server")
            .map_err(|e| format!("Failed to create sidecar command: {}", e))?
            .args(args)
            .spawn()
            .map_err(|e| format!("Failed to spawn MLX server: {}", e))
    }

    /// Set up event listener for process events in the background
    async fn setup_process_event_listener(
        &self,
        mut rx: tokio::sync::mpsc::Receiver<tauri_plugin_shell::process::CommandEvent>,
    ) {
        let status_clone = self.status.clone();
        let app_handle_clone = self.app_handle.clone();

        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        let output = String::from_utf8_lossy(&line);
                        log::info!("MLX server stdout: {}", output);

                        // Check for common startup messages
                        if output.contains("Uvicorn running") || output.contains("Started server") {
                            log::info!("MLX server appears to have started successfully");
                        }
                    }
                    CommandEvent::Stderr(line) => {
                        let output = String::from_utf8_lossy(&line);
                        // Use info for stderr since Python apps often log normally to stderr
                        log::info!("MLX server stderr: {}", output);

                        // Check for actual error patterns (not just the word "Error")
                        if (output.contains("Error:")
                            || output.contains("ERROR")
                            || output.contains("Failed")
                            || output.contains("Exception")
                            || output.contains("Traceback"))
                            && !output.contains("INFO")
                        {
                            log::error!("MLX server reported an error: {}", output);

                            // Update status with error
                            let mut status = status_clone.write().await;
                            if status.error.is_none() {
                                status.error = Some(format!("Server error: {}", output));
                            }
                            drop(status);
                        }
                    }
                    CommandEvent::Terminated(payload) => {
                        log::error!(
                            "MLX server process terminated with code: {:?}",
                            payload.code
                        );

                        // Update status
                        let mut status = status_clone.write().await;
                        status.is_running = false;
                        status.is_ready = false;
                        status.port = None;
                        status.pid = None;
                        if payload.code != Some(0) {
                            status.error =
                                Some(format!("Server terminated with code: {:?}", payload.code));
                        } else {
                            status.error = Some("Server terminated unexpectedly".to_string());
                        }
                        let final_status = status.clone();
                        drop(status);

                        // Emit status change
                        if let Some(handle) = app_handle_clone.lock().await.as_ref() {
                            let _ = handle.emit("mlx-status-changed", final_status);
                        }

                        break;
                    }
                    _ => {}
                }
            }
            log::warn!("MLX server event listener exited - process may have terminated");
        });
    }

    async fn start_server(&self, mut config: MLXServerConfig) -> Result<(), String> {
        let mut handle_guard = self.process_handle.lock().await;

        // Check if already running
        if handle_guard.is_some() {
            return Err("Server is already running".to_string());
        }

        // Check if the configured port is available, if not find an available one
        if !Self::is_port_available(&config.host, config.port) {
            log::warn!(
                "Port {} is not available, searching for an alternative port...",
                config.port
            );

            match Self::find_available_port(&config.host, config.port) {
                Ok(available_port) => {
                    log::info!(
                        "Found available port: {} (original port {} was in use)",
                        available_port,
                        config.port
                    );
                    config.port = available_port;
                }
                Err(e) => {
                    return Err(format!("Failed to find available port: {}", e));
                }
            }
        } else {
            log::info!("Using configured port: {}", config.port);
        }

        // Get the app handle
        let app = self.get_app_handle().await?;

        // Build command arguments and spawn process
        let args = Self::build_command_args(&config);
        log::info!("Starting MLX server with args: {:?}", args);

        let (rx, child) = self.spawn_mlx_process(app, args).await?;
        let pid = child.pid();

        self.pid_atomic.store(pid, Ordering::SeqCst);
        log::info!("MLX server process spawned with PID: {}", pid);

        // Update status and config
        self.update_status_running(&config, pid).await;
        *self.config.write().await = config;

        // Store the process handle
        *handle_guard = Some(ProcessHandle { child });

        // Emit status change event
        self.emit_status_change().await;

        // Set up event listener for process events in background
        self.setup_process_event_listener(rx).await;

        // Wait for server to be ready
        log::info!("Starting health check process for MLX server...");
        match self.wait_for_server_ready().await {
            Ok(()) => {
                log::info!("MLX server health checks completed successfully");
                Ok(())
            }
            Err(e) => {
                log::error!("MLX server health checks failed: {}", e);
                // Try to stop the server if it's still running
                let _ = self.stop_server().await;
                Err(e)
            }
        }
    }

    // ============================================================================
    // SERVER LIFECYCLE METHODS
    // ============================================================================

    async fn wait_for_server_ready(&self) -> Result<(), String> {
        let config = self.config.read().await;
        let url = format!("http://{}:{}/health", config.host, config.port);

        log::info!("Waiting for MLX server to be ready at: {}", url);

        // Give the server a moment to start up before checking
        tokio::time::sleep(std::time::Duration::from_secs(STARTUP_DELAY_SECS)).await;

        let delay = std::time::Duration::from_secs(HEALTH_CHECK_DELAY_SECS);

        // Create a new client with timeout settings
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(HEALTH_CHECK_TIMEOUT_SECS))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        for attempt in 0..HEALTH_CHECK_MAX_ATTEMPTS {
            log::debug!(
                "Health check attempt {}/{} to {}",
                attempt + 1,
                HEALTH_CHECK_MAX_ATTEMPTS,
                url
            );

            match client.get(&url).send().await {
                Ok(response) => {
                    let status = response.status();
                    log::debug!("Health check response: {}", status);

                    if status.is_success() {
                        log::info!("MLX server is ready after {} attempts", attempt + 1);

                        // Update status to ready
                        let mut status = self.status.write().await;
                        status.is_ready = true;
                        drop(status);

                        // Emit status change event
                        self.emit_status_change().await;

                        return Ok(());
                    } else {
                        log::warn!("Health check returned non-success status: {}", status);

                        // Try to get response body for more details
                        if let Ok(body) = response.text().await {
                            log::debug!("Health check response body: {}", body);
                        }
                    }
                }
                Err(e) => {
                    // More specific error logging
                    if e.is_connect() {
                        log::debug!(
                            "Health check connection failed (server may still be starting): {}",
                            e
                        );
                    } else if e.is_timeout() {
                        log::debug!("Health check timed out: {}", e);
                    } else {
                        log::debug!("Health check failed: {}", e);
                    }

                    // Check if the process is still running
                    let status = self.status.read().await;
                    if !status.is_running {
                        log::error!("MLX server process terminated during startup");
                        return Err("MLX server process terminated during startup".to_string());
                    }
                    drop(status);
                }
            }

            if attempt < HEALTH_CHECK_MAX_ATTEMPTS - 1 {
                tokio::time::sleep(delay).await;
            }
        }

        log::error!(
            "MLX server failed to become ready after {} attempts",
            HEALTH_CHECK_MAX_ATTEMPTS
        );

        // Check final status
        let status = self.status.read().await;
        if let Some(error) = &status.error {
            return Err(format!("MLX server startup failed: {}", error));
        }

        Err("MLX server failed to become ready within timeout. Check logs for details.".to_string())
    }

    pub async fn stop_server(&self) -> Result<(), String> {
        let mut handle_guard = self.process_handle.lock().await;

        if let Some(handle) = handle_guard.take() {
            log::info!("Stopping MLX server...");

            // Kill the process
            handle
                .child
                .kill()
                .map_err(|e| format!("Failed to kill MLX server: {}", e))?;

            log::info!("MLX server stopped successfully");

            // Update status using helper method
            self.update_status_stopped().await;

            // Emit status change event
            self.emit_status_change().await;
        }

        Ok(())
    }

    /// Synchronously sends a SIGINT (or `kill` on Windows) to the MLX sidecar using the cached PID.
    /// This does **not** rely on async locks or Tokio runtimes, so it can be used in a drop handler
    /// or any other synchronous context during application shutdown.
    pub fn kill_sync(&self) {
        let pid = self.pid_atomic.load(Ordering::SeqCst);
        if pid == 0 {
            return;
        }

        #[cfg(unix)]
        unsafe {
            // Send SIGINT; fall back to SIGKILL if SIGINT fails
            if libc::kill(pid as libc::pid_t, libc::SIGINT) != 0 {
                libc::kill(pid as libc::pid_t, libc::SIGKILL);
            }
        }

        #[cfg(windows)]
        {
            use windows_sys::Win32::System::Threading::{
                OpenProcess, TerminateProcess, PROCESS_TERMINATE,
            };
            unsafe {
                let handle = OpenProcess(PROCESS_TERMINATE, 0, pid);
                if handle != 0 {
                    TerminateProcess(handle, 0);
                }
            }
        }
    }

    pub async fn restart(&self) -> Result<MLXServerStatus, String> {
        log::info!("Restarting MLX server...");

        // Stop if running
        let _ = self.stop_server().await;

        // Small delay to ensure clean shutdown
        tokio::time::sleep(std::time::Duration::from_millis(RESTART_DELAY_MILLIS)).await;

        // Start with current config
        let config = self.config.read().await.clone();
        self.start_server(config).await?;

        Ok(self.get_status().await)
    }

    // ============================================================================
    // STATUS AND HEALTH CHECK METHODS
    // ============================================================================

    pub async fn get_status(&self) -> MLXServerStatus {
        self.status.read().await.clone()
    }

    pub async fn health_check(&self) -> bool {
        let status = self.status.read().await;
        if !status.is_running {
            return false;
        }

        let config = self.config.read().await;
        let url = format!("http://{}:{}/health", config.host, config.port);

        // Create a client with timeout
        let client = match reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(HEALTH_CHECK_TIMEOUT_SECS))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                log::error!("Failed to create HTTP client for health check: {}", e);
                return false;
            }
        };

        match client.get(&url).send().await {
            Ok(response) => {
                let is_healthy = response.status().is_success();

                log::trace!(
                    "Health check response: {} (healthy: {})",
                    response.status(),
                    is_healthy
                );

                // Update ready state based on health check
                if is_healthy != status.is_ready {
                    drop(status);
                    let mut status_mut = self.status.write().await;
                    status_mut.is_ready = is_healthy;
                    drop(status_mut);

                    // Emit status change if ready state changed
                    self.emit_status_change().await;

                    if is_healthy {
                        log::info!("MLX server health check passed - server is ready");
                    } else {
                        log::warn!("MLX server health check failed - server is not ready");
                    }
                }

                is_healthy
            }
            Err(e) => {
                log::debug!("Health check request failed: {}", e);

                // If health check fails, mark as not ready
                if status.is_ready {
                    drop(status);
                    let mut status_mut = self.status.write().await;
                    status_mut.is_ready = false;
                    drop(status_mut);

                    // Emit status change
                    self.emit_status_change().await;

                    log::warn!("MLX server health check failed - marking as not ready");
                }

                false
            }
        }
    }

    // ============================================================================
    // EVENT HANDLING METHODS
    // ============================================================================

    async fn emit_status_change(&self) {
        // Get the status first, before locking app_handle
        let status = self.get_status().await;

        // Now try to emit if we have an app handle
        let app_handle_guard = self.app_handle.lock().await;
        if let Some(handle) = app_handle_guard.as_ref() {
            match handle.emit("mlx-status-changed", status.clone()) {
                Ok(_) => log::trace!("Emitted mlx-status-changed event"),
                Err(e) => log::warn!("Failed to emit mlx-status-changed event: {}", e),
            }
        } else {
            log::debug!("App handle not set, skipping status change event");
        }
    }
}
