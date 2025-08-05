import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAssistantResponder } from '@/hooks/use-assistant-response'
import { dbPromise, insertMessage } from '@/lib/db'
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
  const { generate } = useAssistantResponder()

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
        'SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id',
        [conversationId],
      )
    },
  })

  // -------------------------------
  // Mutation: send user message + get AI response
  // -------------------------------
  const mutation = useMutation<void, unknown, SendMessageVariables>({
    mutationFn: async ({ conversationId, content }) => {
      // Insert user message locally
      await insertMessage(conversationId, 'user', content)

      // Generate assistant reply
      const aiContent = await generate(conversationId)

      // Insert assistant message locally
      await insertMessage(conversationId, 'assistant', aiContent)
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
