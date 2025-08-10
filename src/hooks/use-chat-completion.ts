import { useRef } from 'react'

import { createChunkToTextStream } from '@/lib/chat-streaming/chunk-to-text-stream'
import { CollectResponseStream } from '@/lib/chat-streaming/collect-response-stream'
import { createStreamChunkStream } from '@/lib/chat-streaming/schema-stream'
import { createSSEPayloadStream } from '@/lib/chat-streaming/sse-stream'
import { createVisibleTextStream } from '@/lib/chat-streaming/visible-text-stream'
import { getSystemPrompt } from '@/lib/db/app-settings'
import { getMessagesForChat } from '@/lib/db/messages'
import { mlxServer } from '@/lib/mlx-server'
import { DEFAULT_SETTINGS_PROMPT, SYSTEM_PROMPT } from '@/lib/prompt'
import type { ChatMessage } from '@/types/mlx-server'
//

interface StreamingOptions {
  onChunk?: (chunk: string) => void
  onReasoningChunk?: (chunk: string) => void
  onComplete?: (fullContent: string, reasoning?: string) => void
  onError?: (error: Error) => void
}

interface UseChatCompletion {
  generateStreaming: (
    conversationId: number,
    options: StreamingOptions,
  ) => Promise<string>
  abortStreaming: () => void
}

export function useChatCompletion(): UseChatCompletion {
  const abortControllerRef = useRef<AbortController | null>(null)

  const abortStreaming = (): void => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch {
        // ignore
      }
    }
  }
  const buildChatMessages = async (
    conversationId: number,
  ): Promise<ChatMessage[]> => {
    // Build ordered context from database
    const messages = await getMessagesForChat(conversationId)

    // Convert database messages to MLX server format
    const chatMessages: ChatMessage[] = messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }))

    // Add system prompt if no messages yet or first message isn't system
    if (chatMessages.length === 0 || chatMessages[0].role !== 'system') {
      const settingsPrompt =
        (await getSystemPrompt()) || DEFAULT_SETTINGS_PROMPT
      const systemPrompt: ChatMessage = {
        role: 'system',
        content: [SYSTEM_PROMPT, settingsPrompt].join('\n'),
      }

      chatMessages.unshift(systemPrompt)
    }

    return chatMessages
  }

  const generateStreaming = async (
    conversationId: number,
    options: StreamingOptions,
  ): Promise<string> => {
    const chatMessages = await buildChatMessages(conversationId)

    let fullContent = ''
    let fullReasoning = ''

    try {
      // Make streaming request to MLX server
      const response = await mlxServer.chatCompletionRequest(chatMessages, {
        stream: true,
      })

      if (!response.ok) {
        throw new Error(`MLX server request failed: ${response.statusText}`)
      }

      const body = response.body
      if (!body) {
        throw new Error('No response body from MLX server')
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const textStream = body.pipeThrough(new TextDecoderStream())
      const sseStream = textStream.pipeThrough(createSSEPayloadStream())
      const schemaStream = sseStream.pipeThrough(createStreamChunkStream())
      const textDeltaStream = schemaStream.pipeThrough(
        createChunkToTextStream({
          onReasoningEvent: (delta) => {
            fullReasoning += delta
            options.onReasoningChunk?.(delta)
          },
        }),
      )
      const visibleTextStream = textDeltaStream.pipeThrough(
        createVisibleTextStream({
          onChunk: (delta) => {
            fullContent += delta
            options.onChunk?.(delta)
          },
          onReasoningChunk: (delta) => {
            fullReasoning += delta
            options.onReasoningChunk?.(delta)
          },
          onFlush: (content, reasoning) => {
            fullContent = content
            fullReasoning = reasoning
          },
        }),
      )
      await visibleTextStream
        .pipeThrough(
          new CollectResponseStream({
            onComplete: (result) => {
              options.onComplete?.(result, fullReasoning || undefined)
            },
          }),
        )
        .pipeTo(new WritableStream(), { signal: abortController.signal })

      return fullContent
    } catch (error) {
      // Suppress error callback on intentional aborts
      if (error instanceof DOMException && error.name === 'AbortError') {
        return fullContent
      }
      console.error('Failed to generate streaming response:', error)
      if (error instanceof Error) {
        options.onError?.(error)
      }
      if (error instanceof Error && error.message.includes('not running')) {
        throw new Error(
          'AI is not running. Please wait for it to start or restart the application.',
        )
      }
      throw error
    } finally {
      // no-op
    }
  }

  return { generateStreaming, abortStreaming }
}
