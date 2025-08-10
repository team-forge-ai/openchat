import type { StreamChunk } from '@/lib/mlx-server-schemas'

export function createChunkToTextStream(options?: {
  onReasoningEvent?: (chunk: string) => void
}): TransformStream<StreamChunk, string> {
  return new TransformStream<StreamChunk, string>({
    transform(chunk, controller) {
      const choice = chunk.choices[0]
      const content = choice?.delta?.content
      const reasoningEvent = choice?.reasoning_event

      if (content) {
        controller.enqueue(content)
      }

      if (reasoningEvent?.type === 'partial' && reasoningEvent.content) {
        options?.onReasoningEvent?.(reasoningEvent.content)
      }
    },
  })
}
