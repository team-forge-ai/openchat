import type { StreamChunk } from '@/lib/mlx-server/schemas'
import type { ToolCallDelta } from '@/types/mlx-server'

export function createChunkToTextStream(options?: {
  onReasoningEvent?: (chunk: string) => void
  onToolCallDelta?: (delta: ToolCallDelta) => void
  onToolCallsFinish?: () => void
}): TransformStream<StreamChunk, string> {
  return new TransformStream<StreamChunk, string>({
    transform(chunk, controller) {
      const choice = chunk.choices[0]
      const content = choice?.delta?.content
      const reasoningEvent = choice?.reasoning_event
      const toolCallDeltas = choice?.delta?.tool_calls
      const finishReason = choice?.finish_reason

      if (content) {
        controller.enqueue(content)
      }

      if (reasoningEvent?.type === 'partial' && reasoningEvent.content) {
        options?.onReasoningEvent?.(reasoningEvent.content)
      }

      if (Array.isArray(toolCallDeltas) && toolCallDeltas.length > 0) {
        for (const delta of toolCallDeltas) {
          options?.onToolCallDelta?.(delta as unknown as ToolCallDelta)
        }
      }

      if (finishReason === 'tool_calls') {
        options?.onToolCallsFinish?.()
      }
    },
  })
}
