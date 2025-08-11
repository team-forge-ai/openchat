import { createChunkToTextStream } from '@/lib/chat-streaming/chunk-to-text-stream'
import { CollectResponseStream } from '@/lib/chat-streaming/collect-response-stream'
import { createStreamChunkStream } from '@/lib/chat-streaming/schema-stream'
import { createSSEPayloadStream } from '@/lib/chat-streaming/sse-stream'
import { createVisibleTextStream } from '@/lib/chat-streaming/visible-text-stream'
import { getSystemPrompt } from '@/lib/db/app-settings'
import { getMessagesForChat } from '@/lib/db/messages'
import { mlxServer } from '@/lib/mlx-server'
import { DEFAULT_SETTINGS_PROMPT, SYSTEM_PROMPT } from '@/lib/prompt'
import type { ChatMessage, ToolCallDelta } from '@/types/mlx-server'

export interface StreamingOptions {
  onChunk?: (chunk: string) => void
  onReasoningChunk?: (chunk: string) => void
  onToolCallDelta?: (delta: ToolCallDelta) => void
  onToolCallsFinish?: () => void
  onComplete?: (fullContent: string, reasoning?: string) => void
  onError?: (error: Error) => void
}

/**
 * Builds a chat messages array for the given conversation, ensuring a system prompt is present.
 *
 * @param conversationId - The ID of the conversation to build messages for
 * @returns A promise that resolves to an array of ChatMessage objects
 */
async function buildChatMessages(
  conversationId: number,
): Promise<ChatMessage[]> {
  const messages = await getMessagesForChat(conversationId)

  const chatMessages: ChatMessage[] = messages.map((msg) => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: msg.content,
  }))

  if (chatMessages.length === 0 || chatMessages[0].role !== 'system') {
    const settingsPrompt = (await getSystemPrompt()) || DEFAULT_SETTINGS_PROMPT
    const systemPrompt: ChatMessage = {
      role: 'system',
      content: [SYSTEM_PROMPT, settingsPrompt].join('\n'),
    }
    chatMessages.unshift(systemPrompt)
  }

  return chatMessages
}

/**
 * Generates a streaming chat completion for the given conversation.
 *
 * This function:
 * 1. Builds the chat messages array with system prompts
 * 2. Makes a streaming request to the MLX server
 * 3. Processes the response through multiple transform streams
 * 4. Handles reasoning events, tool calls, and visible text chunks
 * 5. Invokes callbacks for real-time updates during streaming
 *
 * @param conversationId - The ID of the conversation to generate completion for
 * @param options - Streaming options with callbacks for chunk handling
 * @param signal - AbortSignal to cancel the request
 * @returns Promise that resolves to the complete response content
 * @throws Error if the MLX server request fails or response processing fails
 */
export async function generateStreamingChatCompletion(
  conversationId: number,
  options: StreamingOptions,
  signal: AbortSignal,
): Promise<string> {
  const chatMessages = await buildChatMessages(conversationId)

  let fullContent = ''
  let fullReasoning = ''

  try {
    const response = await mlxServer.chatCompletionRequest(chatMessages, {
      stream: true,
      signal,
    })

    if (!response.ok) {
      throw new Error(`MLX server request failed: ${response.statusText}`)
    }

    const body = response.body
    if (!body) {
      throw new Error('No response body from MLX server')
    }

    const textStream = body.pipeThrough(new TextDecoderStream())
    const sseStream = textStream.pipeThrough(createSSEPayloadStream())
    const schemaStream = sseStream.pipeThrough(createStreamChunkStream())
    const textDeltaStream = schemaStream.pipeThrough(
      createChunkToTextStream({
        onReasoningEvent: (delta) => {
          fullReasoning += delta
          options.onReasoningChunk?.(delta)
        },
        onToolCallDelta: (delta: ToolCallDelta) => {
          options.onToolCallDelta?.(delta)
        },
        onToolCallsFinish: () => {
          options.onToolCallsFinish?.()
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
      .pipeTo(new WritableStream(), { signal })

    return fullContent
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return fullContent
    }
    if (error instanceof Error) {
      options.onError?.(error)
      if (error.message.includes('not running')) {
        throw new Error(
          'AI is not running. Please wait for it to start or restart the application.',
        )
      }
    }
    throw error
  }
}
