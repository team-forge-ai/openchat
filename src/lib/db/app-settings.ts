import { sql } from 'kysely'

import { getKysely } from '@/lib/kysely'

const SINGLETON_ID = 1

export async function getSystemPrompt(): Promise<string> {
  const db = await getKysely()
  const row = await db
    .selectFrom('app_settings')
    .select(['system_prompt'])
    .where('id', '=', SINGLETON_ID)
    .executeTakeFirst()

  return row?.system_prompt ?? ''
}

/**
 * Updates the singleton application setting for the system prompt.
 * Also refreshes the `updated_at` timestamp.
 *
 * @param prompt The full system prompt text to store.
 * @returns A promise that resolves when the update has been persisted.
 */
export async function setSystemPrompt(prompt: string): Promise<void> {
  const db = await getKysely()
  await db
    .updateTable('app_settings')
    .set({
      system_prompt: prompt,
      updated_at: sql<string>`CURRENT_TIMESTAMP`,
    })
    .where('id', '=', SINGLETON_ID)
    .execute()
}
