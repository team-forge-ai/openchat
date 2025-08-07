import { getMessagesForChat } from '@/lib/db'
import { mlxServer } from '@/lib/mlx-server'
import { StreamChunkSchema } from '@/lib/mlx-server-schemas'
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
}

export function useChatCompletion(): UseChatCompletion {
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
      chatMessages.unshift({
        role: 'system',
        content:
          'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.',
      })
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
          'AI server is not running. Please wait for it to start or restart the application.',
        )
      }

      throw error
    }
  }

  return { generateStreaming }
}
