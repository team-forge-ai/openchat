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

  addStatusListener(handler: (status: MLCStatus) => void): () => void {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  async fetchStatus(): Promise<MLCStatus> {
    const wire = await invoke<MLCServerStatusWire>('mlc_get_status')
    const status = fromWire(wire)
    this.currentStatus = status

    return status
  }

  async restart(): Promise<MLCStatus> {
    const wire = await invoke<MLCServerStatusWire>('mlc_restart')
    const status = fromWire(wire)
    this.currentStatus = status

    return status
  }

  get isReady(): boolean {
    return Boolean(this.currentStatus?.isReady && this.currentStatus?.port)
  }

  get endpoint(): string | null {
    if (!this.currentStatus?.port) {
      return null
    }
    return `http://127.0.0.1:${this.currentStatus.port}`
  }

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

  get model() {
    const endpoint = this.endpoint
    const modelPath = this.currentStatus?.modelPath

    if (!endpoint || !modelPath) {
      throw new Error('MLC endpoint is not available')
    }

    return createMlcClient({ modelId: modelPath, endpoint })
  }
}

export const mlxServer = new MLCServerService()
export type { MLCStatus }
