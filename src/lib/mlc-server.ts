import type { UnlistenFn } from '@tauri-apps/api/event'

import {
  mlcGetStatus,
  mlcRestart,
  mlcStart,
  type MlcServerStatus,
} from '@/lib/commands'
import { subscribeToMlcStatusChanges } from '@/lib/events'
import type { Model } from '@/types/mlc-server'
import { ModelsResponseSchema } from '@/types/mlc-server'

/**
 * Service responsible for tracking MLC server status via Tauri events and
 * exposing a convenience API for consumers (status listeners, restart,
 * endpoint/model access, and a readiness promise).
 */
class MLCServerService {
  private currentStatus: MlcServerStatus | null = null
  private tauriUnlisten: UnlistenFn | null = null
  private listeners = new Set<(status: MlcServerStatus) => void>()
  private startPromise: Promise<MlcServerStatus> | null = null

  async initializeEventListeners(): Promise<void> {
    if (this.tauriUnlisten) {
      return
    }
    this.tauriUnlisten = await subscribeToMlcStatusChanges((status) => {
      this.currentStatus = status

      for (const handler of this.listeners) {
        handler(status)
      }
    })
  }

  /** Adds a status listener. Returns a disposer to unsubscribe. */
  addStatusListener(handler: (status: MlcServerStatus) => void): () => void {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  /** Retrieves the latest status via Tauri command and caches it. */
  async fetchStatus(): Promise<MlcServerStatus> {
    const status = await mlcGetStatus()
    this.currentStatus = status

    return status
  }

  /** Starts the MLC server process and returns the immediate status. */
  async start(): Promise<MlcServerStatus> {
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

  private async performStart(): Promise<MlcServerStatus> {
    const status = await mlcStart()
    this.currentStatus = status

    return status
  }

  /** Restarts the MLC server process and returns the immediate status. */
  async restart(): Promise<MlcServerStatus> {
    const status = await mlcRestart()
    this.currentStatus = status

    return status
  }

  /** True when the server is running and an HTTP port is available. */
  get isReady(): boolean {
    return Boolean(
      this.currentStatus?.isRunning &&
        this.currentStatus?.isHttpReady &&
        this.currentStatus?.port,
    )
  }

  /** Gets the current cached status or null if not available */
  get status(): MlcServerStatus {
    if (this.currentStatus) {
      return this.currentStatus
    }

    // Fallback for when status hasn't been fetched yet
    return {
      isRunning: false,
      isHttpReady: false,
      port: undefined,
      pid: null,
      error: null,
    }
  }

  /** Returns the base HTTP endpoint for the local MLC server, or null. */
  get endpoint(): string | null {
    if (!this.currentStatus?.port) {
      return null
    }
    return `http://127.0.0.1:${this.currentStatus.port}`
  }

  /** Resolves once the server is ready; caches current readiness when true. */
  get waitForReady(): Promise<MlcServerStatus> {
    if (
      this.currentStatus?.isRunning &&
      this.currentStatus?.isHttpReady &&
      this.currentStatus?.port
    ) {
      return Promise.resolve(this.currentStatus)
    }

    return new Promise<MlcServerStatus>((resolve) => {
      let done = false
      const unlisten = this.addStatusListener((s) => {
        if (!done && s.isRunning && s.isHttpReady && s.port) {
          done = true
          unlisten()
          resolve(s)
        }
      })
    })
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
export type { MlcServerStatus }
