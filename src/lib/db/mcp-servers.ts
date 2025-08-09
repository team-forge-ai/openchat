import { sql, type Insertable, type Updateable } from 'kysely'

import { getKysely } from '@/lib/kysely'
import type { McpServerRow } from '@/types'
import type { DB } from '@/types/db'

export async function getMcpServers(search?: string): Promise<McpServerRow[]> {
  const db = await getKysely()

  let query = db.selectFrom('mcp_servers').selectAll()

  if (search?.trim()) {
    const pattern = `%${search}%`
    query = query.where((eb) =>
      eb.or([
        eb('name', 'like', pattern),
        eb('description', 'like', pattern),
        eb('transport', '=', search as any),
      ]),
    )
  }

  return await query.orderBy('updated_at', 'desc').execute()
}

export async function getMcpServerById(
  id: number,
): Promise<McpServerRow | null> {
  const db = await getKysely()
  const row = await db
    .selectFrom('mcp_servers')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
  return row ?? null
}

export async function insertMcpServer(
  attrs: Insertable<DB['mcp_servers']>,
): Promise<number> {
  const db = await getKysely()
  const row = await db
    .insertInto('mcp_servers')
    .values(attrs)
    .returning('id')
    .executeTakeFirstOrThrow()
  return Number(row.id)
}

export async function updateMcpServer(
  id: number,
  attrs: Updateable<DB['mcp_servers']>,
): Promise<void> {
  const db = await getKysely()
  await db
    .updateTable('mcp_servers')
    .set({
      ...attrs,
      updated_at: sql`CURRENT_TIMESTAMP` as unknown as string,
    })
    .where('id', '=', id)
    .execute()
}

export async function deleteMcpServer(id: number): Promise<void> {
  const db = await getKysely()
  await db.deleteFrom('mcp_servers').where('id', '=', id).execute()
}

export async function setMcpServerEnabled(
  id: number,
  enabled: boolean,
): Promise<void> {
  const db = await getKysely()
  await db
    .updateTable('mcp_servers')
    .set({
      enabled: enabled ? 1 : 0,
      updated_at: sql`CURRENT_TIMESTAMP` as unknown as string,
    })
    .where('id', '=', id)
    .execute()
}
