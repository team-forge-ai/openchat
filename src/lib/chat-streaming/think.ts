interface ThinkSplitResult {
  visibleDelta: string
  reasoningDelta: string
}

export class ThinkSplitter {
  private buffer = ''
  private inThink = false

  push(contentDelta: string): ThinkSplitResult {
    this.buffer += contentDelta
    let visibleDelta = ''
    let reasoningDelta = ''

    // Process the buffer, switching modes on <think> and </think>
    // We keep a conservative tail to avoid splitting tags across chunk boundaries
    // Tail length equal to longest tag length
    const OPEN_TAIL = '<think>'.length
    const CLOSE_TAIL = '</think>'.length
    let i = 0

    while (i < this.buffer.length) {
      if (!this.inThink) {
        const openIdx = this.buffer.indexOf('<think>', i)
        if (openIdx === -1) {
          const end = Math.max(0, this.buffer.length - OPEN_TAIL)
          visibleDelta += this.buffer.slice(i, end)
          this.buffer = this.buffer.slice(end)
          i = 0
          break
        } else {
          visibleDelta += this.buffer.slice(i, openIdx)
          i = openIdx + '<think>'.length
          this.inThink = true
        }
      } else {
        const closeIdx = this.buffer.indexOf('</think>', i)
        if (closeIdx === -1) {
          const end = Math.max(0, this.buffer.length - CLOSE_TAIL)
          reasoningDelta += this.buffer.slice(i, end)
          this.buffer = this.buffer.slice(end)
          i = 0
          break
        } else {
          reasoningDelta += this.buffer.slice(i, closeIdx)
          i = closeIdx + '</think>'.length
          this.inThink = false
        }
      }
    }
    // Discard processed prefix when we fully consumed the buffer
    if (i > 0) {
      this.buffer = this.buffer.slice(i)
    }
    return { visibleDelta, reasoningDelta }
  }

  flushRemaining(): ThinkSplitResult {
    const remaining = this.buffer
    this.buffer = ''
    if (remaining.length === 0) {
      return { visibleDelta: '', reasoningDelta: '' }
    }
    if (this.inThink) {
      return { visibleDelta: '', reasoningDelta: remaining }
    }
    return { visibleDelta: remaining, reasoningDelta: '' }
  }
}
