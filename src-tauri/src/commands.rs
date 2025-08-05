use crate::{models::Message, AppState};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// Generate an assistant reply given the full conversation context.
#[tauri::command]
pub async fn generate_assistant_response(
    context: Vec<Message>,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let reply = {
        let app = state.lock().await;
        app.llm_service
            .send_message(context)
            .await
            .map_err(|e| e.to_string())?
    };

    Ok(reply)
}
