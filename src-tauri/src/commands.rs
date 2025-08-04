use crate::{
    models::{Conversation, Message},
    AppState,
};
use chrono::Utc;
use sqlx::{sqlite::SqliteRow, Row, SqlitePool};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn create_conversation(
    title: String,
    pool: State<'_, SqlitePool>,
) -> Result<Conversation, String> {
    let pool = pool.inner();
    let now = Utc::now().to_rfc3339();

    let row: SqliteRow = sqlx::query(
        "INSERT INTO conversations (title, created_at, updated_at) VALUES (?, ?, ?) RETURNING id",
    )
    .bind(&title)
    .bind(&now)
    .bind(&now)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let id: i64 = row.get("id");

    Ok(Conversation {
        id,
        title,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub async fn get_conversations(pool: State<'_, SqlitePool>) -> Result<Vec<Conversation>, String> {
    let pool = pool.inner();

    let rows = sqlx::query(
        "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let conversations = rows
        .into_iter()
        .map(|row| Conversation {
            id: row.get("id"),
            title: row.get::<String, _>("title"),
            created_at: row.get::<String, _>("created_at"),
            updated_at: row.get::<String, _>("updated_at"),
        })
        .collect();

    Ok(conversations)
}

#[tauri::command]
pub async fn get_messages(
    conversation_id: i64,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Message>, String> {
    let pool = pool.inner();

    let rows = sqlx::query(
        "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id",
    )
    .bind(conversation_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let messages = rows
        .into_iter()
        .map(|row| Message {
            id: row.get("id"),
            conversation_id: row.get("conversation_id"),
            role: row.get::<String, _>("role").into(),
            content: row.get::<String, _>("content"),
            created_at: row.get::<String, _>("created_at"),
        })
        .collect();

    Ok(messages)
}

#[tauri::command]
pub async fn send_message(
    conversation_id: i64,
    content: String,
    pool: State<'_, SqlitePool>,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Message, String> {
    let pool = pool.inner();
    let now = Utc::now().to_rfc3339();

    // Insert user message
    sqlx::query(
        "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, 'user', ?, ?)",
    )
    .bind(conversation_id)
    .bind(&content)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Fetch context for LLM
    let context_rows = sqlx::query(
        "SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id",
    )
    .bind(conversation_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let context: Vec<Message> = context_rows
        .iter()
        .map(|row| Message {
            id: row.get("id"),
            conversation_id,
            role: row.get::<String, _>("role"),
            content: row.get::<String, _>("content"),
            created_at: row.get::<String, _>("created_at"),
        })
        .collect();

    // Generate AI response
    let ai_response = {
        let app = state.lock().await;
        app.llm_service
            .send_message(context)
            .await
            .map_err(|e| e.to_string())?
    };

    let ai_now = Utc::now().to_rfc3339();

    let row: SqliteRow = sqlx::query(
        "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, 'assistant', ?, ?) RETURNING id",
    )
    .bind(conversation_id)
    .bind(&ai_response)
    .bind(&ai_now)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let id: i64 = row.get("id");

    Ok(Message {
        id,
        conversation_id,
        role: "assistant".into(),
        content: ai_response,
        created_at: ai_now,
    })
}
