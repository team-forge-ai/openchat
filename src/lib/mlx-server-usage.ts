// Example usage of the MLX Server service
// This file demonstrates how to integrate the MLX server with your app

import type {
  ChatCompletionResponse,
  ChatMessage,
  StreamChunk,
} from '@/types/mlx-server'
import { DEFAULT_CONFIG } from '@/types/mlx-server'

import { mlxServer } from './mlx-server'

// Example: Start the MLX server on app initialization
export async function initializeMLXServer(modelPath: string): Promise<boolean> {
  try {
    await mlxServer.start({
      modelPath,
      port: DEFAULT_CONFIG.PORT,
      host: DEFAULT_CONFIG.HOST,
      logLevel: DEFAULT_CONFIG.LOG_LEVEL,
      maxTokens: DEFAULT_CONFIG.MAX_TOKENS,
      temperature: DEFAULT_CONFIG.TEMPERATURE,
    })

    console.log('MLX server started successfully')

    // Verify it's running
    const status = mlxServer.getStatus()
    console.log('Server status:', status)

    return true
  } catch (error) {
    console.error('Failed to start MLX server:', error)
    return false
  }
}

// Example: Make a chat completion request
export async function sendChatMessage(message: string): Promise<string> {
  const messages: ChatMessage[] = [{ role: 'user', content: message }]

  try {
    const response = await mlxServer.chatCompletion(messages, {
      maxTokens: DEFAULT_CONFIG.MAX_TOKENS,
      temperature: DEFAULT_CONFIG.TEMPERATURE,
      stream: false,
    })

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`)
    }

    const data = (await response.json()) as ChatCompletionResponse
    return data.choices[0]?.message?.content || 'No response'
  } catch (error) {
    console.error('Chat completion error:', error)
    throw error
  }
}

// Example: Stream chat completion with proper error handling
export async function streamChatMessage(
  message: string,
  onToken: (token: string) => void,
): Promise<void> {
  const messages: ChatMessage[] = [{ role: 'user', content: message }]

  try {
    const response = await mlxServer.chatCompletion(messages, {
      maxTokens: DEFAULT_CONFIG.MAX_TOKENS,
      temperature: DEFAULT_CONFIG.TEMPERATURE,
      stream: true,
    })

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    await processStream(reader, onToken)
  } catch (error) {
    console.error('Stream chat completion error:', error)
    throw error
  }
}

/**
 * Process SSE stream from the MLX server
 */
async function processStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onToken: (token: string) => void,
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()

          if (data === '[DONE]') {
            return
          }

          try {
            const chunk = JSON.parse(data) as StreamChunk
            const token = chunk.choices[0]?.delta?.content
            if (token) {
              onToken(token)
            }
          } catch (_error) {
            // Skip invalid JSON lines - this is expected for some SSE implementations
            continue
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// Example: Graceful shutdown
export async function shutdownMLXServer(): Promise<void> {
  try {
    await mlxServer.stop()
    console.log('MLX server stopped successfully')
  } catch (error) {
    console.error('Failed to stop MLX server:', error)
  }
}

// Example: Health check with retry
export async function waitForMLXServer(
  maxRetries: number = 10,
  retryDelay: number = 1000,
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (await mlxServer.healthCheck()) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay))
  }
  return false
}

// Example: Get available models
export async function getAvailableModels(): Promise<string[]> {
  try {
    const modelsResponse = await mlxServer.getModels()
    return modelsResponse.data.map((model) => model.id)
  } catch (error) {
    console.error('Failed to get models:', error)
    return []
  }
}

// Example: Send multiple messages in a conversation
export async function sendConversation(
  messages: ChatMessage[],
): Promise<string> {
  try {
    const response = await mlxServer.chatCompletion(messages, {
      maxTokens: DEFAULT_CONFIG.MAX_TOKENS,
      temperature: DEFAULT_CONFIG.TEMPERATURE,
      stream: false,
    })

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`)
    }

    const data = (await response.json()) as ChatCompletionResponse
    return data.choices[0]?.message?.content || 'No response'
  } catch (error) {
    console.error('Conversation error:', error)
    throw error
  }
}
