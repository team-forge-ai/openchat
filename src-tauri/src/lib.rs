#![warn(clippy::all, rust_2018_idioms)]
mod commands;
mod db;
mod migrations;
mod mlx_server;
mod models;

// OpenChat desktop – Tauri + Rust
//
// This crate hosts the native backend for the OpenChat app.
// Responsibilities:
// 1.  Database (SQLite via sqlx)
// 2.  Tauri command handlers bridging React ↔︎ Rust
// Note: LLM interactions now happen through the openchat-mlx-server

use mlx_server::MLXServerManager;
use tauri::{Listener, Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:openchat2.db", migrations::migrations())
                .build(),
        )
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(|app| {
            // Initialise a global SqlitePool managed by Tauri
            let db_path = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("failed to get app data dir: {e}"))?;
            std::fs::create_dir_all(&db_path).ok();
            let db_file = db_path.join("openchat.db");
            let pool = tauri::async_runtime::block_on(db::init_pool(&db_file))
                .expect("Failed to create SqlitePool");
            app.manage(pool);

            // Initialize MLX Server Manager
            let mlx_manager = MLXServerManager::new();
            let mlx_manager_clone = mlx_manager.clone();
            let app_handle = app.handle().clone();

            // Set the app handle for event emission
            tauri::async_runtime::spawn(async move {
                mlx_manager_clone.set_app_handle(app_handle).await;
                // Auto-start the MLX server
                if let Err(e) = mlx_manager_clone.auto_start().await {
                    log::error!("Failed to auto-start MLX server: {}", e);
                }
            });

            // Store the manager in Tauri's state
            app.manage(mlx_manager.clone());

            // Register cleanup on app exit
            let mlx_manager_shutdown = mlx_manager.clone();
            app.listen("tauri://before-quit", move |_event| {
                log::info!("App is shutting down, stopping MLX server...");
                mlx_manager_shutdown.shutdown_blocking();
            });

            // Create main window with transparent titlebar (macOS)
            let mut win_builder =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("openchat")
                    .inner_size(800.0, 600.0);

            // Set transparent title bar only when building for macOS
            #[cfg(target_os = "macos")]
            {
                win_builder = win_builder.title_bar_style(TitleBarStyle::Transparent);
            }

            let _window = win_builder
                .build()
                .map_err(|e| format!("Failed to create window: {}", e))?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_port_available,
            commands::get_port_info,
            commands::mlx_get_status,
            commands::mlx_restart,
            commands::mlx_health_check,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
