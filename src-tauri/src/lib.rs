#![warn(clippy::all, rust_2018_idioms)]
mod commands;
mod db;
mod migrations;
mod models;

// OpenChat desktop – Tauri + Rust
//
// This crate hosts the native backend for the OpenChat app.
// Responsibilities:
// 1.  Database (SQLite via sqlx)
// 2.  Tauri command handlers bridging React ↔︎ Rust
// Note: LLM interactions now happen through the openchat-mlx-server

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

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
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
