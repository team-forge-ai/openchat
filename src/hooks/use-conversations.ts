import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useConversation } from '@/contexts/conversation-context'
import {
  deleteConversation,
  getConversations,
  insertConversation,
} from '@/lib/db'
import type { Conversation } from '@/types'

interface UseConversationsResult {
  conversations: Conversation[]
  isLoading: boolean
  createConversation: {
    mutateAsync: () => Promise<number>
    isLoading: boolean
    error: Error | null
  }
  deleteConversation: {
    mutate: (conversationId: number) => void
    isLoading: boolean
    error: Error | null
  }
}

export function useConversations(search?: string): UseConversationsResult {
  const queryClient = useQueryClient()
  const { selectedConversationId, setSelectedConversationId } =
    useConversation()

  const { data: conversations = [], isFetching: isLoading } = useQuery<
    Conversation[]
  >({
    queryKey: ['conversations', search ?? ''],
    queryFn: () => getConversations(search),
  })

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const id = await insertConversation()
      return id
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: number) => {
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null)
      }

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
