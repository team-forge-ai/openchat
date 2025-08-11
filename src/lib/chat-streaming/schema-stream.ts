import type { StreamChunk } from '@/lib/mlx-server/schemas'
import { StreamChunkSchema } from '@/lib/mlx-server/schemas'

export function createStreamChunkStream(): TransformStream<
  string,
  StreamChunk
> {
  return new TransformStream<string, StreamChunk>({
    transform(payload, controller) {
      if (payload === '[DONE]') {
        controller.terminate()
        return
      }
      try {
        const json: unknown = JSON.parse(payload)
        const parsed = StreamChunkSchema.safeParse(json)
        if (parsed.success) {
          controller.enqueue(parsed.data)
        }
      } catch {
        // ignore malformed json
      }
    },
  })
}
