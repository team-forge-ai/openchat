use crate::{
    models::{Conversation, Message},
    AppState,
};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn create_conversation(
    title: String,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Conversation, String> {
    let app_state = state.lock().await;
    app_state.database
        .create_conversation(&title)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_conversations(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<Conversation>, String> {
    let app_state = state.lock().await;
    app_state.database
        .get_conversations()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_messages(
    conversation_id: i64,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<Message>, String> {
    let app_state = state.lock().await;
    app_state.database
        .get_messages(conversation_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_message(
    conversation_id: i64,
    content: String,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Message, String> {
    let app_state = state.lock().await;
    
    // Add user message to database
    app_state.database
        .add_message(conversation_id, "user", &content)
        .map_err(|e| e.to_string())?;

    // Get all messages for this conversation to provide context
    let messages = app_state.database
        .get_messages(conversation_id)
        .map_err(|e| e.to_string())?;

    // Send to Local LLM
    let ai_response = app_state.llm_service
        .send_message(messages)
        .await
        .map_err(|e| e.to_string())?;

    // Add AI response to database
    let ai_message = app_state.database
        .add_message(conversation_id, "assistant", &ai_response)
        .map_err(|e| e.to_string())?;

    Ok(ai_message)
}