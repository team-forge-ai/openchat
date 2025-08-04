import { useQuery } from '@tanstack/react-query'

import { dbPromise } from '@/lib/db'
import type { Message } from '@/types'

export function useMessages(conversationId: number | null) {
  return useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const db = await dbPromise
      return db.select<Message[]>(
        'SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id',
        [conversationId],
      )
    },
  })
}
