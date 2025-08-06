import {
  Command,
  type Child,
  type TerminatedPayload,
} from '@tauri-apps/plugin-shell'

import type {
  ChatCompletionOptions,
  ChatMessage,
  MLXServerConfig,
  MLXServerStatus,
  ModelsResponse,
} from '@/types/mlx-server'
import {
  DEFAULT_CONFIG,
  MLXServerAlreadyRunningError,
  MLXServerNotRunningError,
  MLXServerStartupError,
} from '@/types/mlx-server'

class MLXServerService {
  private command: Command<string> | null = null
  private child: Child | null = null
  private isRunning = false
  private config: MLXServerConfig | null = null

  /**
   * Start the MLX server with the given configuration
   */
  async start(config: MLXServerConfig): Promise<void> {
    if (this.isRunning) {
      throw new MLXServerAlreadyRunningError()
    }

    this.config = config

    const args = this.buildCommandArgs(config)

    try {
      // Create the command to run the MLX server sidecar
      this.command = Command.sidecar('openchat-mlx-server', args)

      // Set up event listeners
      this.setupEventListeners()

      // Start the server
      this.child = await this.command.spawn()

      console.log(`MLX server started with PID: ${this.child.pid}`)

      // Wait a moment for the server to start
      await new Promise((resolve) =>
        setTimeout(resolve, DEFAULT_CONFIG.INITIAL_STARTUP_DELAY),
      )

      // Verify the server is responding
      await this.waitForServer(config.port || DEFAULT_CONFIG.PORT)
    } catch (error) {
      console.error('Failed to start MLX server:', error)
      this.cleanup()
      throw new MLXServerStartupError(
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  /**
   * Build command arguments from configuration
   */
  private buildCommandArgs(config: MLXServerConfig): string[] {
    const args = [
      config.modelPath,
      '--port',
      (config.port || DEFAULT_CONFIG.PORT).toString(),
      '--host',
      config.host || DEFAULT_CONFIG.HOST,
    ]

    if (config.logLevel) {
      args.push('--log-level', config.logLevel)
    }

    if (config.maxTokens) {
      args.push('--max-tokens', config.maxTokens.toString())
    }

    if (config.temperature) {
      args.push('--temperature', config.temperature.toString())
    }

    return args
  }

  /**
   * Set up event listeners for the command
   */
  private setupEventListeners(): void {
    if (!this.command) {
      return
    }

    this.command.on('close', (data: TerminatedPayload) => {
      console.log('MLX server closed with code:', data.code)
      this.cleanup()
    })

    this.command.on('error', (error: string) => {
      console.error('MLX server error:', error)
      this.cleanup()
    })

    this.command.stdout.on('data', (line: string) => {
      console.log('MLX server stdout:', line)
      // Look for server startup confirmation
      if (line.includes('Server started') || line.includes('Uvicorn running')) {
        this.isRunning = true
      }
    })

    this.command.stderr.on('data', (line: string) => {
      console.error('MLX server stderr:', line)
    })
  }

  /**
   * Clean up server state
   */
  private cleanup(): void {
    this.isRunning = false
    this.child = null
    this.command = null
  }

  /**
   * Stop the MLX server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.child) {
      console.log('MLX server is not running')
      return
    }

    try {
      await this.child.kill()
      this.cleanup()
      console.log('MLX server stopped')
    } catch (error) {
      console.error('Failed to stop MLX server:', error)
      throw error
    }
  }

  /**
   * Get the current status of the MLX server
   */
  getStatus(): MLXServerStatus {
    return {
      isRunning: this.isRunning,
      port: this.config?.port,
      modelPath: this.config?.modelPath,
      pid: this.child?.pid ?? null,
    }
  }

  /**
   * Check if the server is healthy by making a health check request
   */
  async healthCheck(port: number = DEFAULT_CONFIG.PORT): Promise<boolean> {
    try {
      const response = await fetch(
        `http://${DEFAULT_CONFIG.HOST}:${port}/health`,
      )
      return response.ok
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }

  /**
   * Wait for the server to become available
   */
  private async waitForServer(
    port: number,
    maxAttempts: number = DEFAULT_CONFIG.MAX_STARTUP_ATTEMPTS,
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.healthCheck(port)) {
        this.isRunning = true
        return
      }
      await new Promise((resolve) =>
        setTimeout(resolve, DEFAULT_CONFIG.STARTUP_CHECK_INTERVAL),
      )
    }
    throw new MLXServerStartupError(
      'Server failed to start within timeout period',
    )
  }

  /**
   * Make a chat completion request to the MLX server
   */
  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {},
  ): Promise<Response> {
    if (!this.isRunning) {
      throw new MLXServerNotRunningError()
    }

    const port = options.port || this.config?.port || DEFAULT_CONFIG.PORT
    const url = `http://${DEFAULT_CONFIG.HOST}:${port}/v1/chat/completions`

    const body = {
      messages,
      max_tokens:
        options.maxTokens ||
        this.config?.maxTokens ||
        DEFAULT_CONFIG.MAX_TOKENS,
      temperature:
        options.temperature ||
        this.config?.temperature ||
        DEFAULT_CONFIG.TEMPERATURE,
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

  /**
   * Get available models from the MLX server
   */
  async getModels(port: number = DEFAULT_CONFIG.PORT): Promise<ModelsResponse> {
    if (!this.isRunning) {
      throw new MLXServerNotRunningError()
    }

    const response = await fetch(
      `http://${DEFAULT_CONFIG.HOST}:${port}/v1/models`,
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`)
    }

    return (await response.json()) as ModelsResponse
  }
}

// Export a singleton instance
export const mlxServer = new MLXServerService()
