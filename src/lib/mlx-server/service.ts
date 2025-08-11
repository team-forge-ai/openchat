import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

import { DEFAULT_MODEL } from '@/lib/mlx-server/constants'
import { ModelReadinessPoller } from '@/lib/mlx-server/model-readiness-poller'
import { ChatCompletionResponseSchema } from '@/lib/mlx-server/schemas'
import { MLXStatusManager } from '@/lib/mlx-server/status-manager'
import { convertRustStatusToJS } from '@/lib/mlx-server/utils'
import type {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  MLXServerStatus,
} from '@/types/mlx-server'
import { DEFAULT_CONFIG, MLXServerNotRunningError } from '@/types/mlx-server'

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
 */
export class MLXServerService {
  private statusManager: MLXStatusManager
  private modelPoller: ModelReadinessPoller
  private eventUnlisteners: UnlistenFn[] = []

  constructor() {
    this.statusManager = new MLXStatusManager()
    this.modelPoller = new ModelReadinessPoller()
  }

  async getStatus(): Promise<MLXServerStatus> {
    try {
      const rustStatus = await invoke<RustMLXServerStatus>('mlx_get_status')
      const jsStatus = convertRustStatusToJS(rustStatus)

      const currentStatus = this.statusManager.getStatus()
      const isModelReady =
        jsStatus.isRunning && jsStatus.isHttpReady && currentStatus.isModelReady

      const updatedStatus = this.statusManager.updateStatus({
        ...jsStatus,
        isModelReady,
      })

      this.handleStateTransition(currentStatus, updatedStatus)
      return updatedStatus
    } catch (error) {
      console.error('Failed to get MLX server status:', error)
      throw error
    }
  }

  private handleStateTransition(
    prev: MLXServerStatus,
    next: MLXServerStatus,
  ): void {
    if (
      next.isRunning &&
      next.isHttpReady &&
      (!prev.isHttpReady || !prev.isRunning)
    ) {
      this.startModelPolling()
    }

    if (!next.isRunning || !next.isHttpReady) {
      this.stopModelPolling()
      if (next.isModelReady) {
        this.statusManager.updateStatus({ isModelReady: false })
      }
    }
  }

  async initializeEventListeners(): Promise<void> {
    if (this.eventUnlisteners.length > 0) {
      return
    }
    try {
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

  private handleStatusUpdate(rustStatus: RustMLXServerStatus): void {
    const jsStatus = convertRustStatusToJS(rustStatus)
    const currentStatus = this.statusManager.getStatus()
    const isModelReady =
      jsStatus.isRunning && jsStatus.isHttpReady && currentStatus.isModelReady
    const updatedStatus = this.statusManager.updateStatus({
      ...jsStatus,
      isModelReady,
    })
    this.handleStateTransition(currentStatus, updatedStatus)
  }

  addStatusListener(listener: (status: MLXServerStatus) => void): () => void {
    return this.statusManager.addListener(listener)
  }

  cleanup(): void {
    this.eventUnlisteners.forEach((unlisten) => unlisten())
    this.eventUnlisteners = []
    this.statusManager.clearListeners()
    this.modelPoller.cleanup()
  }

  async healthCheck(): Promise<boolean> {
    try {
      return await invoke<boolean>('mlx_health_check')
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }

  async restart(): Promise<void> {
    try {
      await invoke('mlx_restart')
    } catch (error) {
      console.error('Failed to restart MLX server:', error)
      throw error
    }
  }

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
      ...(options.tools ? { tools: options.tools } : {}),
      ...(options.toolChoice ? { tool_choice: options.toolChoice } : {}),
      ...(typeof options.parallelToolCalls === 'boolean'
        ? { parallel_tool_calls: options.parallelToolCalls }
        : {}),
    }
    return await this.makeRequest(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    })
  }

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

  get isReady(): boolean {
    const status = this.statusManager.getStatus()
    return status.isRunning && status.isHttpReady && status.isModelReady
  }

  async checkModelReady(timeoutMs = 5000): Promise<boolean> {
    const status = this.statusManager.getStatus()
    if (!status.isRunning || !status.isHttpReady) {
      this.statusManager.updateStatus({ isModelReady: false })
      return false
    }
    const abortController = new AbortController()
    try {
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
    const status = this.statusManager.getStatus()
    if (!status.isRunning || !status.isHttpReady) {
      throw new MLXServerNotRunningError()
    }
    const port = status.port || DEFAULT_CONFIG.PORT
    const url = `http://${DEFAULT_CONFIG.HOST}:${port}${path}`
    return await fetch(url, init)
  }
}

export const mlxServer = new MLXServerService()
