import { invoke } from '@tauri-apps/api/core'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { listen } from '@tauri-apps/api/event'

import { createMlcClient } from '@/lib/mlc-client'
import type { MLCServerStatusWire, MLCStatus } from '@/types/mlc-server'

function fromWire(status: MLCServerStatusWire): MLCStatus {
  return {
    isReady: Boolean(status.is_running && status.is_http_ready),
    port: status.port,
    modelPath: status.model_path,
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

  async initializeEventListeners(): Promise<void> {
    if (this.tauriUnlisten) {
      return
    }
    this.tauriUnlisten = await listen<MLCServerStatusWire>(
      'mlc-status-changed',
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
  get model() {
    const endpoint = this.endpoint
    const modelPath = this.currentStatus?.modelPath

    if (!endpoint || !modelPath) {
      throw new Error('MLC endpoint is not available')
    }

    return createMlcClient({ modelId: modelPath, endpoint })
  }
}

/** Singleton service entry point for interacting with the local MLC server. */
export const mlxServer = new MLCServerService()
export type { MLCStatus }
