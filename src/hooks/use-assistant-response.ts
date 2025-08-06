import { dbPromise } from '@/lib/db'
import { mlxServer } from '@/lib/mlx-server'
import type { Message } from '@/types'
import type { ChatCompletionResponse, ChatMessage } from '@/types/mlx-server'

interface UseAssistantResponder {
  generate: (conversationId: number) => Promise<string>
}

export function useAssistantResponder(): UseAssistantResponder {
  const generate = async (conversationId: number): Promise<string> => {
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

      const data = (await response.json()) as ChatCompletionResponse
      const assistantMessage = data.choices[0]?.message?.content

      if (!assistantMessage) {
        throw new Error('No response from MLX server')
      }

      return assistantMessage
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

  return { generate }
}
