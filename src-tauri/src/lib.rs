#![warn(clippy::all, rust_2018_idioms)]

// --- Standard library imports ---
use std::fs;

// --- External crate imports ---
use std::sync::Arc;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Manager, RunEvent, WindowEvent};

// --- Internal module imports ---
mod commands;
mod db;
mod mcp;
mod migrations;
mod mlc_server;
mod model_download;
mod model_store;

const MENU_RELOAD_ID: &str = "reload";

/// Name of the SQLite database file used by the app.
const DB_FILE_NAME: &str = "chatchat3.db";
// OpenChat desktop – Tauri + Rust
//
// This crate hosts the native backend for the OpenChat app.
// Responsibilities:
// 1.  Database (SQLite via sqlx)
// 2.  Tauri command handlers bridging React ↔︎ Rust
// Note: LLM interactions now happen through the openchat-mlx-server

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables
    dotenvy::dotenv().ok();

    let app = tauri::Builder::default()
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

            // Set up MLC server manager in app state and auto-start
            let handle = app.handle().clone();
            let manager: Arc<crate::mlc_server::MLCServerManager> =
                Arc::new(crate::mlc_server::MLCServerManager::new(handle));
            let manager_for_start = Arc::clone(&manager);
            app.manage(manager);

            // Set up MCP manager state
            let mcp_manager = crate::mcp::McpManager::new();
            app.manage(mcp_manager);

            // --- Application menu ---
            let reload_item = MenuItemBuilder::new("Reload")
                .id(MENU_RELOAD_ID)
                .accelerator("CmdOrCtrl+R")
                .build(app)
                .map_err(|e| format!("Failed to build Reload menu item: {e}"))?;
            let view_menu = SubmenuBuilder::new(app, "View")
                .items(&[&reload_item])
                .build()
                .map_err(|e| format!("Failed to build View submenu: {e}"))?;
            let app_menu = MenuBuilder::new(app)
                .items(&[&view_menu])
                .build()
                .map_err(|e| format!("Failed to build app menu: {e}"))?;
            app.set_menu(app_menu)
                .map_err(|e| format!("Failed to set app menu: {e}"))?;

            // Auto-start the server in the background
            tauri::async_runtime::spawn(async move {
                let _ = manager_for_start.restart().await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // MLC server management
            commands::mlc_get_status,
            commands::mlc_restart,
            // MCP commands
            commands::mcp_check_server,
            commands::mcp_list_tools,
            commands::mcp_call_tool,
        ])
        .on_menu_event(|app, event| {
            if event.id() == MENU_RELOAD_ID {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.eval("window.location.reload()");
                }
            }
        })
        .on_window_event(move |window, event| {
            if let WindowEvent::Destroyed = event {
                handle_window_destroyed(window);
            }
        });

    let app = app
        .build(tauri::generate_context!())
        .expect("Error while building Tauri application");

    app.run(|app_handle, event| match event {
        RunEvent::Exit => handle_app_exit(app_handle),
        _ => {}
    });
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

/// Handles cleanup when the main window is destroyed (shuts down server).
fn handle_window_destroyed(_window: &tauri::Window) {
    log::info!("Window destroyed...");
}

/// Handles cleanup when the application is exiting (shuts down server).
fn handle_app_exit(app: &tauri::AppHandle) {
    log::info!("App exiting; stopping MLC server...");
    if let Some(state) = app.try_state::<Arc<crate::mlc_server::MLCServerManager>>() {
        // Block until stop completes to ensure process is terminated
        let manager: Arc<crate::mlc_server::MLCServerManager> = state.inner().clone();
        let _ = tauri::async_runtime::block_on(async move {
            manager.stop().await;
        });
    }
}
