import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAppContext } from '@/contexts/app-context'
import {
  deleteAllConversations,
  deleteConversation,
  getConversations,
  insertConversation,
} from '@/lib/db/conversations'
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
  deleteAllConversations: {
    mutate: () => void
    isLoading: boolean
    error: Error | null
  }
}

/**
 * useConversations
 *
 * Loads conversations and exposes mutations to create or delete a conversation.
 * Query results are cached via TanStack Query and invalidated on mutations.
 *
 * @param search Optional search term to filter conversations.
 * @returns The list, loading state, and mutations: `createConversation`, `deleteConversation`.
 */
export function useConversations(search?: string): UseConversationsResult {
  const queryClient = useQueryClient()
  const { selectedConversationId, setSelectedConversationId } = useAppContext()

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

  const deleteAllConversationsMutation = useMutation({
    mutationFn: async () => {
      try {
        setSelectedConversationId(null)
        await deleteAllConversations()

        // Show success toast
        toast.success('All conversations deleted successfully', {
          description: 'Your conversation history has been cleared.',
          duration: 4000,
        })
      } catch (error) {
        // Show error toast
        toast.error('Failed to delete conversations', {
          description: 'Please try again or restart the application.',
          duration: 5000,
        })

        throw error
      }
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
    deleteAllConversations: {
      mutate: deleteAllConversationsMutation.mutate,
      isLoading: deleteAllConversationsMutation.isPending,
      error: deleteAllConversationsMutation.error,
    },
  }
}
