mod commands;
mod llm;
mod models;

use llm::LocalLLMService;

use std::{path::PathBuf, sync::Arc};
use tauri::{path::BaseDirectory, App, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};
use tokio::sync::Mutex;

// Constants
const MODEL_FILENAME: &str = "qwen3-0.6b-quantized.bin";

pub struct AppState {
    pub llm_service: LocalLLMService,
}

type AppResult<T> = Result<T, Box<dyn std::error::Error>>;

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
    let llm_service = initialize_llm_service(app);

    let app_state = Arc::new(Mutex::new(AppState { llm_service }));

    Ok(app_state)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:openchat.db",
                    vec![
                        Migration {
                            version: 1,
                            description: "create_conversations",
                            sql: "CREATE TABLE IF NOT EXISTS conversations (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                title TEXT NOT NULL,
                                created_at TEXT NOT NULL,
                                updated_at TEXT NOT NULL
                            );",
                            kind: MigrationKind::Up,
                        },
                        Migration {
                            version: 2,
                            description: "create_messages",
                            sql: "CREATE TABLE IF NOT EXISTS messages (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                conversation_id INTEGER NOT NULL,
                                role TEXT NOT NULL,
                                content TEXT NOT NULL,
                                created_at TEXT NOT NULL,
                                FOREIGN KEY (conversation_id) REFERENCES conversations (id)
                            );",
                            kind: MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
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
