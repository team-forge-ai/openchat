import { sql, type Updateable } from 'kysely'

import { getKysely } from '@/lib/kysely'
import type { Conversation } from '@/types'

export async function insertConversation(): Promise<number> {
  const db = await getKysely()
  const row = await db
    .insertInto('conversations')
    .defaultValues()
    .returning('id')
    .executeTakeFirstOrThrow()
  return Number(row.id)
}

/**
 * Permanently deletes all conversations and their messages.
 * Intended for development and testing only.
 *
 * @returns A promise that resolves when all rows are removed.
 */
export async function deleteAllConversations(): Promise<void> {
  const db = await getKysely()
  await db.deleteFrom('messages').execute()
  await db.deleteFrom('conversations').execute()
}

/**
 * Sets the conversation title only if it is currently null or empty.
 * Also updates the conversation's `updated_at` timestamp.
 *
 * @param conversationId The conversation identifier.
 * @param title The title to set when it is currently unset.
 * @returns True if a row was updated; false otherwise.
 */
export async function updateConversationTitleIfUnset(
  conversationId: number,
  title: string,
): Promise<boolean> {
  const db = await getKysely()
  const setValues: Updateable<any> = {
    title,
    updated_at: sql`CURRENT_TIMESTAMP` as unknown as string,
  }
  const res = await db
    .updateTable('conversations')
    .set(setValues)
    .where('id', '=', conversationId)
    .where((wb) => wb.or([wb('title', 'is', null), wb('title', '=', '')]))
    .executeTakeFirst()

  const rowsAffected = 'numUpdatedRows' in res ? Number(res.numUpdatedRows) : 0
  return rowsAffected > 0
}

/**
 * Updates the conversation's `updated_at` timestamp to the current time.
 *
 * @param conversationId The conversation identifier.
 * @returns A promise that resolves when the timestamp is updated.
 */
export async function touchConversation(conversationId: number): Promise<void> {
  const db = await getKysely()
  const setValues: Updateable<any> = {
    updated_at: sql`CURRENT_TIMESTAMP` as unknown as string,
  }
  await db
    .updateTable('conversations')
    .set(setValues)
    .where('id', '=', conversationId)
    .execute()
}

/**
 * Lists conversations, optionally filtered by a search term.
 * The search matches title LIKE, message content (FTS), and title (FTS).
 * Results are ordered by `updated_at` descending.
 *
 * @param search Optional search term. When provided, applies LIKE and FTS filters.
 * @returns A list of conversation summaries.
 */
export async function getConversations(
  search?: string,
): Promise<Conversation[]> {
  const db = await getKysely()

  let query = db
    .selectFrom('conversations')
    .select(['id', 'title', 'created_at', 'updated_at'])

  if (search?.trim()) {
    const pattern = `%${search}%`
    const ftsTerms = search
      .trim()
      .split(/\s+/)
      .map((t) => t.replace(/["']/g, ''))
      .filter(Boolean)
    const ftsQuery = ftsTerms.map((t) => `${t}*`).join(' AND ')

    query = query.where((wb) =>
      wb.or([
        wb('title', 'like', pattern),
        // Match conversations by any message content via FTS
        sql<boolean>`id IN (
          SELECT conversation_id FROM messages_fts
          WHERE messages_fts MATCH ${ftsQuery}
        )`,
        // Match conversations by title via FTS
        sql<boolean>`id IN (
          SELECT rowid FROM conversations_fts
          WHERE conversations_fts MATCH ${ftsQuery}
        )`,
      ]),
    )
  }

  const rows = await query.orderBy('updated_at', 'desc').execute()

  return rows
}

/**
 * Deletes a conversation and all of its messages.
 *
 * @param conversationId The conversation identifier to delete.
 * @returns A promise that resolves when the rows are removed.
 */
export async function deleteConversation(
  conversationId: number,
): Promise<void> {
  const db = await getKysely()
  await db
    .deleteFrom('messages')
    .where('conversation_id', '=', conversationId)
    .execute()
  await db
    .deleteFrom('conversations')
    .where('id', '=', conversationId)
    .execute()
}

/**
 * Fetches a single conversation by id.
 *
 * @param conversationId The conversation identifier.
 * @returns The conversation row or throws if not found.
 */
export async function getConversation(
  conversationId: number,
): Promise<Conversation> {
  const db = await getKysely()
  const row = await db
    .selectFrom('conversations')
    .selectAll()
    .where('id', '=', conversationId)
    .executeTakeFirstOrThrow()
  return row
}
