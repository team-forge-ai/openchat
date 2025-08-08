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

export async function deleteAllConversations(): Promise<void> {
  const db = await getKysely()
  await db.deleteFrom('messages').execute()
  await db.deleteFrom('conversations').execute()
}

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

export async function getConversations(
  search?: string,
): Promise<Conversation[]> {
  const db = await getKysely()

  let query = db
    .selectFrom('conversations')
    .select(['id', 'title', 'created_at', 'updated_at'])

  if (search?.trim()) {
    const pattern = `%${search}%`
    query = query.where('title', 'like', pattern)
  }

  const rows = await query.orderBy('updated_at', 'desc').execute()

  return rows.map((r) => ({ ...r, title: r.title ?? '' }))
}

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
