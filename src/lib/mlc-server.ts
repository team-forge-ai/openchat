import { invoke } from '@tauri-apps/api/core'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { listen } from '@tauri-apps/api/event'

import { EVENT_MLC_STATUS_CHANGED } from '@/lib/events'
import { createMlcClient } from '@/lib/mlc-client'
import type { MLCServerStatusWire, MLCStatus, Model } from '@/types/mlc-server'
import { ModelsResponseSchema } from '@/types/mlc-server'

function fromWire(status: MLCServerStatusWire): MLCStatus {
  return {
    isReady: Boolean(status.is_running && status.is_http_ready),
    port: status.port,
    error: status.error ?? null,
  }
}

/**
 * Service responsible for tracking MLC server status via Tauri events and
 * exposing a convenience API for consumers (status listeners, restart,
 * endpoint/model access, and a readiness promise).
 */
class MLCServerService {
  private currentStatus: MLCStatus | null = null
  private tauriUnlisten: UnlistenFn | null = null
  private listeners = new Set<(status: MLCStatus) => void>()
  private startPromise: Promise<MLCStatus> | null = null

  async initializeEventListeners(): Promise<void> {
    if (this.tauriUnlisten) {
      return
    }
    this.tauriUnlisten = await listen<MLCServerStatusWire>(
      EVENT_MLC_STATUS_CHANGED,
      (event) => {
        const status = fromWire(event.payload)
        this.currentStatus = status

        for (const handler of this.listeners) {
          handler(status)
        }
      },
    )
  }

  /** Adds a status listener. Returns a disposer to unsubscribe. */
  addStatusListener(handler: (status: MLCStatus) => void): () => void {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  /** Retrieves the latest status via Tauri command and caches it. */
  async fetchStatus(): Promise<MLCStatus> {
    const wire = await invoke<MLCServerStatusWire>('mlc_get_status')
    const status = fromWire(wire)
    this.currentStatus = status

    return status
  }

  /** Starts the MLC server process and returns the immediate status. */
  async start(): Promise<MLCStatus> {
    // If already starting, return the existing promise
    if (this.startPromise) {
      return await this.startPromise
    }

    // Create and cache the start promise
    this.startPromise = this.performStart()

    try {
      const result = await this.startPromise
      return result
    } finally {
      // Clear the promise once completed (success or failure)
      this.startPromise = null
    }
  }

  private async performStart(): Promise<MLCStatus> {
    const wire = await invoke<MLCServerStatusWire>('mlc_start')
    const status = fromWire(wire)
    this.currentStatus = status

    return status
  }

  /** Restarts the MLC server process and returns the immediate status. */
  async restart(): Promise<MLCStatus> {
    const wire = await invoke<MLCServerStatusWire>('mlc_restart')
    const status = fromWire(wire)
    this.currentStatus = status

    return status
  }

  /** True when the server is running and an HTTP port is available. */
  get isReady(): boolean {
    return Boolean(this.currentStatus?.isReady && this.currentStatus?.port)
  }

  /** Returns the base HTTP endpoint for the local MLC server, or null. */
  get endpoint(): string | null {
    if (!this.currentStatus?.port) {
      return null
    }
    return `http://127.0.0.1:${this.currentStatus.port}`
  }

  /** Resolves once the server is ready; caches current readiness when true. */
  get waitForReady(): Promise<MLCStatus> {
    if (this.currentStatus?.isReady && this.currentStatus?.port) {
      return Promise.resolve(this.currentStatus)
    }

    return new Promise<MLCStatus>((resolve) => {
      let done = false
      const unlisten = this.addStatusListener((s) => {
        if (!done && s.isReady && s.port) {
          done = true
          unlisten()
          resolve(s)
        }
      })
    })
  }

  /** Returns an OpenAI-compatible model instance bound to the current server. */
  get client() {
    const endpoint = this.endpoint

    if (!endpoint) {
      throw new Error('MLC endpoint is not available')
    }

    // Use a default model identifier since we're not specifying a specific model
    return createMlcClient({ modelId: 'default', endpoint })
  }

  async fetchModels(): Promise<Model[]> {
    if (!this.endpoint) {
      return []
    }

    try {
      const response = await fetch(new URL('/v1/models', this.endpoint), {
        // Use shorter timeout for local server
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        throw new Error(
          `Failed to fetch models: ${response.status} ${response.statusText}`,
        )
      }

      const data: unknown = await response.json()
      const parsedResponse = ModelsResponseSchema.parse(data)
      return parsedResponse.data
    } catch (error) {
      console.warn(
        '[MLCServer] Failed to fetch models from local server:',
        error,
      )
      // Return empty array instead of throwing - this allows the app to work
      // even if the models endpoint is temporarily unavailable
      return []
    }
  }
}

/** Singleton service entry point for interacting with the local MLC server. */
export const mlcServer = new MLCServerService()
export type { MLCStatus }
