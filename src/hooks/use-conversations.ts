import { useQuery, useQueryClient } from '@tanstack/react-query'

import { dbPromise, insertConversation } from '@/lib/db'
import type { Conversation } from '@/types'

interface UseConversationsResult {
  conversations: Conversation[]
  isLoading: boolean
  createConversation: (title?: string) => Promise<number>
}

export function useConversations(): UseConversationsResult {
  const queryClient = useQueryClient()

  const { data: conversations = [], isFetching: isLoading } = useQuery<
    Conversation[]
  >({
    queryKey: ['conversations'],
    queryFn: async () => {
      const db = await dbPromise
      return await db.select<Conversation[]>(
        'SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC',
      )
    },
  })

  const createConversation = async (
    title = `New Chat ${new Date().toLocaleString()}`,
  ) => {
    const id = await insertConversation(title)
    await queryClient.invalidateQueries({ queryKey: ['conversations'] })
    return id
  }

  return { conversations, isLoading, createConversation }
}
