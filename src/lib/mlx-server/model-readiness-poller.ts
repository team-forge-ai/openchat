/**
 * Manages model readiness polling with proper cleanup
 */
export class ModelReadinessPoller {
  private timer: number | null = null
  private isRunning = false

  start(checkFn: () => Promise<boolean>, intervalMs = 2000): void {
    if (this.isRunning) {
      return
    }

    this.isRunning = true

    void this.performCheck(checkFn)

    this.timer = window.setInterval(async () => {
      const success = await this.performCheck(checkFn)
      if (success) {
        this.stop()
      }
    }, intervalMs)
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.isRunning = false
  }

  cleanup(): void {
    this.stop()
  }

  private async performCheck(
    checkFn: () => Promise<boolean>,
  ): Promise<boolean> {
    try {
      return await checkFn()
    } catch (error) {
      console.warn('Model readiness check failed:', error)
      return false
    }
  }
}
