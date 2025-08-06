import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useChatCompletion } from '@/hooks/use-chat-completion'
import { dbPromise, insertMessage, updateMessage } from '@/lib/db'
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
    queryFn: async () => {
      const db = await dbPromise
      return await db.select<Message[]>(
        'SELECT id, conversation_id, role, content, reasoning, created_at FROM messages WHERE conversation_id = ? ORDER BY id',
        [conversationId],
      )
    },
  })

  // -------------------------------
  // Mutation: send user message + get AI response with streaming
  // -------------------------------
  const mutation = useMutation<void, unknown, SendMessageVariables>({
    mutationFn: async ({ conversationId, content }) => {
      // Insert user message locally
      await insertMessage(conversationId, 'user', content)

      // Insert empty assistant message for streaming
      const assistantMessageId = await insertMessage(
        conversationId,
        'assistant',
        '',
        undefined, // No reasoning initially
      )

      // Track the accumulated content for optimistic updates
      let accumulatedContent = ''
      let accumulatedReasoning = ''

      // Generate assistant reply with streaming
      await generateStreaming(conversationId, {
        onChunk: (chunk) => {
          console.log('[use-messages] onChunk', chunk)

          // Accumulate content
          accumulatedContent += chunk

          // Optimistically update the message in the cache
          queryClient.setQueryData<Message[]>(
            ['messages', conversationId],
            (oldMessages) => {
              if (!oldMessages) {
                return oldMessages
              }

              return oldMessages.map((msg) => {
                if (msg.id === assistantMessageId) {
                  return {
                    ...msg,
                    content: accumulatedContent,
                    reasoning: accumulatedReasoning || undefined,
                  }
                }
                return msg
              })
            },
          )
        },
        onReasoningChunk: (chunk) => {
          console.log('[use-messages] onReasoningChunk', chunk)

          // Accumulate reasoning
          accumulatedReasoning += chunk

          // Optimistically update the message reasoning in the cache
          queryClient.setQueryData<Message[]>(
            ['messages', conversationId],
            (oldMessages) => {
              if (!oldMessages) {
                return oldMessages
              }

              return oldMessages.map((msg) => {
                if (msg.id === assistantMessageId) {
                  return {
                    ...msg,
                    content: accumulatedContent,
                    reasoning: accumulatedReasoning,
                  }
                }
                return msg
              })
            },
          )
        },
        onComplete: async (fullContent, fullReasoning) => {
          console.log('[use-messages] onComplete', fullContent, fullReasoning)

          // Update the message in the database with the complete content and reasoning
          await updateMessage(assistantMessageId, fullContent, fullReasoning)
        },
        onError: (error) => {
          console.error('Streaming error:', error)
          // Could potentially update the message with an error state here
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
