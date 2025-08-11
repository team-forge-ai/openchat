import type { MLXServerStatus } from '@/types/mlx-server'

// Event handler helpers for Tauri events
export function convertRustStatusToJS(rustStatus: {
  is_running: boolean
  is_http_ready: boolean
  port?: number
  pid?: number
  error?: string
}): MLXServerStatus {
  return {
    isRunning: rustStatus.is_running,
    isHttpReady: rustStatus.is_http_ready,
    isModelReady: false,
    port: rustStatus.port,
    pid: rustStatus.pid ?? null,
  }
}
