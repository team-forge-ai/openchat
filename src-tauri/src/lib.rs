#![warn(clippy::all, rust_2018_idioms)]

// --- Standard library imports ---
use std::fs;

// --- External crate imports ---
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

// --- Internal module imports ---
mod commands;
mod db;
mod migrations;
mod mlx_server;
mod models;

/// Name of the SQLite database file used by the app.
const DB_FILE_NAME: &str = "openchat2.db";
// OpenChat desktop – Tauri + Rust
//
// This crate hosts the native backend for the OpenChat app.
// Responsibilities:
// 1.  Database (SQLite via sqlx)
// 2.  Tauri command handlers bridging React ↔︎ Rust
// Note: LLM interactions now happen through the openchat-mlx-server

use mlx_server::MLXServerManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    &format!("sqlite:{}", DB_FILE_NAME),
                    migrations::migrations(),
                )
                .build(),
        )
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(|app| {
            // --- Database setup ---
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {e}"))?;
            setup_sqlite_pool(app, &app_data_dir)?;

            // --- MLX Server Manager setup ---
            setup_mlx_server_manager(app);

            // --- Main window creation ---
            create_main_window(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_port_available,
            commands::get_port_info,
            commands::mlx_get_status,
            commands::mlx_restart,
            commands::mlx_health_check,
        ])
        .on_window_event(move |window, event| {
            if let WindowEvent::Destroyed = event {
                handle_window_destroyed(window);
            }
        })
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}

/// Helper to create the main window with platform-specific options.
fn create_main_window(app: &mut tauri::App) -> Result<(), String> {
    let mut win_builder =
        WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
            .title("openchat")
            .inner_size(800.0, 600.0);

    // Set transparent title bar only when building for macOS
    #[cfg(target_os = "macos")]
    {
        win_builder = win_builder.title_bar_style(TitleBarStyle::Transparent);
    }

    win_builder
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;
    Ok(())
}

/// Helper to initialize and set up the MLX server manager.
fn setup_mlx_server_manager(app: &mut tauri::App) {
    let mlx_manager = MLXServerManager::new();
    let mlx_manager_clone = mlx_manager.clone();
    let app_handle = app.handle().clone(); // Clone the AppHandle here

    // Set the app handle for event emission and auto-start MLX server
    tauri::async_runtime::spawn(async move {
        mlx_manager_clone.set_app_handle(app_handle).await;
        // Auto-start the MLX server
        if let Err(e) = mlx_manager_clone.auto_start().await {
            log::error!("Failed to auto-start MLX server: {}", e);
        }
    });

    // Store the manager in Tauri's state
    app.manage(mlx_manager);
}

/// Sets up the SQLite connection pool and stores it in Tauri's app state.
fn setup_sqlite_pool(app: &mut tauri::App, app_data_dir: &std::path::Path) -> Result<(), String> {
    // Ensure the app data directory exists
    fs::create_dir_all(app_data_dir).map_err(|e| format!("Failed to create app data dir: {e}"))?;
    let db_file = app_data_dir.join(DB_FILE_NAME);
    let pool = tauri::async_runtime::block_on(db::init_pool(&db_file))
        .map_err(|_| "Failed to create SqlitePool".to_string())?;
    app.manage(pool);
    Ok(())
}

/// Handles cleanup when the main window is destroyed (shuts down MLX server).
fn handle_window_destroyed(window: &tauri::Window) {
    log::info!("Window destroyed, shutting down MLX server...");

    // Grab the MLX manager and shut it down on the existing async runtime
    let app_handle = window.app_handle().clone();
    tauri::async_runtime::spawn(async move {
        let mlx_manager = app_handle.state::<MLXServerManager>().clone();
        log::info!("Killing MLX server...");
        // Attempt fast synchronous kill, this is because we can't use async locks or Tokio runtimes here
        mlx_manager.kill_sync();
        log::info!("MLX server killed");
    });

    log::info!("MLX server shutdown complete");
}
