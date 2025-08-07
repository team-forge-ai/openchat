import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useChatCompletion } from '@/hooks/use-chat-completion'
import { getMessages, insertMessage, updateMessage } from '@/lib/db'
import type { Message } from '@/types'

interface SendMessageVariables {
  conversationId: number
  content: string
}

interface UseMessagesResult {
  messages: Message[]
  /** Loading state for the initial/refresh fetch of messages */
  isLoading: boolean
  /** Call to send a user message and handle AI response */
  sendMessage: (vars: SendMessageVariables) => Promise<void>
  /** Loading state while a message/response round-trip is in flight */
  isSendingMessage: boolean
}

export function useMessages(conversationId: number | null): UseMessagesResult {
  const queryClient = useQueryClient()
  const { generateStreaming } = useChatCompletion()

  // -------------------------------
  // Fetch messages for the selected conversation
  // -------------------------------
  const { data: messages = [], isFetching: isLoadingMessages } = useQuery<
    Message[]
  >({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    queryFn: () => getMessages(conversationId!),
  })

  // -------------------------------
  // Mutation: send user message + get AI response with streaming
  // -------------------------------
  const mutation = useMutation<void, unknown, SendMessageVariables>({
    mutationFn: async ({ conversationId, content }) => {
      const invalidateConverationQuery = async () => {
        await queryClient.invalidateQueries({
          queryKey: ['messages', conversationId],
        })
      }

      // Insert user message locally
      await insertMessage(conversationId, 'user', content)
      await invalidateConverationQuery()

      // Track the accumulated content for database updates
      let accumulatedContent = ''
      let accumulatedReasoning = ''
      let assistantMessageId: number | null = null

      // Generate assistant reply with streaming
      await generateStreaming(conversationId, {
        onChunk: async (chunk) => {
          // Accumulate content
          accumulatedContent += chunk

          // Insert message to database on first chunk, update on subsequent chunks
          if (assistantMessageId === null) {
            assistantMessageId = await insertMessage(
              conversationId,
              'assistant',
              accumulatedContent,
              accumulatedReasoning || undefined,
            )
          } else {
            await updateMessage(
              assistantMessageId,
              accumulatedContent,
              accumulatedReasoning || undefined,
            )
          }

          // Invalidate React Query cache to refresh UI from database
          void invalidateConverationQuery()
        },
        onReasoningChunk: async (chunk) => {
          // Accumulate reasoning
          accumulatedReasoning += chunk

          // Insert message to database on first reasoning chunk, update on subsequent chunks
          if (assistantMessageId === null) {
            assistantMessageId = await insertMessage(
              conversationId,
              'assistant',
              accumulatedContent,
              accumulatedReasoning,
            )
          } else {
            await updateMessage(
              assistantMessageId,
              accumulatedContent,
              accumulatedReasoning,
            )
          }

          // Invalidate React Query cache to refresh UI from database
          void invalidateConverationQuery()
        },
        onComplete: async (fullContent, fullReasoning) => {
          console.log('[use-messages] onComplete', {
            fullReasoning,
            fullContent,
          })

          // Final update to ensure the message is complete in database
          if (assistantMessageId !== null) {
            await updateMessage(assistantMessageId, fullContent, fullReasoning)
          }
        },
        onError: (error) => {
          console.error('Streaming error:', error)

          // If we created a message but got an error, we could optionally delete it
          // For now, we'll leave partial messages in the database
          // TODO: Consider if we want to delete incomplete messages on error
        },
      })
    },
    onSuccess: async (_data, variables) => {
      // Refresh caches when the round-trip completes
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['messages', variables.conversationId],
        }),
        queryClient.invalidateQueries({ queryKey: ['conversations'] }),
      ])
    },
  })

  return {
    messages,
    isLoading: isLoadingMessages,
    sendMessage: mutation.mutateAsync,
    isSendingMessage: mutation.isPending,
  }
}
