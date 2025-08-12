import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { generateText, type CoreMessage } from 'ai'

import { DEFAULT_MODEL } from '@/lib/mlx-server/constants'
import { ModelReadinessPoller } from '@/lib/mlx-server/model-readiness-poller'
import { MLXStatusManager } from '@/lib/mlx-server/status-manager'
import { convertRustStatusToJS } from '@/lib/mlx-server/utils'
import type {
  ChatCompletionOptions,
  ChatMessage,
  MLXServerStatus,
} from '@/types/mlx-server'
import { DEFAULT_CONFIG, MLXServerNotRunningError } from '@/types/mlx-server'

import { createMlxClient } from './client'

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
  protected modelId = DEFAULT_MODEL

  constructor() {
    this.statusManager = new MLXStatusManager()
    this.modelPoller = new ModelReadinessPoller()
  }

  get model() {
    return createMlxClient({ modelId: this.modelId, endpoint: this.endpoint })
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
    _options: ChatCompletionOptions = {},
  ): Promise<string> {
    const model = this.model
    const coreMessages: CoreMessage[] = messages
      .filter(
        (m) =>
          m.role === 'system' || m.role === 'user' || m.role === 'assistant',
      )
      .map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content ?? '',
      }))

    const result = await generateText({ model, messages: coreMessages })
    return result.text
  }

  async listModels(): Promise<Response> {
    return await this.makeRequest(`/v1/models`, { method: 'GET' })
  }

  get isReady(): boolean {
    const status = this.statusManager.getStatus()
    return status.isRunning && status.isHttpReady && status.isModelReady
  }

  get endpoint(): string {
    const status = this.statusManager.getStatus()
    const port = status.port || DEFAULT_CONFIG.PORT
    return `http://${DEFAULT_CONFIG.HOST}:${port}`
  }

  async checkModelReady(timeoutMs = 5000): Promise<boolean> {
    const status = this.statusManager.getStatus()
    if (!status.isRunning || !status.isHttpReady) {
      this.statusManager.updateStatus({ isModelReady: false })
      return false
    }

    const model = this.model

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)

    const readinessProbe = async (): Promise<boolean> => {
      try {
        const result = await generateText({
          model,
          messages: [
            { role: 'system', content: 'respond with: ok' },
            { role: 'user', content: 'ping' },
          ],
          abortSignal: abortController.signal,
        })
        return typeof result.text === 'string' && result.text.length > 0
      } catch {
        return false
      }
    }

    try {
      const isReady = await readinessProbe()
      clearTimeout(timeoutId)
      this.statusManager.updateStatus({ isModelReady: Boolean(isReady) })
      return Boolean(isReady)
    } catch {
      clearTimeout(timeoutId)
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
    return await fetch(new URL(path, this.endpoint), init)
  }
}

export const mlxServer = new MLXServerService()
