import { downloadModel } from './commands'

export interface ModelStatus {
  /** Currently loaded model repository ID, or null if none is loaded */
  currentModel: string | null
  /** Whether a model is currently being loaded/downloaded */
  isLoading: boolean
  /** Current error, if any */
  error: string | null
}

/**
 * Service responsible for managing the currently loaded model and handling
 * model downloads. Provides status tracking with listener-based updates.
 */
class ModelStoreService {
  private currentModel: string | null = null
  private isLoading = false
  private error: string | null = null

  private listeners = new Set<(status: ModelStatus) => void>()
  private loadingPromise: Promise<void> | null = null

  /** Initialize the service - kept for API compatibility but no longer needed */
  async initializeEventListeners(): Promise<void> {
    // No event listeners needed - we handle completion directly in performLoad
  }

  /** Adds a status listener. Returns a disposer to unsubscribe. */
  addStatusListener(handler: (status: ModelStatus) => void): () => void {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  /** Gets the current model status */
  get status(): ModelStatus {
    return {
      currentModel: this.currentModel,
      isLoading: this.isLoading,
      error: this.error,
    }
  }

  /**
   * Loads a model by downloading it if necessary.
   * If already loading, returns the existing promise.
   */
  async loadModel(repoId: string): Promise<void> {
    // If already loading, return the existing promise
    if (this.loadingPromise) {
      return await this.loadingPromise
    }

    // If this model is already loaded and not in error state, do nothing
    if (this.currentModel === repoId && !this.error) {
      return await Promise.resolve()
    }

    // Create and cache the loading promise
    this.loadingPromise = this.performLoad(repoId)

    try {
      await this.loadingPromise
    } finally {
      // Clear the promise once completed (success or failure)
      this.loadingPromise = null
    }
  }

  private async performLoad(repoId: string): Promise<void> {
    this.isLoading = true
    this.error = null
    this.notifyListeners()

    try {
      await downloadModel(repoId)

      // If we reach here, the download completed successfully
      // This handles both cached models (immediate return) and downloaded models
      this.currentModel = repoId
      this.isLoading = false
      this.error = null
    } catch (error) {
      this.isLoading = false
      this.error = error instanceof Error ? error.message : String(error)
    }

    this.notifyListeners()
  }

  /** Clears the current model state */
  clearModel(): void {
    this.currentModel = null
    this.isLoading = false
    this.error = null
    this.notifyListeners()
  }

  private notifyListeners(): void {
    const status = this.status

    for (const handler of this.listeners) {
      handler(status)
    }
  }

  /** Cleanup method for disposing listeners */
  dispose(): void {
    this.listeners.clear()
  }
}

/** Singleton service entry point for managing the current model. */
export const modelStore = new ModelStoreService()
