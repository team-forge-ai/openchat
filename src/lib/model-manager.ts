import { generateText } from 'ai'

import { getModelOrDefault } from '@/lib/db/app-settings'
import { mlcServer, type MlcServerStatus } from '@/lib/mlc-server'
import { modelStore, type ModelStatus } from '@/lib/model-store'

import { createMlcClient } from './mlc-client'

export interface ModelManagerStatus {
  /** MLX server status */
  server: MlcServerStatus
  /** Model store status */
  model: ModelStatus
  /** Overall initialization status */
  isInitialized: boolean
  /** Whether the model has been tested and can receive messages */
  isModelTested: boolean
  /** Whether the system is ready for chat (server ready + model loaded + tested) */
  isReady: boolean
  /** Combined error from server or model operations */
  error: string | null
  /** Error from model testing, if any */
  testError: string | null
}

/**
 * High-level service that coordinates the MLX server and model store.
 * Handles startup sequence: loads current model from settings, starts server,
 * and ensures the model is downloaded and ready.
 */
class ModelManagerService {
  private isInitialized = false
  private isModelTested = false
  private testError: string | null = null
  private listeners = new Set<(status: ModelManagerStatus) => void>()
  private initializationPromise: Promise<void> | null = null

  /** Adds a status listener. Returns a disposer to unsubscribe. */
  addStatusListener(handler: (status: ModelManagerStatus) => void): () => void {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  /** Gets the current combined status */
  getStatus(): ModelManagerStatus {
    const serverStatus = mlcServer.status
    const modelStatus = modelStore.status

    return {
      server: serverStatus,
      model: modelStatus,
      isInitialized: this.isInitialized,
      isModelTested: this.isModelTested,
      isReady: Boolean(
        serverStatus.isRunning &&
          serverStatus.isHttpReady &&
          modelStatus.currentModel &&
          !modelStatus.isLoading &&
          !modelStatus.error &&
          this.isModelTested &&
          !this.testError,
      ),
      error: modelStatus.error,
      testError: this.testError,
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

      // 4. If there's a configured model, load it and test it
      // Don't await this - let it load in background
      // The UI can show loading state via the model store status
      void this.loadAndTestModel(currentModel).catch((error) => {
        console.error(
          `[ModelManager] Failed to load and test model ${currentModel}:`,
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
   * Loads a model and then tests it to ensure it's fully ready.
   * This is a helper method used during initialization.
   */
  private async loadAndTestModel(repoId: string): Promise<void> {
    // First, wait for the MLX server to be fully ready
    await mlcServer.waitForReady

    // Then load the model
    await modelStore.loadModel(repoId)

    // Finally, test the model
    await this.testModel(repoId)
  }

  /**
   * Tests the model by sending a simple message to verify it can respond.
   * This helps ensure the model is fully loaded and ready for use.
   */
  async testModel(modelId: string): Promise<void> {
    this.testError = null
    this.isModelTested = false
    this.notifyListeners()

    try {
      // Double-check server readiness (should already be ready from caller)
      if (!mlcServer.isReady) {
        await mlcServer.waitForReady
      }

      const model = this.createClient(modelId)

      // Send a simple test message to verify the model is responding
      const result = await generateText({
        model,
        prompt: 'Hello',
        maxOutputTokens: 5,
      })

      if (!result.text || result.text.trim().length === 0) {
        throw new Error('Model test failed: received empty response')
      }

      this.isModelTested = true
      console.log(`[ModelManager] Model test successful for ${modelId}`)
    } catch (error) {
      this.testError = error instanceof Error ? error.message : String(error)
      console.error(`[ModelManager] Model test failed for ${modelId}:`, error)
      throw error
    } finally {
      this.notifyListeners()
    }
  }

  private createClient(modelId: string) {
    const endpoint = mlcServer.endpoint

    if (!endpoint) {
      throw new Error('MLC endpoint is not available')
    }

    if (!modelId) {
      throw new Error('Model ID is required')
    }

    return createMlcClient({ modelId, endpoint })
  }

  /**
   * Switches to a new model by updating settings and loading it.
   * This does not update the database - that should be done separately
   * via the settings hooks.
   */
  async switchModel(repoId: string): Promise<void> {
    // Reset test state when switching models
    this.isModelTested = false
    this.testError = null
    this.notifyListeners()

    // Ensure server is ready before loading and testing
    await mlcServer.waitForReady
    await modelStore.loadModel(repoId)

    // Test the newly loaded model
    await this.testModel(repoId)
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
        'Model manager is not ready. Server, model, or model test not available.',
      )
    }

    const currentModel = modelStore.status.currentModel

    if (!currentModel) {
      throw new Error('No model is currently loaded')
    }

    return this.createClient(currentModel)
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
    this.isModelTested = false
    this.testError = null
  }
}

/** Singleton service entry point for coordinating MLX server and model management. */
export const modelManager = new ModelManagerService()
