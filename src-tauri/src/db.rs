use sqlx::SqlitePool;
use std::path::Path;

pub async fn init_pool(db_file: &Path) -> Result<SqlitePool, sqlx::Error> {
    let conn_str = format!("sqlite://{}?mode=rwc", db_file.display());
    SqlitePool::connect(&conn_str).await
}

/*
Example of how to insert a conversation

pub async fn insert_conversation(
    pool: &SqlitePool,
    title: &str,
) -> Result<Conversation, sqlx::Error> {
    let now = chrono::Utc::now().to_rfc3339();
    let row: SqliteRow = sqlx::query(
        "INSERT INTO conversations (title, created_at, updated_at) VALUES (?, ?, ?) RETURNING id",
    )
    .bind(title)
    .bind(&now)
    .bind(&now)
    .fetch_one(pool)
    .await?;

    let id: i64 = row.get("id");
    Ok(Conversation {
        id,
        title: title.to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}
*/

/*
Example of how to list conversations

pub async fn list_conversations(pool: &SqlitePool) -> Result<Vec<Conversation>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| Conversation {
            id: row.get("id"),
            title: row.get::<String, _>("title"),
            created_at: row.get::<String, _>("created_at"),
            updated_at: row.get::<String, _>("updated_at"),
        })
        .collect())
}
*/
