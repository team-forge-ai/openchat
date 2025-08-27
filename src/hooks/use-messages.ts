import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ModelMessage } from 'ai'
import { stepCountIs, streamText } from 'ai'
import { useRef } from 'react'

import { useMcp } from '@/hooks/use-mcp'
import { useModel } from '@/hooks/use-model'
import { getSystemPrompt } from '@/lib/db/app-settings'
import { touchConversation } from '@/lib/db/conversations'
import {
  getMessages,
  getMessagesForChat,
  insertMessage,
  updateMessage,
} from '@/lib/db/messages'
import { createMcpToolsMap } from '@/lib/mcp-tools'
import { createMlcClient } from '@/lib/mlc-client'
import { mlcServer } from '@/lib/mlc-server'
import { DEFAULT_SETTINGS_PROMPT, SYSTEM_PROMPT } from '@/lib/prompt'
import { setConversationTitleIfUnset } from '@/lib/set-conversation-title'
import type { Message } from '@/types'

interface SendMessageVariables {
  conversationId: number
  content: string
}

interface UseMessagesOptions {
  /** Optional model ID to use. If not provided, uses the app setting or 'default' */
  modelId?: string
}

interface UseMessagesResult {
  messages: Message[]
  /** Loading state for the initial/refresh fetch of messages */
  isLoading: boolean
  /** Call to send a user message and handle AI response */
  sendMessage: (vars: SendMessageVariables) => Promise<void>
  /** Loading state while a message/response round-trip is in flight */
  isSendingMessage: boolean
  /** Abort the in-flight streaming response, if any */
  abortStreaming: () => void
}

/**
 * useMessages
 *
 * Provides conversation messages, and a `sendMessage` mutation that inserts the
 * user message, streams the assistant response (including reasoning, when
 * available), writes updates to the DB incrementally, and finalizes the record
 * upon completion. Also exposes `abortStreaming` to cancel an in-flight stream.
 *
 * @param conversationId The active conversation ID, or null to disable.
 * @param options Optional configuration including model override.
 * @returns `{ messages, isLoading, sendMessage, isSendingMessage, abortStreaming }`.
 */
export function useMessages(
  conversationId: number | null,
  options: UseMessagesOptions = {},
): UseMessagesResult {
  const queryClient = useQueryClient()
  const abortControllerRef = useRef<AbortController | null>(null)
  const { toolsByServer, call } = useMcp()
  const { modelId: defaultModelId } = useModel()

  // Use provided model or fall back to app setting
  const modelId = options.modelId || defaultModelId

  const abortStreaming = (): void => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch {
        // ignore
      }
    }
  }

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

      // Insert user message locally (complete by default)
      await insertMessage({
        conversation_id: conversationId,
        role: 'user',
        content,
        reasoning: null,
        status: 'complete',
      })
      await invalidateConverationQuery()

      // Name setting moved to shared utility and invoked after streaming completes

      // Track the accumulated content for database updates
      let accumulatedContent = ''
      let accumulatedReasoning = ''
      let assistantMessageId: number | null = null

      // Generate assistant reply with streaming via AI SDK
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Build chat messages with system prompt
      const chatMessages: ModelMessage[] =
        await getMessagesForChat(conversationId)

      if (chatMessages.length === 0 || chatMessages[0].role !== 'system') {
        const settingsPrompt =
          (await getSystemPrompt()) || DEFAULT_SETTINGS_PROMPT
        chatMessages.unshift({
          role: 'system',
          content: [SYSTEM_PROMPT, settingsPrompt].join('\n'),
        })
      }

      const mcpTools = createMcpToolsMap(
        toolsByServer,
        async (serverId, toolName, args) =>
          await call.mutateAsync({ serverId, tool: toolName, args }),
      )

      console.log('[useMessages] Streaming text with options', {
        messages: chatMessages,
        abortSignal: abortController.signal,
        tools: mcpTools,
        toolChoice: 'auto',
      })

      // Insert a placeholder assistant message immediately so the UI can render
      // a skeleton while waiting for the first stream tokens.
      assistantMessageId = await insertMessage({
        conversation_id: conversationId,
        role: 'assistant',
        content: '',
        reasoning: null,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      await invalidateConverationQuery()

      // Create model instance with the configured model ID
      const endpoint = mlcServer.endpoint
      if (!endpoint) {
        throw new Error('MLC server is not ready')
      }
      const model = createMlcClient({ modelId, endpoint })

      const result = streamText({
        model,
        messages: chatMessages,
        abortSignal: abortController.signal,
        tools: mcpTools,
        toolChoice: 'auto',
        stopWhen: stepCountIs(10),
        onError: (error) => {
          console.error('[useMessages] Error streaming text', error)

          // If assistant message was created, mark it as error
          if (assistantMessageId !== null) {
            void updateMessage(assistantMessageId, {
              status: 'error',
            })
            void invalidateConverationQuery()
          }
        },
        onFinish: () => {
          console.log('[useMessages] Streaming finished')
        },
        onStepFinish: (step) => {
          console.log('[useMessages] Step finished', step)
        },
      })

      const addReasoning = async (reasoning: string) => {
        accumulatedReasoning += reasoning
        if (assistantMessageId === null) {
          assistantMessageId = await insertMessage({
            conversation_id: conversationId,
            role: 'assistant',
            content: accumulatedContent,
            reasoning: accumulatedReasoning,
            status: 'pending',
            created_at: new Date().toISOString(),
          })
        } else {
          await updateMessage(assistantMessageId, {
            content: accumulatedContent,
            reasoning: accumulatedReasoning,
          })
        }
        void invalidateConverationQuery()
      }

      const addContent = async (content: string) => {
        accumulatedContent += content
        if (assistantMessageId === null) {
          assistantMessageId = await insertMessage({
            conversation_id: conversationId,
            role: 'assistant',
            content: accumulatedContent,
            reasoning: accumulatedReasoning || null,
            status: 'pending',
            created_at: new Date().toISOString(),
          })
        } else {
          await updateMessage(assistantMessageId, {
            content: accumulatedContent,
            reasoning: accumulatedReasoning || undefined,
          })
        }
        void invalidateConverationQuery()
      }

      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'reasoning-delta':
            if (part.text) {
              await addReasoning(part.text)
            }
            break
          case 'text-delta':
            if (part.text) {
              await addContent(part.text)
            }
            break
        }
      }

      if (assistantMessageId !== null) {
        await updateMessage(assistantMessageId, {
          content: accumulatedContent,
          reasoning: accumulatedReasoning || undefined,
          status: 'complete',
        })
      }

      void touchConversation(conversationId)
      void setConversationTitleIfUnset(queryClient, conversationId)
    },
    onError: (error) => {
      console.error('[useMessages] Mutation error', error)

      // Re-throw the error with a more user-friendly message
      const isLocalServerError =
        error instanceof Error &&
        (error.message.includes('MLC server is not ready') ||
          error.message.includes('endpoint') ||
          error.message.includes('127.0.0.1') ||
          error.message.includes('localhost'))

      if (isLocalServerError) {
        throw new Error(
          'Local AI server is not ready. Please ensure the server is running.',
        )
      } else {
        throw new Error(
          'Failed to send message. This application works offline - please check your local server status.',
        )
      }
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
    abortStreaming,
  }
}
