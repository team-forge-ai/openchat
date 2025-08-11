import type { MLXServerStatus } from '@/types/mlx-server'

/**
 * Centralized status management with immutable updates and listener notifications
 */
export class MLXStatusManager {
  private status: MLXServerStatus
  private listeners = new Set<(status: MLXServerStatus) => void>()

  constructor(initialStatus?: Partial<MLXServerStatus>) {
    this.status = {
      isRunning: false,
      isHttpReady: false,
      isModelReady: false,
      port: undefined,
      pid: null,
      ...initialStatus,
    }
  }

  getStatus(): MLXServerStatus {
    return { ...this.status }
  }

  updateStatus(partial: Partial<MLXServerStatus>): MLXServerStatus {
    const prevStatus = this.status
    this.status = { ...prevStatus, ...partial }

    if (this.hasStatusChanged(prevStatus, this.status)) {
      const snapshot = this.getStatus()
      this.listeners.forEach((listener) => listener(snapshot))
    }

    return this.getStatus()
  }

  addListener(listener: (status: MLXServerStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  clearListeners(): void {
    this.listeners.clear()
  }

  private hasStatusChanged(
    prev: MLXServerStatus,
    next: MLXServerStatus,
  ): boolean {
    return (
      prev.isRunning !== next.isRunning ||
      prev.isHttpReady !== next.isHttpReady ||
      prev.isModelReady !== next.isModelReady ||
      prev.port !== next.port ||
      prev.pid !== next.pid
    )
  }
}
