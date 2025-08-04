use crate::models::{Conversation, Message};
use rusqlite::{Connection, Result};
use std::path::Path;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: &Path) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database { conn };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations (id)
            )",
            [],
        )?;

        Ok(())
    }

    pub fn create_conversation(&self, title: &str) -> Result<Conversation> {
        let now = chrono::Utc::now().to_rfc3339();
        
        self.conn.execute(
            "INSERT INTO conversations (title, created_at, updated_at) VALUES (?1, ?2, ?3)",
            [title, &now, &now],
        )?;

        let id = self.conn.last_insert_rowid();
        
        Ok(Conversation {
            id,
            title: title.to_string(),
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn get_conversations(&self) -> Result<Vec<Conversation>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
        )?;

        let conversation_iter = stmt.query_map([], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;

        let mut conversations = Vec::new();
        for conversation in conversation_iter {
            conversations.push(conversation?);
        }

        Ok(conversations)
    }

    pub fn get_messages(&self, conversation_id: i64) -> Result<Vec<Message>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, conversation_id, role, content, created_at 
             FROM messages 
             WHERE conversation_id = ?1 
             ORDER BY created_at ASC"
        )?;

        let message_iter = stmt.query_map([conversation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut messages = Vec::new();
        for message in message_iter {
            messages.push(message?);
        }

        Ok(messages)
    }

    pub fn add_message(&self, conversation_id: i64, role: &str, content: &str) -> Result<Message> {
        let now = chrono::Utc::now().to_rfc3339();
        
        self.conn.execute(
            "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4)",
            [&conversation_id.to_string(), role, content, &now],
        )?;

        // Update conversation's updated_at timestamp
        self.conn.execute(
            "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
            [&now, &conversation_id.to_string()],
        )?;

        let id = self.conn.last_insert_rowid();
        
        Ok(Message {
            id,
            conversation_id,
            role: role.to_string(),
            content: content.to_string(),
            created_at: now,
        })
    }
}