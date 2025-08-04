mod commands;
mod database;
mod llm;
mod models;

use database::Database;
use llm::LocalLLMService;

use std::{path::PathBuf, sync::Arc};
use tauri::{path::BaseDirectory, App, Manager};
use tokio::sync::Mutex;

// Constants
const MODEL_FILENAME: &str = "qwen3-0.6b-quantized.bin";
const DB_FILENAME: &str = "openchat.db";

pub struct AppState {
    pub database: Database,
    pub llm_service: LocalLLMService,
}

type AppResult<T> = Result<T, Box<dyn std::error::Error>>;

/// Initialize the database in the app data directory
fn initialize_database(app: &App) -> AppResult<Database> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let db_path = app_dir.join(DB_FILENAME);
    Database::new(&db_path).map_err(|e| format!("Failed to initialize database: {}", e).into())
}

/// Resolve the model file path using Tauri's BaseDirectory system
fn resolve_model_path(app: &App) -> PathBuf {
    // Try Tauri's built-in path resolution with proper BaseDirectory fallbacks
    // Note: Since we bundle "models/*", the resource path includes the models directory
    app.path()
        .resolve(
            format!("models/{}", MODEL_FILENAME),
            BaseDirectory::Resource,
        )
        .or_else(|_| {
            // Fallback 1: AppData directory with models subdirectory (recommended for user data)
            app.path()
                .resolve(format!("models/{}", MODEL_FILENAME), BaseDirectory::AppData)
        })
        .or_else(|_| {
            // Fallback 2: Direct in AppData directory
            app.path().resolve(MODEL_FILENAME, BaseDirectory::AppData)
        })
        .or_else(|_| {
            // Fallback 3: Data directory (system-wide data)
            app.path().resolve(MODEL_FILENAME, BaseDirectory::Data)
        })
        .unwrap_or_else(|_| {
            // Final fallback: construct path in AppData/models (will be created if needed)
            app.path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap())
                .join("models")
                .join(MODEL_FILENAME)
        })
}

/// Initialize the LLM service with the resolved model path
fn initialize_llm_service(app: &App) -> LocalLLMService {
    let model_path = resolve_model_path(app);
    LocalLLMService::new(model_path)
}

/// Create and configure the application state
fn create_app_state(app: &App) -> AppResult<Arc<Mutex<AppState>>> {
    let database = initialize_database(app)?;
    let llm_service = initialize_llm_service(app);

    let app_state = Arc::new(Mutex::new(AppState {
        database,
        llm_service,
    }));

    Ok(app_state)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(|app| {
            // Create and configure application state
            let app_state =
                create_app_state(app).map_err(|e| format!("Failed to create app state: {}", e))?;

            // Register the state with Tauri
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
