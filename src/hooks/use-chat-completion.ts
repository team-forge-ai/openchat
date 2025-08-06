import { dbPromise } from '@/lib/db'
import { mlxServer } from '@/lib/mlx-server'
import type { ChatCompletionResponse } from '@/lib/mlx-server-schemas'
import {
  ChatCompletionResponseSchema,
  StreamChunkSchema,
} from '@/lib/mlx-server-schemas'
import type { Message } from '@/types'
import type { ChatMessage } from '@/types/mlx-server'

interface StreamingOptions {
  onChunk?: (chunk: string) => void
  onReasoningChunk?: (chunk: string) => void
  onComplete?: (fullContent: string, reasoning?: string) => void
  onError?: (error: Error) => void
}

interface UseChatCompletion {
  generate: (conversationId: number) => Promise<ChatCompletionResponse>
  generateStreaming: (
    conversationId: number,
    options: StreamingOptions,
  ) => Promise<string>
}

export function useChatCompletion(): UseChatCompletion {
  const buildChatMessages = async (
    conversationId: number,
  ): Promise<ChatMessage[]> => {
    // Build ordered context from database
    const db = await dbPromise
    const messages = await db.select<Message[]>(
      'SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id',
      [conversationId],
    )

    // Convert database messages to MLX server format
    const chatMessages: ChatMessage[] = messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }))

    // Add system prompt if no messages yet or first message isn't system
    if (chatMessages.length === 0 || chatMessages[0].role !== 'system') {
      chatMessages.unshift({
        role: 'system',
        content:
          'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.',
      })
    }

    return chatMessages
  }

  const generate = async (
    conversationId: number,
  ): Promise<ChatCompletionResponse> => {
    const chatMessages = await buildChatMessages(conversationId)

    try {
      // Make request to MLX server
      const response = await mlxServer.chatCompletion(chatMessages, {
        maxTokens: 500,
        temperature: 0.7,
        stream: false,
      })

      if (!response.ok) {
        throw new Error(`MLX server request failed: ${response.statusText}`)
      }

      const jsonData: unknown = await response.json()
      const parseResult = ChatCompletionResponseSchema.safeParse(jsonData)

      if (!parseResult.success) {
        console.error('Invalid response format:', parseResult.error)
        throw new Error('Invalid response format from MLX server')
      }

      return parseResult.data
    } catch (error) {
      console.error('Failed to generate assistant response:', error)

      // Fallback message if MLX server fails
      if (error instanceof Error && error.message.includes('not running')) {
        throw new Error(
          'AI server is not running. Please wait for it to start or restart the application.',
        )
      }

      throw error
    }
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
      const response = await mlxServer.chatCompletion(chatMessages, {
        maxTokens: 500,
        temperature: 0.7,
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

      while (true) {
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

              const content = parseResult.data.choices[0]?.delta?.content
              const reasoning = parseResult.data.choices[0]?.delta?.reasoning

              if (content) {
                fullContent += content
                options.onChunk?.(content)
              }

              if (reasoning) {
                fullReasoning += reasoning
                options.onReasoningChunk?.(reasoning)
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
          'AI server is not running. Please wait for it to start or restart the application.',
        )
      }

      throw error
    }
  }

  return { generate, generateStreaming }
}
