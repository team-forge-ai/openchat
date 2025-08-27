import { getModelOrDefault } from '@/lib/db/app-settings'
import { mlcServer, type MLCStatus } from '@/lib/mlc-server'
import { modelStore, type ModelStatus } from '@/lib/model-store'

export interface ModelManagerStatus {
  /** MLX server status */
  server: MLCStatus
  /** Model store status */
  model: ModelStatus
  /** Overall initialization status */
  isInitialized: boolean
  /** Whether the system is ready for chat (server ready + model loaded) */
  isReady: boolean
  /** Combined error from server or model operations */
  error: string | null
}

/**
 * High-level service that coordinates the MLX server and model store.
 * Handles startup sequence: loads current model from settings, starts server,
 * and ensures the model is downloaded and ready.
 */
class ModelManagerService {
  private isInitialized = false
  private listeners = new Set<(status: ModelManagerStatus) => void>()
  private initializationPromise: Promise<void> | null = null

  /** Adds a status listener. Returns a disposer to unsubscribe. */
  addStatusListener(handler: (status: ModelManagerStatus) => void): () => void {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  /** Gets the current combined status */
  getStatus(): ModelManagerStatus {
    // Get current status by calling fetchStatus, but don't await it
    // We'll use the cached status from the mlcServer
    const serverStatus: MLCStatus = {
      isReady: mlcServer.isReady,
      port: mlcServer.endpoint
        ? Number(new URL(mlcServer.endpoint).port)
        : undefined,
      error: null, // MLCServer doesn't expose current error directly
    }
    const modelStatus = modelStore.getStatus()

    return {
      server: serverStatus,
      model: modelStatus,
      isInitialized: this.isInitialized,
      isReady: Boolean(
        serverStatus.isReady &&
          modelStatus.currentModel &&
          !modelStatus.isLoading &&
          !modelStatus.error,
      ),
      error: modelStatus.error,
    }
  }

  /**
   * Initializes the model manager by:
   * 1. Setting up event listeners
   * 2. Loading current model from settings
   * 3. Starting the MLX server
   * 4. Downloading/loading the model if one is configured
   *
   * If already initializing, returns the existing promise.
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return await this.initializationPromise
    }

    if (this.isInitialized) {
      return await Promise.resolve()
    }

    this.initializationPromise = this.performInitialization()

    try {
      return await this.initializationPromise
    } finally {
      this.initializationPromise = null
    }
  }

  private async performInitialization(): Promise<void> {
    try {
      // 1. Initialize event listeners for both services
      await Promise.all([
        mlcServer.initializeEventListeners(),
        modelStore.initializeEventListeners(),
      ])

      // 2. Set up status change listeners to notify our own listeners
      mlcServer.addStatusListener(() => this.notifyListeners())
      modelStore.addStatusListener(() => this.notifyListeners())

      // 3. Start the MLX server and load current model in parallel
      const [, currentModel] = await Promise.all([
        mlcServer.start(),
        getModelOrDefault(),
      ])

      // 4. If there's a configured model, load it
      // Don't await this - let it load in background
      // The UI can show loading state via the model store status
      void modelStore.loadModel(currentModel).catch((error) => {
        console.error(
          `[ModelManager] Failed to load model ${currentModel}:`,
          error,
        )
      })

      this.isInitialized = true
      this.notifyListeners()
    } catch (error) {
      console.error('[ModelManager] Initialization failed:', error)
      this.notifyListeners()
      throw error
    }
  }

  /**
   * Switches to a new model by updating settings and loading it.
   * This does not update the database - that should be done separately
   * via the settings hooks.
   */
  async switchModel(repoId: string): Promise<void> {
    return await modelStore.loadModel(repoId)
  }

  /**
   * Restarts the MLX server. Useful for recovering from server errors.
   */
  async restartServer(): Promise<void> {
    await mlcServer.restart()
  }

  /**
   * Returns a promise that resolves when the system is fully ready
   * (server running + model loaded).
   */
  get waitForReady(): Promise<ModelManagerStatus> {
    const currentStatus = this.getStatus()
    if (currentStatus.isReady) {
      return Promise.resolve(currentStatus)
    }

    return new Promise<ModelManagerStatus>((resolve) => {
      let done = false
      const unlisten = this.addStatusListener((status) => {
        if (!done && status.isReady) {
          done = true
          unlisten()
          resolve(status)
        }
      })
    })
  }

  /** True when both server and model are ready */
  get isReady(): boolean {
    return this.getStatus().isReady
  }

  /** Returns the MLX client if ready, throws if not */
  get client() {
    if (!this.isReady) {
      throw new Error(
        'Model manager is not ready. Server or model not available.',
      )
    }
    return mlcServer.client
  }

  private notifyListeners(): void {
    const status = this.getStatus()
    for (const handler of this.listeners) {
      handler(status)
    }
  }

  /** Cleanup method for disposing all listeners */
  async dispose(): Promise<void> {
    await Promise.all([
      modelStore.dispose(),
      // mlcServer doesn't have a dispose method, but we could add cleanup here if needed
    ])
    this.listeners.clear()
    this.isInitialized = false
  }
}

/** Singleton service entry point for coordinating MLX server and model management. */
export const modelManager = new ModelManagerService()
