export function createSSEPayloadStream(): TransformStream<string, string> {
  let buffer = ''
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (line.length === 0) {
          continue
        }
        if (!line.startsWith('data:')) {
          continue
        }
        let payload = line.slice(5)
        if (payload.startsWith(' ')) {
          payload = payload.slice(1)
        }
        controller.enqueue(payload)
        if (payload === '[DONE]') {
          controller.terminate()
          return
        }
      }
    },
    flush(controller) {
      const pending = buffer.trim()
      if (pending.startsWith('data:')) {
        let payload = pending.slice(5)
        if (payload.startsWith(' ')) {
          payload = payload.slice(1)
        }
        controller.enqueue(payload)
      }
    },
  })
}
