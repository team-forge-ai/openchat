import Database from '@tauri-apps/plugin-sql'

import type { MessageStatus } from '@/types'

export const dbPromise = Database.load('sqlite:chatchat3.db')

/**
 * Inserts a new conversation and returns its row id.
 */
export async function insertConversation(): Promise<number> {
  const db = await dbPromise
  const result = await db.execute('INSERT INTO conversations DEFAULT VALUES')

  return result.lastInsertId as number
}

/**
 * Deletes all conversations and their associated messages from the database.
 */
export async function deleteAllConversations(): Promise<void> {
  const db = await dbPromise
  // Delete all messages first due to foreign key constraint
  await db.execute('DELETE FROM messages')
  await db.execute('DELETE FROM conversations')
}

/**
 * Conditionally set conversation name if it has not been set yet.
 * Returns true if the name was updated, false otherwise.
 */
export async function updateConversationTitleIfUnset(
  conversationId: number,
  title: string,
): Promise<boolean> {
  const db = await dbPromise
  const result = await db.execute(
    'UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (title IS NULL OR title = "")',
    [title, conversationId],
  )
  const rowsAffected = result.rowsAffected ?? 0
  return rowsAffected > 0
}

/** Insert a message and return its row id */
export async function insertMessage(
  conversationId: number,
  role: 'user' | 'assistant',
  content: string,
  reasoning?: string,
  status: 'pending' | 'complete' | 'error' = 'complete',
): Promise<number> {
  const db = await dbPromise
  const result = await db.execute(
    'INSERT INTO messages (conversation_id, role, content, reasoning, status, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [conversationId, role, content, reasoning || null, status],
  )
  return result.lastInsertId as number
}

/** Update a message by setting only provided attributes */
export interface UpdateMessageAttributes {
  content?: string
  reasoning?: string
  status?: MessageStatus
}

export async function updateMessage(
  messageId: number,
  attrs: UpdateMessageAttributes,
): Promise<void> {
  const fields: string[] = []
  const params: unknown[] = []

  if (attrs.content !== undefined) {
    fields.push('content = ?')
    params.push(attrs.content)
  }
  if (attrs.reasoning !== undefined) {
    fields.push('reasoning = ?')
    params.push(attrs.reasoning ?? null)
  }
  if (attrs.status !== undefined) {
    fields.push('status = ?')
    params.push(attrs.status)
  }

  if (fields.length === 0) {
    return
  }

  const sql = `UPDATE messages SET ${fields.join(', ')} WHERE id = ?`
  params.push(messageId)

  const db = await dbPromise
  await db.execute(sql, params)
}

export async function updateMessageStatus(
  messageId: number,
  status: 'pending' | 'complete' | 'error',
): Promise<void> {
  const db = await dbPromise
  await db.execute('UPDATE messages SET status = ? WHERE id = ?', [
    status,
    messageId,
  ])
}

export async function touchConversation(conversationId: number): Promise<void> {
  const db = await dbPromise
  await db.execute(
    'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [conversationId],
  )
}

/**
 * Gets all conversations ordered by updated_at descending.
 */
export async function getConversations(search?: string): Promise<
  Array<{
    id: number
    title: string
    created_at: string
    updated_at: string
  }>
> {
  const db = await dbPromise
  if (search && search.trim() !== '') {
    const pattern = `%${search}%`
    return await db.select(
      'SELECT id, title, created_at, updated_at FROM conversations WHERE title LIKE ? COLLATE NOCASE ORDER BY updated_at DESC',
      [pattern],
    )
  }
  return await db.select(
    'SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC',
  )
}

/**
 * Gets messages for a conversation (basic fields for chat completion).
 */
export async function getMessagesForChat(conversationId: number): Promise<
  Array<{
    id: number
    conversation_id: number
    role: 'user' | 'assistant'
    content: string
    status: 'pending' | 'complete' | 'error'
    created_at: string
  }>
> {
  const db = await dbPromise
  return await db.select(
    'SELECT id, conversation_id, role, content, status, created_at FROM messages WHERE conversation_id = ? ORDER BY id',
    [conversationId],
  )
}

/**
 * Gets all message fields for a conversation (including reasoning).
 */
export async function getMessages(conversationId: number): Promise<
  Array<{
    id: number
    conversation_id: number
    role: 'user' | 'assistant'
    content: string
    reasoning?: string
    status: 'pending' | 'complete' | 'error'
    created_at: string
  }>
> {
  const db = await dbPromise
  return await db.select(
    'SELECT id, conversation_id, role, content, reasoning, status, created_at FROM messages WHERE conversation_id = ? ORDER BY id',
    [conversationId],
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
