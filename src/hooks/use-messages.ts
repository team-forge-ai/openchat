import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useChatCompletion } from '@/hooks/use-chat-completion'
import { getMessages, insertMessage } from '@/lib/db'
import type { Message } from '@/types'

import { useUniqueId } from './use-unique-id'

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
  const uniqueId = useUniqueId()
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
      // Insert user message locally
      await insertMessage(conversationId, 'user', content)

      // Track the accumulated content for optimistic updates
      let accumulatedContent = ''
      let accumulatedReasoning = ''
      let tempMessageId = uniqueId() // Temporary ID for optimistic updates

      const setQueryData = (callback: (data: Message[]) => Message[]) => {
        queryClient.setQueryData<Message[]>(
          ['messages', conversationId],
          (oldMessages) => {
            return callback(oldMessages ?? [])
          },
        )
      }

      // Add temporary assistant message to cache for UI
      setQueryData((oldMessages) => {
        return [
          ...oldMessages,
          {
            id: tempMessageId,
            conversation_id: conversationId,
            role: 'assistant',
            content: '',
            reasoning: undefined,
            created_at: new Date().toISOString(),
          },
        ]
      })

      // Generate assistant reply with streaming
      await generateStreaming(conversationId, {
        onChunk: (chunk) => {
          console.log('[use-messages] onChunk', chunk)

          // Accumulate content
          accumulatedContent += chunk

          // Optimistically update the message in the cache
          setQueryData((oldMessages) => {
            if (!oldMessages) {
              return oldMessages
            }

            return oldMessages.map((msg) => {
              if (msg.id === tempMessageId) {
                return {
                  ...msg,
                  content: accumulatedContent,
                  reasoning: accumulatedReasoning || undefined,
                }
              }
              return msg
            })
          })
        },
        onReasoningChunk: (chunk) => {
          console.log('[use-messages] onReasoningChunk', chunk)

          // Accumulate reasoning
          accumulatedReasoning += chunk

          // Optimistically update the message reasoning in the cache
          setQueryData((oldMessages) => {
            if (!oldMessages) {
              return oldMessages
            }

            return oldMessages.map((msg) => {
              if (msg.id === tempMessageId) {
                return {
                  ...msg,
                  content: accumulatedContent,
                  reasoning: accumulatedReasoning,
                }
              }
              return msg
            })
          })
        },
        onComplete: async (fullContent, fullReasoning) => {
          console.log('[use-messages] onComplete', {
            fullReasoning,
            fullContent,
          })

          // Now insert the complete assistant message into the database
          await insertMessage(
            conversationId,
            'assistant',
            fullContent,
            fullReasoning,
          )
        },
        onError: (error) => {
          console.error('Streaming error:', error)

          // Remove the temporary message from cache on error
          setQueryData((oldMessages) => {
            if (!oldMessages) {
              return oldMessages
            }
            return oldMessages.filter((msg) => msg.id !== tempMessageId)
          })
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
