import Database from '@tauri-apps/plugin-sql'

export const dbPromise = Database.load('sqlite:openchat2.db')

/**
 * Inserts a new conversation and returns its row id.
 */
export async function insertConversation(title: string): Promise<number> {
  const db = await dbPromise
  const now = new Date().toISOString()
  await db.execute(
    'INSERT INTO conversations (title, created_at, updated_at) VALUES (?, ?, ?)',
    [title, now, now],
  )
  const rows = await db.select<{ id: number }[]>(
    'SELECT last_insert_rowid() as id',
  )
  return rows[0].id
}

/** Insert a message and return its row id */
export async function insertMessage(
  conversationId: number,
  role: 'user' | 'assistant',
  content: string,
  reasoning?: string,
): Promise<number> {
  const db = await dbPromise
  const now = new Date().toISOString()
  await db.execute(
    'INSERT INTO messages (conversation_id, role, content, reasoning, created_at) VALUES (?, ?, ?, ?, ?)',
    [conversationId, role, content, reasoning || null, now],
  )
  const rows = await db.select<{ id: number }[]>(
    'SELECT last_insert_rowid() as id',
  )
  return rows[0].id
}

/** Update a message's content and reasoning */
export async function updateMessage(
  messageId: number,
  content: string,
  reasoning?: string,
): Promise<void> {
  const db = await dbPromise
  await db.execute(
    'UPDATE messages SET content = ?, reasoning = ? WHERE id = ?',
    [content, reasoning || null, messageId],
  )
}

/**
 * Deletes a conversation and all its associated messages.
 */
export async function deleteConversation(
  conversationId: number,
): Promise<void> {
  const db = await dbPromise
  // Delete all messages for this conversation first
  await db.execute('DELETE FROM messages WHERE conversation_id = ?', [
    conversationId,
  ])
  // Then delete the conversation
  await db.execute('DELETE FROM conversations WHERE id = ?', [conversationId])
}
