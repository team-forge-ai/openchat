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
  MLXServerNotRunningError,
  MLXServerStartupError,
} from '@/types/mlx-server'

import { ModelsResponseSchema } from './mlx-server-schemas'
import { findAvailablePort, validateServerState } from './mlx-server-validation'

class MLXServerService {
  private command: Command<string> | null = null
  private child: Child | null = null
  private isRunning = false
  private config: MLXServerConfig | null = null
  private isInitializing = false
  private initializationPromise: Promise<void> | null = null

  /**
   * Start the MLX server with the given configuration
   */
  async start(config: MLXServerConfig): Promise<void> {
    // If already initializing, wait for the existing initialization to complete
    if (this.isInitializing && this.initializationPromise) {
      console.log('Server initialization already in progress, waiting...')
      return await this.initializationPromise
    }

    // If already running, just return
    if (this.isRunning) {
      console.log('MLX server is already running, skipping start')
      return
    }

    // Mark as initializing and create the promise
    this.isInitializing = true
    this.initializationPromise = this.doStart(config).finally(() => {
      this.isInitializing = false
      this.initializationPromise = null
    })

    return await this.initializationPromise
  }

  /**
   * Internal method to actually start the server
   */
  private async doStart(config: MLXServerConfig): Promise<void> {
    // Validate server state
    validateServerState({
      isRunning: this.isRunning,
      child: this.child,
      command: this.command,
    })

    // Handle orphaned processes or inconsistent state
    if (this.child?.pid && !this.isRunning) {
      console.log('Detected potential orphaned process, attempting cleanup...')
      await this.stop()
    }

    // Clean any residual state
    if (this.command || this.child) {
      console.log('Cleaning up residual state before starting...')
      this.cleanup()
    }

    // Find an available port (will use the preferred port if available)
    const preferredPort = config.port || DEFAULT_CONFIG.PORT
    const availablePort = await findAvailablePort(preferredPort)

    // Update config with the actual port we'll use
    const actualConfig = { ...config, port: availablePort }

    if (availablePort !== preferredPort) {
      console.log(
        `Port ${preferredPort} was unavailable, using port ${availablePort} instead`,
      )
    }

    this.config = actualConfig

    const args = this.buildCommandArgs(actualConfig)

    try {
      // Create the command to run the MLX server sidecar
      // Use the exact path as specified in tauri.conf.json > bundle > externalBin
      this.command = Command.sidecar('binaries/openchat-mlx-server', args)

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
      await this.waitForServer(actualConfig.port || DEFAULT_CONFIG.PORT)
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
    this.isInitializing = false
    this.initializationPromise = null
  }

  /**
   * Stop the MLX server
   */
  async stop(): Promise<void> {
    // Wait for any ongoing initialization to complete first
    if (this.isInitializing && this.initializationPromise) {
      console.log('Waiting for initialization to complete before stopping...')
      try {
        await this.initializationPromise
      } catch {
        // Ignore initialization errors when stopping
      }
    }

    if (!this.isRunning && !this.child) {
      console.log('MLX server is not running')
      this.cleanup()
      return
    }

    try {
      if (this.child) {
        await this.child.kill()
      }
      this.cleanup()
      console.log('MLX server stopped')
    } catch (error) {
      console.error('Failed to stop MLX server:', error)
      this.cleanup() // Ensure cleanup happens even on error
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

    const jsonData: unknown = await response.json()
    const parseResult = ModelsResponseSchema.safeParse(jsonData)

    if (!parseResult.success) {
      console.error('Invalid models response format:', parseResult.error)
      throw new Error('Invalid response format from MLX server')
    }

    return parseResult.data
  }
}

// Export a singleton instance
export const mlxServer = new MLXServerService()
