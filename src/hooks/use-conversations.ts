import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { dbPromise, deleteConversation, insertConversation } from '@/lib/db'
import type { Conversation } from '@/types'

interface UseConversationsResult {
  conversations: Conversation[]
  isLoading: boolean
  createConversation: {
    mutateAsync: (title?: string) => Promise<number>
    isLoading: boolean
    error: Error | null
  }
  deleteConversation: {
    mutate: (conversationId: number) => void
    isLoading: boolean
    error: Error | null
  }
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

  const createConversationMutation = useMutation({
    mutationFn: async (title?: string) => {
      const finalTitle = title ?? `New Chat ${new Date().toLocaleString()}`
      const id = await insertConversation(finalTitle)
      return id
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: number) => {
      await deleteConversation(conversationId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  return {
    conversations,
    isLoading,
    createConversation: {
      mutateAsync: createConversationMutation.mutateAsync,
      isLoading: createConversationMutation.isPending,
      error: createConversationMutation.error,
    },
    deleteConversation: {
      mutate: deleteConversationMutation.mutate,
      isLoading: deleteConversationMutation.isPending,
      error: deleteConversationMutation.error,
    },
  }
}
