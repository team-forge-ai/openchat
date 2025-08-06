import { Command } from '@tauri-apps/plugin-shell'

export interface MLXServerConfig {
  port?: number
  host?: string
  modelPath: string
  logLevel?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'
  maxTokens?: number
  temperature?: number
}

export interface MLXServerStatus {
  isRunning: boolean
  port?: number
  modelPath?: string
  pid?: number | null
}

class MLXServerService {
  private command: unknown = null
  private isRunning = false
  private config: MLXServerConfig | null = null
  private pid: number | null = null

  /**
   * Start the MLX server with the given configuration
   */
  async start(config: MLXServerConfig): Promise<void> {
    if (this.isRunning) {
      throw new Error('MLX server is already running')
    }

    this.config = config

    const args = [
      config.modelPath,
      '--port',
      (config.port || 8000).toString(),
      '--host',
      config.host || '127.0.0.1',
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

    try {
      // Create the command to run the MLX server sidecar
      this.command = Command.sidecar('openchat-mlx-server', args)

      // Set up event listeners with proper type casting
      const cmd = this.command as any
      cmd.on('close', (data: any) => {
        console.log('MLX server closed with code:', data.code)
        this.isRunning = false
        this.pid = null
      })

      cmd.on('error', (error: any) => {
        console.error('MLX server error:', error)
        this.isRunning = false
        this.pid = null
      })

      cmd.stdout.on('data', (line: any) => {
        console.log('MLX server stdout:', line)
        // Look for server startup confirmation
        if (
          String(line).includes('Server started') ||
          String(line).includes('Uvicorn running')
        ) {
          this.isRunning = true
        }
      })

      cmd.stderr.on('data', (line: any) => {
        console.error('MLX server stderr:', line)
      })

      // Start the server
      const child = await cmd.spawn()
      this.pid = child.pid

      console.log(`MLX server started with PID: ${child.pid}`)

      // Wait a moment for the server to start
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Verify the server is responding
      await this.waitForServer(config.port || 8000)
    } catch (error) {
      console.error('Failed to start MLX server:', error)
      this.isRunning = false
      this.pid = null
      throw error
    }
  }

  /**
   * Stop the MLX server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.command) {
      console.log('MLX server is not running')
      return
    }

    try {
      const cmd = this.command as any
      await cmd.kill()
      this.isRunning = false
      this.pid = null
      this.command = null
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
      pid: this.pid,
    }
  }

  /**
   * Check if the server is healthy by making a health check request
   */
  async healthCheck(port: number = 8000): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`)
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
    maxAttempts: number = 30,
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.healthCheck(port)) {
        this.isRunning = true
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    throw new Error('MLX server failed to start within timeout period')
  }

  /**
   * Make a chat completion request to the MLX server
   */
  async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    options: {
      maxTokens?: number
      temperature?: number
      stream?: boolean
      port?: number
    } = {},
  ): Promise<Response> {
    if (!this.isRunning) {
      throw new Error('MLX server is not running')
    }

    const port = options.port || this.config?.port || 8000
    const url = `http://127.0.0.1:${port}/v1/chat/completions`

    const body = {
      messages,
      max_tokens: options.maxTokens || this.config?.maxTokens || 150,
      temperature: options.temperature || this.config?.temperature || 0.7,
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
  async getModels(port: number = 8000): Promise<Response> {
    if (!this.isRunning) {
      throw new Error('MLX server is not running')
    }

    return await fetch(`http://127.0.0.1:${port}/v1/models`)
  }
}

// Export a singleton instance
export const mlxServer = new MLXServerService()
