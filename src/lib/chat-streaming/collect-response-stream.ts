type Promisable<T> = T | Promise<T>

export class CollectResponseStream extends TransformStream<string, string> {
  constructor({
    onComplete,
  }: {
    onComplete?: (result: string) => Promisable<void>
  }) {
    let result = ''

    super({
      start: () => {
        result = ''
      },
      transform: (chunk: string, controller) => {
        result += chunk
        controller.enqueue(chunk)
      },
      flush: async () => {
        await onComplete?.(result)
      },
    })
  }
}
