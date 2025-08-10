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
 * MLX Server Service - Frontend facade for the Rust-managed MLX server
 *
 * This class provides a familiar interface for the frontend while delegating
 * all process management to the Rust backend.
 */
class MLXServerService {
  private cachedStatus: MLXServerStatus | null = null
  private statusListeners = new Set<(status: MLXServerStatus) => void>()
  private eventUnlisteners: UnlistenFn[] = []
  private modelReadyPollTimer: number | null = null

  /**
   * Get the current status of the MLX server from Rust
   */
  async getStatus(): Promise<MLXServerStatus> {
    try {
      const status = await invoke<RustMLXServerStatus>('mlx_get_status')

      // Convert Rust snake_case to JS camelCase for compatibility
      this.cachedStatus = {
        isRunning: status.is_running,
        isHttpReady: status.is_http_ready,
        isModelReady:
          (this.cachedStatus?.isModelReady ?? false) &&
          status.is_http_ready &&
          status.is_running,
        port: status.port,
        pid: status.pid ?? null,
      }

      // Start polling once when HTTP becomes ready; stop when not ready
      if (this.cachedStatus.isRunning && this.cachedStatus.isHttpReady) {
        this.startModelReadyPolling()
      } else {
        this.stopModelReadyPolling()
        this.cachedStatus.isModelReady = false
      }

      return this.cachedStatus
    } catch (error) {
      console.error('Failed to get MLX server status:', error)
      throw error
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

          const status = convertRustStatusToJS(event.payload)
          // Reset model-ready when server not ready
          if (!status.isRunning || !status.isHttpReady) {
            status.isModelReady = false
          } else {
            // Keep previous model-ready state if available until refreshed
            status.isModelReady = this.cachedStatus?.isModelReady ?? false
          }
          this.cachedStatus = status

          // Notify all status listeners
          this.statusListeners.forEach((listener) => listener(status))

          // Start polling when HTTP becomes ready; stop otherwise
          if (status.isRunning && status.isHttpReady) {
            this.startModelReadyPolling()
          } else {
            this.stopModelReadyPolling()
          }
        },
      )
      this.eventUnlisteners.push(statusUnlisten)
    } catch (error) {
      console.error('Failed to initialize MLX server event listeners:', error)
    }
  }

  /**
   * Add a listener for status changes
   */
  addStatusListener(listener: (status: MLXServerStatus) => void): () => void {
    this.statusListeners.add(listener)

    // Return cleanup function
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  /**
   * Cleanup event listeners
   */
  cleanup(): void {
    // Clean up all event listeners
    this.eventUnlisteners.forEach((unlisten) => unlisten())
    this.eventUnlisteners = []

    // Clear all listener sets
    this.statusListeners.clear()
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
    const s = this.cachedStatus
    return !!(s && s.isRunning && s.isHttpReady && s.isModelReady)
  }

  /** Public method to verify the default model responds */
  async checkModelReady(): Promise<boolean> {
    const status = this.cachedStatus ?? (await this.getStatus())
    if (!status.isRunning || !status.isHttpReady) {
      this.updateModelReady(false)
      return false
    }

    try {
      const resp = await this.chatCompletionRequest(
        [{ role: 'user', content: 'ping' }],
        { model: DEFAULT_MODEL, maxTokens: 1, temperature: 0, stream: false },
      )
      const ok = resp.ok
      this.updateModelReady(ok)
      return ok
    } catch (_err) {
      this.updateModelReady(false)
      return false
    }
  }

  private updateModelReady(value: boolean) {
    if (!this.cachedStatus) {
      this.cachedStatus = {
        isRunning: false,
        isHttpReady: false,
        isModelReady: false,
      }
    }
    const changed = this.cachedStatus.isModelReady !== value
    this.cachedStatus.isModelReady = value
    // no-op: polling manages freshness
    if (changed) {
      const snapshot = { ...this.cachedStatus }
      this.statusListeners.forEach((l) => l(snapshot))
    }
  }

  private startModelReadyPolling(): void {
    if (this.modelReadyPollTimer !== null) {
      return
    }
    // Immediate check once
    void this.checkModelReady()
    // Then poll until success
    this.modelReadyPollTimer = window.setInterval(async () => {
      const ok = await this.checkModelReady()
      if (ok) {
        this.stopModelReadyPolling()
      }
    }, 2000)
  }

  private stopModelReadyPolling(): void {
    if (this.modelReadyPollTimer !== null) {
      clearInterval(this.modelReadyPollTimer)
      this.modelReadyPollTimer = null
    }
  }

  private async makeRequest(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    const status = await this.getStatus()

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
