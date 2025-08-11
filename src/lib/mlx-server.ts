import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

import { ChatCompletionResponseSchema } from '@/lib/mlx-server-schemas'
import type {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  MLXServerStatus,
} from '@/types/mlx-server'
import { DEFAULT_CONFIG, MLXServerNotRunningError } from '@/types/mlx-server'

export const DEFAULT_MODEL = 'mlx-community/qwen3-4b-4bit-DWQ'

type RustMLXServerStatus = {
  is_running: boolean
  is_http_ready: boolean
  port?: number
  model_path?: string
  pid?: number
  error?: string
}

/**
 * Centralized status management with immutable updates and listener notifications
 */
class MLXStatusManager {
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

    // Notify listeners if anything changed
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

/**
 * Manages model readiness polling with proper cleanup
 */
class ModelReadinessPoller {
  private timer: number | null = null
  private isRunning = false

  start(checkFn: () => Promise<boolean>, intervalMs = 2000): void {
    if (this.isRunning) {
      return
    }

    this.isRunning = true

    // Immediate check
    void this.performCheck(checkFn)

    // Then poll until success
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

/**
 * MLX Server Service - Frontend facade for the Rust-managed MLX server
 *
 * This class provides a familiar interface for the frontend while delegating
 * all process management to the Rust backend.
 */
class MLXServerService {
  private statusManager: MLXStatusManager
  private modelPoller: ModelReadinessPoller
  private eventUnlisteners: UnlistenFn[] = []

  constructor() {
    this.statusManager = new MLXStatusManager()
    this.modelPoller = new ModelReadinessPoller()
  }

  /**
   * Get the current status of the MLX server from Rust
   */
  async getStatus(): Promise<MLXServerStatus> {
    try {
      const rustStatus = await invoke<RustMLXServerStatus>('mlx_get_status')
      const jsStatus = convertRustStatusToJS(rustStatus)

      // Preserve existing model ready state if conditions allow
      const currentStatus = this.statusManager.getStatus()
      const isModelReady =
        jsStatus.isRunning && jsStatus.isHttpReady && currentStatus.isModelReady

      const updatedStatus = this.statusManager.updateStatus({
        ...jsStatus,
        isModelReady,
      })

      // Handle state transitions
      this.handleStateTransition(currentStatus, updatedStatus)

      return updatedStatus
    } catch (error) {
      console.error('Failed to get MLX server status:', error)
      throw error
    }
  }

  /**
   * Handle state transitions and side effects
   */
  private handleStateTransition(
    prev: MLXServerStatus,
    next: MLXServerStatus,
  ): void {
    // Start model polling when HTTP becomes ready
    if (
      next.isRunning &&
      next.isHttpReady &&
      (!prev.isHttpReady || !prev.isRunning)
    ) {
      this.startModelPolling()
    }

    // Stop model polling and reset model ready when server not ready
    if (!next.isRunning || !next.isHttpReady) {
      this.stopModelPolling()
      if (next.isModelReady) {
        this.statusManager.updateStatus({ isModelReady: false })
      }
    }
  }

  /**
   * Initialize event listeners for all MLX server events
   */
  async initializeEventListeners(): Promise<void> {
    if (this.eventUnlisteners.length > 0) {
      return // Already initialized
    }

    try {
      // Listen for status changes
      const statusUnlisten = await listen<RustMLXServerStatus>(
        'mlx-status-changed',
        (event) => {
          console.log('MLX server status changed:', event.payload)
          this.handleStatusUpdate(event.payload)
        },
      )
      this.eventUnlisteners.push(statusUnlisten)
    } catch (error) {
      console.error('Failed to initialize MLX server event listeners:', error)
    }
  }

  /**
   * Handle status updates from Rust events
   */
  private handleStatusUpdate(rustStatus: RustMLXServerStatus): void {
    const jsStatus = convertRustStatusToJS(rustStatus)
    const currentStatus = this.statusManager.getStatus()

    // Preserve model ready state if conditions allow
    const isModelReady =
      jsStatus.isRunning && jsStatus.isHttpReady && currentStatus.isModelReady

    const updatedStatus = this.statusManager.updateStatus({
      ...jsStatus,
      isModelReady,
    })

    // Handle state transitions
    this.handleStateTransition(currentStatus, updatedStatus)
  }

  /**
   * Add a listener for status changes
   */
  addStatusListener(listener: (status: MLXServerStatus) => void): () => void {
    return this.statusManager.addListener(listener)
  }

  /**
   * Cleanup event listeners and resources
   */
  cleanup(): void {
    // Clean up all event listeners
    this.eventUnlisteners.forEach((unlisten) => unlisten())
    this.eventUnlisteners = []

    // Clean up status manager and model poller
    this.statusManager.clearListeners()
    this.modelPoller.cleanup()
  }

  /**
   * Check if the server is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await invoke<boolean>('mlx_health_check')
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }

  /**
   * Restart the MLX server
   */
  async restart(): Promise<void> {
    try {
      await invoke('mlx_restart')
    } catch (error) {
      console.error('Failed to restart MLX server:', error)
      throw error
    }
  }

  /**
   * Make a chat completion request to the MLX server
   * This method is still handled on the frontend side as it's just HTTP communication
   */
  async chatCompletionRequest(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {},
  ): Promise<Response> {
    const path = `/v1/chat/completions`

    const body: Record<string, unknown> = {
      messages,
      stream: options.stream || false,
      model: options.model || DEFAULT_MODEL,
      ...(typeof options.maxTokens === 'number'
        ? { max_tokens: options.maxTokens }
        : {}),
      ...(typeof options.temperature === 'number'
        ? { temperature: options.temperature }
        : {}),
    }

    return await this.makeRequest(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    })
  }

  /**
   * Non-streaming chat completion that validates and returns parsed JSON
   */
  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {},
  ): Promise<ChatCompletionResponse> {
    const response = await this.chatCompletionRequest(messages, {
      ...options,
      stream: false,
    })

    if (!response.ok) {
      throw new Error(
        `MLX server request failed: ${response.status} ${response.statusText}`,
      )
    }

    const data: unknown = await response.json()
    const parsed = ChatCompletionResponseSchema.safeParse(data)
    if (!parsed.success) {
      throw new Error('Invalid chat completion response format')
    }

    return parsed.data
  }

  async listModels(): Promise<Response> {
    return await this.makeRequest(`/v1/models`, { method: 'GET' })
  }

  /** Returns true if running, healthy and model ping succeeds */
  get isReady(): boolean {
    const status = this.statusManager.getStatus()
    return status.isRunning && status.isHttpReady && status.isModelReady
  }

  /** Public method to verify the default model responds */
  async checkModelReady(timeoutMs = 5000): Promise<boolean> {
    const status = this.statusManager.getStatus()
    if (!status.isRunning || !status.isHttpReady) {
      this.statusManager.updateStatus({ isModelReady: false })
      return false
    }

    // Create an AbortController for request cancellation
    const abortController = new AbortController()

    try {
      // Create a timeout that will abort the request
      const timeoutId = setTimeout(() => {
        abortController.abort()
      }, timeoutMs)

      const resp = await this.chatCompletionRequest(
        [{ role: 'user', content: 'ping' }],
        {
          model: DEFAULT_MODEL,
          maxTokens: 1,
          temperature: 0,
          stream: false,
          signal: abortController.signal,
        },
      )

      clearTimeout(timeoutId)

      const isReady = resp.ok
      this.statusManager.updateStatus({ isModelReady: isReady })
      return isReady
    } catch (error) {
      console.warn('Model readiness check failed:', error)
      this.statusManager.updateStatus({ isModelReady: false })
      return false
    }
  }

  private startModelPolling(): void {
    this.modelPoller.start(() => this.checkModelReady())
  }

  private stopModelPolling(): void {
    this.modelPoller.stop()
  }

  private async makeRequest(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    // Use cached status to avoid triggering getStatus side effects
    const status = this.statusManager.getStatus()

    if (!status.isRunning || !status.isHttpReady) {
      throw new MLXServerNotRunningError()
    }

    const port = status.port || DEFAULT_CONFIG.PORT
    const url = `http://${DEFAULT_CONFIG.HOST}:${port}${path}`

    return await fetch(url, init)
  }
}

// Event handler helpers for Tauri events
export function convertRustStatusToJS(rustStatus: {
  is_running: boolean
  is_http_ready: boolean
  port?: number
  pid?: number
  error?: string
}): MLXServerStatus {
  return {
    isRunning: rustStatus.is_running,
    isHttpReady: rustStatus.is_http_ready,
    isModelReady: false,
    port: rustStatus.port,
    pid: rustStatus.pid ?? null,
  }
}

// Export a singleton instance for backward compatibility
export const mlxServer = new MLXServerService()
