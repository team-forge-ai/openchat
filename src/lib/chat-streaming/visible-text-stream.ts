import { ThinkSplitter } from '@/lib/chat-streaming/think'

export function createVisibleTextStream(options: {
  onChunk?: (chunk: string) => void
  onReasoningChunk?: (chunk: string) => void
  onFlush?: (content: string, reasoning: string) => void
}): TransformStream<string, string> {
  const splitter = new ThinkSplitter()
  let fullContent = ''
  let fullReasoning = ''

  return new TransformStream<string, string>({
    transform(chunk, controller) {
      const { visibleDelta, reasoningDelta } = splitter.push(chunk)
      if (visibleDelta) {
        fullContent += visibleDelta
        options.onChunk?.(visibleDelta)
        controller.enqueue(visibleDelta)
      }
      if (reasoningDelta) {
        fullReasoning += reasoningDelta
        options.onReasoningChunk?.(reasoningDelta)
      }
    },
    flush(controller) {
      const { visibleDelta, reasoningDelta } = splitter.flushRemaining()
      if (visibleDelta) {
        fullContent += visibleDelta
        options.onChunk?.(visibleDelta)
        controller.enqueue(visibleDelta)
      }
      if (reasoningDelta) {
        fullReasoning += reasoningDelta
        options.onReasoningChunk?.(reasoningDelta)
      }
      options.onFlush?.(fullContent, fullReasoning)
    },
  })
}
