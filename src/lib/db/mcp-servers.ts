import { sql, type Insertable, type Updateable } from 'kysely'

import { getKysely } from '@/lib/kysely'
import type { McpServerRow } from '@/types'
import type { DB } from '@/types/db'

export async function getMcpServers(search?: string): Promise<McpServerRow[]> {
  const db = await getKysely()

  let query = db.selectFrom('mcp_servers').selectAll()

  if (search?.trim()) {
    const pattern = `%${search}%`
    query = query.where((eb) => {
      const clauses = [
        eb('name', 'like', pattern),
        eb('description', 'like', pattern),
      ]
      if (search === 'stdio' || search === 'http') {
        clauses.push(eb('transport', '=', search))
      }
      return eb.or(clauses)
    })
  }

  return await query.orderBy('created_at', 'desc').execute()
}

/**
 * Fetches an MCP server by id.
 *
 * @param id The server id.
 * @returns The server row or null if not found.
 */
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

/**
 * Inserts a new MCP server row.
 *
 * @param attrs Insertable attributes matching the `mcp_servers` table.
 * @returns The newly created id.
 */
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

/**
 * Updates an existing MCP server row and refreshes `updated_at`.
 *
 * @param id The server id.
 * @param attrs Attributes to update.
 * @returns A promise that resolves when the update is persisted.
 */
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

/**
 * Deletes an MCP server by id.
 *
 * @param id The server id to delete.
 */
export async function deleteMcpServer(id: number): Promise<void> {
  const db = await getKysely()
  await db.deleteFrom('mcp_servers').where('id', '=', id).execute()
}

/**
 * Enables or disables an MCP server.
 * Also refreshes `updated_at`.
 *
 * @param id The server id.
 * @param enabled True to enable, false to disable.
 */
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
