import Database from '@tauri-apps/plugin-sql'
import { Kysely } from 'kysely'
import { TauriSqliteDialect } from 'kysely-dialect-tauri'

import type { DB } from '@/types/db'

// DB interface now lives in src/types/db.ts

let kyselySingleton: Kysely<DB> | undefined

export async function getKysely(): Promise<Kysely<DB>> {
  if (kyselySingleton) {
    return kyselySingleton
  }

  const database = await Database.load('sqlite:chatchat3.db')

  kyselySingleton = new Kysely<DB>({
    dialect: new TauriSqliteDialect({ database }),
    // Provide explicit sqlite adapter bits to ensure proper typing/behavior
    // in environments where dialect detection may be limited.
    plugins: [],
  })

  return kyselySingleton
}

export type { Kysely as KyselyInstance }
