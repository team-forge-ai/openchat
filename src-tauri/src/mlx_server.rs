use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use tauri::async_runtime::Mutex;
use tauri::async_runtime::RwLock;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

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
            model_path: "models/Qwen3-0.6B-MLX-4bit".to_string(),
            port: 8000,
            host: "127.0.0.1".to_string(),
            log_level: Some("INFO".to_string()),
            max_tokens: Some(32000),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLXServerStatus {
    pub is_running: bool,
    pub port: Option<u16>,
    pub model_path: Option<String>,
    pub pid: Option<u32>,
    pub error: Option<String>,
}

impl Default for MLXServerStatus {
    fn default() -> Self {
        Self {
            is_running: false,
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

    pub async fn set_app_handle(&self, handle: AppHandle) {
        let mut app_handle = self.app_handle.lock().await;
        *app_handle = Some(handle);
    }

    pub async fn auto_start(&self) -> Result<(), String> {
        log::info!("Auto-starting MLX server...");

        // Clean up any orphaned processes first
        self.cleanup_orphaned_processes().await;

        // Start the server with default config
        let config = self.config.read().await.clone();
        self.start_server(config).await?;

        self.startup_complete.store(true, Ordering::SeqCst);
        log::info!("MLX server auto-start complete");
        Ok(())
    }

    async fn start_server(&self, config: MLXServerConfig) -> Result<(), String> {
        let mut handle_guard = self.process_handle.lock().await;

        // Check if already running
        if handle_guard.is_some() {
            return Err("Server is already running".to_string());
        }

        // Get the app handle
        let app_handle = self.app_handle.lock().await;
        let app = app_handle
            .as_ref()
            .ok_or_else(|| "App handle not set".to_string())?;

        // Build command arguments
        let mut args = vec![
            config.model_path.clone(),
            "--port".to_string(),
            config.port.to_string(),
            "--host".to_string(),
            config.host.clone(),
        ];

        if let Some(log_level) = &config.log_level {
            args.push("--log-level".to_string());
            args.push(log_level.clone());
        }

        if let Some(max_tokens) = &config.max_tokens {
            args.push("--max-tokens".to_string());
            args.push(max_tokens.to_string());
        }

        // Create and spawn the sidecar command
        let (mut rx, child) = app
            .shell()
            .sidecar("openchat-mlx-server")
            .map_err(|e| format!("Failed to create sidecar command: {}", e))?
            .args(args)
            .spawn()
            .map_err(|e| format!("Failed to spawn MLX server: {}", e))?;

        let pid = child.pid();
        self.pid_atomic.store(pid, Ordering::SeqCst);
        log::info!("MLX server started with PID: {}", pid);

        // Update status
        let mut status = self.status.write().await;
        status.is_running = true;
        status.port = Some(config.port);
        status.model_path = Some(config.model_path.clone());
        status.pid = Some(pid);
        status.error = None;
        drop(status);

        // Update config
        *self.config.write().await = config;

        // Store the process handle
        *handle_guard = Some(ProcessHandle { child });

        // Emit status change event
        self.emit_status_change().await;

        // Set up event listener for process events in background
        let status_clone = self.status.clone();
        let app_handle_clone = self.app_handle.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        log::info!("MLX server stdout: {}", String::from_utf8_lossy(&line));
                    }
                    CommandEvent::Stderr(line) => {
                        log::error!("MLX server stderr: {}", String::from_utf8_lossy(&line));
                    }
                    CommandEvent::Terminated(payload) => {
                        log::info!("MLX server terminated with code: {:?}", payload.code);

                        // Update status
                        let mut status = status_clone.write().await;
                        status.is_running = false;
                        status.port = None;
                        status.pid = None;
                        if payload.code != Some(0) {
                            status.error =
                                Some(format!("Server terminated with code: {:?}", payload.code));
                        }
                        drop(status);

                        // Emit status change
                        if let Some(handle) = app_handle_clone.lock().await.as_ref() {
                            let status = status_clone.read().await.clone();
                            let _ = handle.emit("mlx-status-changed", status);
                        }

                        break;
                    }
                    _ => {}
                }
            }
        });

        // Wait for server to be ready
        self.wait_for_server_ready().await?;

        Ok(())
    }

    async fn wait_for_server_ready(&self) -> Result<(), String> {
        let config = self.config.read().await;
        let url = format!("http://{}:{}/health", config.host, config.port);

        let max_attempts = 30;
        let delay = std::time::Duration::from_secs(1);

        for attempt in 0..max_attempts {
            match reqwest::get(&url).await {
                Ok(response) if response.status().is_success() => {
                    log::info!("MLX server is ready after {} attempts", attempt + 1);

                    // Emit ready event
                    self.emit_ready_event().await;

                    return Ok(());
                }
                _ => {
                    if attempt < max_attempts - 1 {
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }

        Err("MLX server failed to become ready within timeout".to_string())
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

            // Update status
            let mut status = self.status.write().await;
            status.is_running = false;
            status.port = None;
            status.model_path = None;
            status.pid = None;
            self.pid_atomic.store(0, Ordering::SeqCst);
            drop(status);

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

        // Emit restarting event
        if let Some(handle) = self.app_handle.lock().await.as_ref() {
            let _ = handle.emit("mlx-restarting", ());
        }

        // Stop if running
        let _ = self.stop_server().await;

        // Small delay to ensure clean shutdown
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        // Start with current config
        let config = self.config.read().await.clone();
        self.start_server(config).await?;

        Ok(self.get_status().await)
    }

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

        match reqwest::get(&url).await {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }

    async fn cleanup_orphaned_processes(&self) {
        // This is platform-specific and would need proper implementation
        // For now, we'll just log that we're checking
        log::info!("Checking for orphaned MLX server processes...");

        // On Unix systems, you could use:
        // - Check if port is in use and try to identify the process
        // - Use system commands to find and kill orphaned processes

        #[cfg(unix)]
        {
            use std::process::Command;

            // Try to find any openchat-mlx-server processes
            let output = Command::new("pgrep")
                .arg("-f")
                .arg("openchat-mlx-server")
                .output();

            if let Ok(output) = output {
                let pids = String::from_utf8_lossy(&output.stdout);
                for pid_str in pids.lines() {
                    if let Ok(pid) = pid_str.trim().parse::<i32>() {
                        log::warn!(
                            "Found orphaned MLX server process with PID: {}, attempting to kill",
                            pid
                        );
                        let _ = Command::new("kill").arg("-9").arg(pid.to_string()).output();
                    }
                }
            }
        }
    }

    async fn emit_status_change(&self) {
        if let Some(handle) = self.app_handle.lock().await.as_ref() {
            let status = self.get_status().await;
            let _ = handle.emit("mlx-status-changed", status);
        }
    }

    async fn emit_ready_event(&self) {
        if let Some(handle) = self.app_handle.lock().await.as_ref() {
            let _ = handle.emit("mlx-ready", ());
        }
    }
}
