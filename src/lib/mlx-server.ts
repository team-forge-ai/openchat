import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

import type {
  ChatCompletionOptions,
  ChatMessage,
  MLXServerStatus,
} from '@/types/mlx-server'
import { DEFAULT_CONFIG, MLXServerNotRunningError } from '@/types/mlx-server'

/**
 * MLX Server Service - Frontend facade for the Rust-managed MLX server
 *
 * This class provides a familiar interface for the frontend while delegating
 * all process management to the Rust backend.
 */
class MLXServerService {
  private cachedStatus: MLXServerStatus | null = null
  private statusListeners = new Set<(status: MLXServerStatus) => void>()
  private readyListeners = new Set<() => void>()
  private restartingListeners = new Set<() => void>()
  private eventUnlisteners: UnlistenFn[] = []

  /**
   * Get the current status of the MLX server from Rust
   */
  async getStatus(): Promise<MLXServerStatus> {
    try {
      const status = await invoke<{
        is_running: boolean
        is_ready: boolean
        port?: number
        model_path?: string
        pid?: number
        error?: string
      }>('mlx_get_status')

      // Convert Rust snake_case to JS camelCase for compatibility
      this.cachedStatus = {
        isRunning: status.is_running,
        isReady: status.is_ready,
        port: status.port,
        modelPath: status.model_path,
        pid: status.pid ?? null,
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
      const statusUnlisten = await listen<{
        is_running: boolean
        is_ready: boolean
        port?: number
        model_path?: string
        pid?: number
        error?: string
      }>('mlx-status-changed', (event) => {
        console.log('MLX server status changed:', event.payload)

        const status = convertRustStatusToJS(event.payload)
        this.cachedStatus = status

        // Notify all status listeners
        this.statusListeners.forEach((listener) => listener(status))
      })
      this.eventUnlisteners.push(statusUnlisten)

      // Listen for ready event
      const readyUnlisten = await listen('mlx-ready', () => {
        console.log('MLX server is ready!')
        this.readyListeners.forEach((listener) => listener())
      })
      this.eventUnlisteners.push(readyUnlisten)

      // Listen for restarting event
      const restartingUnlisten = await listen('mlx-restarting', () => {
        console.log('MLX server is restarting...')
        this.restartingListeners.forEach((listener) => listener())
      })
      this.eventUnlisteners.push(restartingUnlisten)
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
   * Add a listener for ready events
   */
  addReadyListener(listener: () => void): () => void {
    this.readyListeners.add(listener)

    // Return cleanup function
    return () => {
      this.readyListeners.delete(listener)
    }
  }

  /**
   * Add a listener for restarting events
   */
  addRestartingListener(listener: () => void): () => void {
    this.restartingListeners.add(listener)

    // Return cleanup function
    return () => {
      this.restartingListeners.delete(listener)
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
    this.readyListeners.clear()
    this.restartingListeners.clear()
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
  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {},
  ): Promise<Response> {
    // Get current status to check if server is running and ready
    const status = await this.getStatus()

    if (!status.isRunning || !status.isReady) {
      throw new MLXServerNotRunningError()
    }

    const port = options.port || status.port || DEFAULT_CONFIG.PORT
    const url = `http://${DEFAULT_CONFIG.HOST}:${port}/v1/chat/completions`

    const body = {
      messages,
      stream: options.stream || false,
    }

    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }
}

// Event handler helpers for Tauri events
export function convertRustStatusToJS(rustStatus: {
  is_running: boolean
  is_ready: boolean
  port?: number
  model_path?: string
  pid?: number
  error?: string
}): MLXServerStatus {
  return {
    isRunning: rustStatus.is_running,
    isReady: rustStatus.is_ready,
    port: rustStatus.port,
    modelPath: rustStatus.model_path,
    pid: rustStatus.pid ?? null,
  }
}

// Export a singleton instance for backward compatibility
export const mlxServer = new MLXServerService()
