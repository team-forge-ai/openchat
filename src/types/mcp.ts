export type McpTransport = 'stdio' | 'websocket' | 'http'

export interface McpServerBase {
  id?: number
  name: string
  description?: string | null
  enabled: boolean
  connectTimeoutMs?: number | null
  listToolsTimeoutMs?: number | null
}

export interface McpServerStdio extends McpServerBase {
  transport: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string | null
}

export interface McpServerWebSocket extends McpServerBase {
  transport: 'websocket'
  url: string
  headers?: Record<string, string>
  auth?: string | null
  heartbeatSec?: number | null
}

export interface McpServerHttp extends McpServerBase {
  transport: 'http'
  url: string
  headers?: Record<string, string>
  auth?: string | null
  heartbeatSec?: number | null
}

export type McpServerConfig =
  | McpServerStdio
  | McpServerWebSocket
  | McpServerHttp

export interface McpToolInfo {
  name: string
  description?: string
  inputSchema?: unknown
}

export interface McpCheckResult {
  ok: boolean
  toolsCount?: number
  tools?: McpToolInfo[]
  warning?: string
  error?: string
}
