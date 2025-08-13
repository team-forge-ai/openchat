export type McpTransport = 'stdio' | 'http'

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

export interface McpServerHttp extends McpServerBase {
  transport: 'http'
  url: string
  headers?: Record<string, string>
  auth?: string | null
  heartbeatSec?: number | null
}

export type McpServerConfig = McpServerStdio | McpServerHttp

export interface McpToolInfo {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface McpCheckResult {
  ok: boolean
  toolsCount?: number
  tools?: McpToolInfo[]
  warning?: string
  error?: string
}
