import { useRef } from 'react'

import { getSystemPrompt } from '@/lib/db/app-settings'
import { getMessagesForChat } from '@/lib/db/messages'
import { mlxServer } from '@/lib/mlx-server'
import { StreamChunkSchema } from '@/lib/mlx-server-schemas'
import { DEFAULT_SETTINGS_PROMPT, SYSTEM_PROMPT } from '@/lib/prompt'
import type { ChatMessage } from '@/types/mlx-server'

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
  const activeReaderRef =
    useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const abortRequestedRef = useRef<boolean>(false)

  const abortStreaming = (): void => {
    abortRequestedRef.current = true
    if (activeReaderRef.current) {
      try {
        void activeReaderRef.current.cancel()
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
    abortRequestedRef.current = false
    const chatMessages = await buildChatMessages(conversationId)
    let fullContent = ''
    let fullReasoning = ''

    try {
      // Make streaming request to MLX server
      const response = await mlxServer.chatCompletionRequest(chatMessages, {
        stream: true, // Enable streaming
      })

      if (!response.ok) {
        throw new Error(`MLX server request failed: ${response.statusText}`)
      }

      // Read the streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body from MLX server')
      }

      activeReaderRef.current = reader

      while (true) {
        if (abortRequestedRef.current) {
          try {
            await reader.cancel()
          } catch {
            // ignore
          }
          throw new Error('aborted')
        }

        const { done, value } = await reader.read()
        if (done) {
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.trim() === '') {
            continue
          }
          if (line.startsWith('data: ')) {
            const data = line.slice(6) // Remove 'data: ' prefix
            if (data === '[DONE]') {
              options.onComplete?.(fullContent, fullReasoning || undefined)
              break
            }

            try {
              const jsonData: unknown = JSON.parse(data)
              const parseResult = StreamChunkSchema.safeParse(jsonData)

              if (!parseResult.success) {
                console.error(
                  'Invalid streaming chunk format:',
                  parseResult.error,
                )
                continue
              }

              const choice = parseResult.data.choices[0]
              const content = choice?.delta?.content
              const reasoningEvent = choice?.reasoning_event

              if (content) {
                fullContent += content
                options.onChunk?.(content)
              }

              if (reasoningEvent) {
                if (
                  reasoningEvent.type === 'partial' &&
                  reasoningEvent.content
                ) {
                  fullReasoning += reasoningEvent.content
                  options.onReasoningChunk?.(reasoningEvent.content)
                }
              }
            } catch (e) {
              console.error('Failed to parse streaming chunk:', e)
            }
          }
        }
      }

      return fullContent
    } catch (error) {
      console.error('Failed to generate streaming response:', error)

      // Call error callback
      if (error instanceof Error) {
        options.onError?.(error)
      }

      // Fallback message if MLX server fails
      if (error instanceof Error && error.message.includes('not running')) {
        throw new Error(
          'AI is not running. Please wait for it to start or restart the application.',
        )
      }

      throw error
    } finally {
      activeReaderRef.current = null
      abortRequestedRef.current = false
    }
  }

  return { generateStreaming, abortStreaming }
}
