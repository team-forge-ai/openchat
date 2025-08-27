import { invoke } from '@tauri-apps/api/core'

// ==================== Type Definitions ====================

export interface MlcServerStatus {
  isRunning: boolean
  isHttpReady: boolean
  port?: number
  pid?: number | null
  error?: string | null
}

export interface McpServerConfigBase {
  id?: number
  name: string
  description?: string | null
  enabled: boolean
  connectTimeoutMs?: number | null
  listToolsTimeoutMs?: number | null
}

export interface McpServerConfigStdio extends McpServerConfigBase {
  transport: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string | null
}

export interface McpServerConfigHttp extends McpServerConfigBase {
  transport: 'http'
  url: string
  headers?: Record<string, string>
  auth?: string | null
  heartbeatSec?: number | null
}

export type McpServerConfig = McpServerConfigStdio | McpServerConfigHttp

export interface McpToolInfo {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface McpCheckResult {
  ok: boolean
  toolsCount?: number | null
  tools?: McpToolInfo[] | null
  warning?: string
  error?: string
}

// Internal wire types (snake_case from Rust)
interface MlcServerStatusWire {
  is_running: boolean
  is_http_ready: boolean
  port?: number
  pid?: number | null
  error?: string | null
}

interface McpCheckResultWire {
  ok: boolean
  tools_count?: number | null
  tools?: McpToolInfo[] | null
  warning?: string | null
  error?: string | null
}

// Rust payload types (snake_case sent to Rust)
type RustMcpServerConfig =
  | {
      transport: 'stdio'
      name: string
      description: string | null
      enabled: boolean
      connect_timeout_ms: number | null
      list_tools_timeout_ms: number | null
      command: string
      args?: string[]
      env?: Record<string, string>
      cwd?: string | null
    }
  | {
      transport: 'http'
      name: string
      description: string | null
      enabled: boolean
      connect_timeout_ms: number | null
      list_tools_timeout_ms: number | null
      url: string
      headers?: Record<string, string>
      auth?: string | null
      heartbeat_sec?: number | null
    }

// ==================== Conversion Utilities ====================

function convertMlcServerStatus(wire: MlcServerStatusWire): MlcServerStatus {
  return {
    isRunning: wire.is_running,
    isHttpReady: wire.is_http_ready,
    port: wire.port,
    pid: wire.pid,
    error: wire.error,
  }
}

function convertMcpCheckResult(wire: McpCheckResultWire): McpCheckResult {
  return {
    ok: wire.ok,
    toolsCount: wire.tools_count,
    tools: wire.tools,
    warning: wire.warning ?? undefined,
    error: wire.error ?? undefined,
  }
}

function toRustMcpConfig(config: McpServerConfig): RustMcpServerConfig {
  const base = {
    name: config.name,
    description: config.description ?? null,
    enabled: config.enabled,
    connect_timeout_ms: config.connectTimeoutMs ?? null,
    list_tools_timeout_ms: config.listToolsTimeoutMs ?? null,
  }

  if (config.transport === 'stdio') {
    return {
      transport: 'stdio',
      ...base,
      command: config.command,
      args: config.args ?? [],
      env: config.env ?? {},
      cwd: config.cwd ?? null,
    }
  }

  return {
    transport: 'http',
    ...base,
    url: config.url,
    headers: config.headers ?? {},
    auth: config.auth ?? null,
    heartbeat_sec: config.heartbeatSec ?? null,
  }
}

// ==================== MLC Server Management Commands ====================

/**
 * Retrieves the current status of the MLC server.
 *
 * @returns Promise resolving to the current MlcServerStatus
 * @throws If the Tauri command fails
 */
export async function mlcGetStatus(): Promise<MlcServerStatus> {
  const wire = await invoke<MlcServerStatusWire>('mlc_get_status')
  return convertMlcServerStatus(wire)
}

/**
 * Starts the MLC server process.
 *
 * @returns Promise resolving to the updated MlcServerStatus
 * @throws If the server fails to start or the command fails
 */
export async function mlcStart(): Promise<MlcServerStatus> {
  const wire = await invoke<MlcServerStatusWire>('mlc_start')
  return convertMlcServerStatus(wire)
}

/**
 * Restarts the MLC server process.
 *
 * @returns Promise resolving to the updated MlcServerStatus
 * @throws If the server fails to restart or the command fails
 */
export async function mlcRestart(): Promise<MlcServerStatus> {
  const wire = await invoke<MlcServerStatusWire>('mlc_restart')
  return convertMlcServerStatus(wire)
}

// ==================== MCP Server Commands ====================

/**
 * Checks connectivity to an MCP server and discovers its tools.
 *
 * @param config Server configuration to test
 * @returns Promise resolving to McpCheckResult with connection status and tools
 * @throws If the Tauri command fails or configuration is invalid
 */
export async function mcpCheckServer(
  config: McpServerConfig,
): Promise<McpCheckResult> {
  const payload = toRustMcpConfig(config)
  const wire = await invoke<McpCheckResultWire>('mcp_check_server', {
    config: payload,
  })
  return convertMcpCheckResult(wire)
}

/**
 * Lists all available tools for the MCP server with the given id.
 *
 * @param id The MCP server id
 * @returns Promise resolving to array of available tool descriptors
 * @throws If the server is not found, not connected, or the command fails
 */
export async function mcpListTools(id: number): Promise<McpToolInfo[]> {
  return await invoke<McpToolInfo[]>('mcp_list_tools', { id })
}

/**
 * Calls an MCP tool on the server with the given id.
 *
 * @param id The MCP server id to call the tool on
 * @param tool The tool name to execute
 * @param args Arguments to pass to the tool
 * @returns Promise resolving to the tool's string output
 * @throws If the server is not found, tool doesn't exist, or execution fails
 */
export async function mcpCallTool(
  id: number,
  tool: string,
  args: unknown,
): Promise<string> {
  return await invoke<string>('mcp_call_tool', { id, tool, args })
}

// ==================== Environment Variable Commands ====================

/**
 * Retrieves an environment variable value from the host system.
 *
 * @param name The environment variable name to retrieve
 * @returns Promise resolving to the variable value or null if not found
 * @throws If the Tauri command fails
 */
export async function getEnvVar(name: string): Promise<string | null> {
  return await invoke<string | null>('get_env_var', { name })
}

// ==================== Model Download Commands ====================

/**
 * Downloads a Hugging Face model to the local cache if not already present.
 * Emits `mlc-download-progress` events during the download process.
 *
 * @param repoId The Hugging Face model repository ID (e.g., "mlc-ai/Qwen2.5-7B-Instruct-q4f16_1-MLC")
 * @returns Promise that resolves when the download is complete or if the model is already cached
 * @throws If the download fails or the command encounters an error
 */
export async function downloadModel(repoId: string): Promise<void> {
  return await invoke('download_model', { repoId })
}
