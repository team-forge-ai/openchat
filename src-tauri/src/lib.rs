mod models;
mod database;
mod openai_service;
mod commands;

use database::Database;
use openai_service::OpenAIService;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub database: Database,
    pub openai_service: OpenAIService,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables
    dotenvy::dotenv().ok();
    
    let api_key = std::env::var("OPENAI_API_KEY")
        .expect("OPENAI_API_KEY must be set in .env file");

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(|app| {
            // Initialize database
            let app_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            
            std::fs::create_dir_all(&app_dir)
                .expect("Failed to create app data directory");
            
            let db_path = app_dir.join("openchat.db");
            let database = Database::new(&db_path)
                .expect("Failed to initialize database");

            // Initialize OpenAI service
            let openai_service = OpenAIService::new(api_key);

            // Create app state
            let app_state = Arc::new(Mutex::new(AppState {
                database,
                openai_service,
            }));

            app.manage(app_state);
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_conversation,
            commands::get_conversations,
            commands::get_messages,
            commands::send_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
