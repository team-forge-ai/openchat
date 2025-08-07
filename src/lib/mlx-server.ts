import { invoke } from '@tauri-apps/api/core'

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

  /**
   * Get the current status of the MLX server from Rust
   */
  async getStatus(): Promise<MLXServerStatus> {
    try {
      const status = await invoke<{
        is_running: boolean
        port?: number
        model_path?: string
        pid?: number
        error?: string
      }>('mlx_get_status')

      // Convert Rust snake_case to JS camelCase for compatibility
      this.cachedStatus = {
        isRunning: status.is_running,
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
    // Get current status to check if server is running and get port
    const status = await this.getStatus()

    if (!status.isRunning) {
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

// Export a singleton instance for backward compatibility
export const mlxServer = new MLXServerService()
