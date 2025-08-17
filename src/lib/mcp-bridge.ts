import { invoke } from '@tauri-apps/api/core'
import { z } from 'zod'

import type { McpCheckResult, McpServerConfig, McpToolInfo } from '@/types/mcp'

/**
 * Checks connectivity to an MCP server and discovers its tools.
 *
 * Internally invokes the Tauri `mcp_check_server` command, validates the
 * snake_case Rust payload with zod, and returns a camelCase `McpCheckResult`.
 *
 * - For `transport: 'stdio'`, relevant fields are: `command`, `args?`, `env?`, `cwd?`.
 * - For `transport: 'http'`, relevant fields are: `url`, `headers?`, `auth?`, `heartbeatSec?`.
 * - Optional: `connectTimeoutMs?`, `listToolsTimeoutMs?`.
 *
 * Returns an object including `ok`, `toolsCount`, optional `tools`, and
 * optional `warning`/`error` for diagnostics.
 *
 * Throws if the Tauri command fails or if the payload from Rust does not match
 * the expected shape.
 *
 * @param config Server configuration to test
 * @returns Promise resolving to {@link McpCheckResult}
 */
export async function mcpCheckServer(
  config: McpServerConfig,
): Promise<McpCheckResult> {
  const payload = toRustConfigPayload(config)
  const raw = await invoke<unknown>('mcp_check_server', {
    config: payload,
  })
  return normalizeCheckResult(raw)
}

// Rust payload types (snake_case) sent over Tauri invoke
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

function toRustConfigPayload(config: McpServerConfig): RustMcpServerConfig {
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

// Validate and normalize Rust result (snake_case) → TS (camelCase)
const RustMcpToolInfoSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  // Tools may include a JSON schema describing their input. Accept any object.
  inputSchema: z.record(z.unknown()).optional(),
})

const RustMcpCheckResultSchema = z.object({
  ok: z.boolean(),
  tools_count: z.number().optional(),
  tools: z.array(RustMcpToolInfoSchema).optional(),
  warning: z.string().optional(),
  error: z.string().optional(),
})

function normalizeCheckResult(raw: unknown): McpCheckResult {
  const value = RustMcpCheckResultSchema.parse(raw)

  return {
    ok: value.ok,
    toolsCount: value.tools_count,
    tools: (value.tools as McpToolInfo[] | undefined) ?? undefined,
    warning: value.warning,
    error: value.error,
  }
}

/**
 * Lists all available tools for the MCP server with the given id.
 *
 * @param id The MCP server id.
 * @returns The list of tool descriptors available on the server.
 */
export async function mcpListTools(id: number): Promise<McpToolInfo[]> {
  return await invoke<McpToolInfo[]>('mcp_list_tools', { id })
}

/**
 * Calls an MCP tool on the server with the given id.
 *
 * @param id The MCP server id to call the tool on.
 * @param tool The tool name to execute.
 * @param args Arguments to pass to the tool.
 * @returns The tool's string output; rejects on transport or server errors.
 */
export async function mcpCallTool(
  id: number,
  tool: string,
  args: unknown,
): Promise<string> {
  console.log('[mcpCallTool] Invoking', { id, tool, args })
  const result = await invoke<string>('mcp_call_tool', { id, tool, args })
  console.log('[mcpCallTool] Result', result)
  return result
}
