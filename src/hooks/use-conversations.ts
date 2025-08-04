import { useQuery } from '@tanstack/react-query'

import { dbPromise } from '@/lib/db'
import type { Conversation } from '@/types'

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const db = await dbPromise
      return db.select<Conversation[]>(
        'SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC',
      )
    },
  })
}
