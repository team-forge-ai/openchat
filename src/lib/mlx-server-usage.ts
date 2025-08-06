// Example usage of the MLX Server service
// This file demonstrates how to integrate the MLX server with your app

import { mlxServer } from './mlx-server'

// Example: Start the MLX server on app initialization
export async function initializeMLXServer(modelPath: string) {
  try {
    await mlxServer.start({
      modelPath,
      port: 8000,
      host: '127.0.0.1',
      logLevel: 'INFO',
      maxTokens: 150,
      temperature: 0.7,
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
export async function sendChatMessage(message: string) {
  try {
    const response = await mlxServer.chatCompletion(
      [{ role: 'user', content: message }],
      {
        maxTokens: 150,
        temperature: 0.7,
        stream: false,
      },
    )

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || 'No response'
  } catch (error) {
    console.error('Chat completion error:', error)
    throw error
  }
}

// Example: Stream chat completion
export async function streamChatMessage(
  message: string,
  onToken: (token: string) => void,
) {
  try {
    const response = await mlxServer.chatCompletion(
      [{ role: 'user', content: message }],
      {
        maxTokens: 150,
        temperature: 0.7,
        stream: true,
      },
    )

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            return
          }

          try {
            const parsed = JSON.parse(data)
            const token = parsed.choices[0]?.delta?.content
            if (token) {
              onToken(token)
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } catch (error) {
    console.error('Stream chat completion error:', error)
    throw error
  }
}

// Example: Graceful shutdown
export async function shutdownMLXServer() {
  try {
    await mlxServer.stop()
    console.log('MLX server stopped successfully')
  } catch (error) {
    console.error('Failed to stop MLX server:', error)
  }
}

// Example: Health check with retry
export async function waitForMLXServer(maxRetries: number = 10) {
  for (let i = 0; i < maxRetries; i++) {
    if (await mlxServer.healthCheck()) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return false
}
