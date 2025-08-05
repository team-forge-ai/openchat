import { useQuery, useQueryClient } from '@tanstack/react-query'

import { dbPromise, insertMessage } from '@/lib/db'
import type { Message } from '@/types'

interface UseMessagesResult {
  messages: Message[]
  isLoading: boolean
  addMessage: (
    conversationId: number,
    role: 'user' | 'assistant',
    content: string,
  ) => Promise<number>
}

export function useMessages(conversationId: number | null): UseMessagesResult {
  const queryClient = useQueryClient()

  const { data: messages = [], isFetching: isLoading } = useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const db = await dbPromise
      return await db.select<Message[]>(
        'SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id',
        [conversationId],
      )
    },
  })

  const addMessage = async (
    conversationId: number,
    role: 'user' | 'assistant',
    content: string,
  ) => {
    const id = await insertMessage(conversationId, role, content)
    await queryClient.invalidateQueries({
      queryKey: ['messages', conversationId],
    })
    return id
  }

  return { messages, isLoading, addMessage }
}
