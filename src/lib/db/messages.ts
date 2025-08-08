import type { Insertable, Selectable, Updateable } from 'kysely'

import { getKysely } from '@/lib/kysely'
import type { Message } from '@/types'
import type { DB } from '@/types/db'

export async function insertMessage(
  attrs: Insertable<DB['messages']>,
): Promise<number> {
  const db = await getKysely()

  const row = await db
    .insertInto('messages')
    .values(attrs)
    .returning('id')
    .executeTakeFirstOrThrow()

  return Number(row.id)
}

export async function updateMessage(
  messageId: number,
  attrs: Updateable<DB['messages']>,
): Promise<void> {
  const db = await getKysely()

  if (Object.keys(attrs).length === 0) {
    return
  }

  await db
    .updateTable('messages')
    .set(attrs)
    .where('id', '=', messageId)
    .execute()
}

export async function getMessagesForChat(
  conversationId: number,
): Promise<Selectable<DB['messages']>[]> {
  const db = await getKysely()
  return await db
    .selectFrom('messages')
    .selectAll()
    .where('conversation_id', '=', conversationId)
    .orderBy('id', 'asc')
    .execute()
}

export async function getMessages(conversationId: number): Promise<Message[]> {
  const db = await getKysely()
  const rows = await db
    .selectFrom('messages')
    .selectAll()
    .where('conversation_id', '=', conversationId)
    .orderBy('id', 'asc')
    .execute()

  return rows
}
