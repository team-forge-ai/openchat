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

export async function getModel(): Promise<string | null> {
  const db = await getKysely()
  const row = await db
    .selectFrom('app_settings')
    .select(['model'])
    .where('id', '=', SINGLETON_ID)
    .executeTakeFirst()

  return row?.model ?? null
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

/**
 * Updates the singleton application setting for the model.
 * Also refreshes the `updated_at` timestamp.
 *
 * @param model The model repository ID to store (e.g., "mlc-ai/Qwen2.5-7B-Instruct-q4f16_1-MLC") or null to unset.
 * @returns A promise that resolves when the update has been persisted.
 */
export async function setModel(model: string | null): Promise<void> {
  const db = await getKysely()
  await db
    .updateTable('app_settings')
    .set({
      model,
      updated_at: sql<string>`CURRENT_TIMESTAMP`,
    })
    .where('id', '=', SINGLETON_ID)
    .execute()
}
