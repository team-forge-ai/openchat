import { invoke } from '@tauri-apps/api/core'

import type { McpCheckResult, McpServerConfig, McpToolInfo } from '@/types/mcp'

export async function mcpCheckServer(
  config: McpServerConfig,
): Promise<McpCheckResult> {
  const payload = transformConfigToRust(config)
  return await invoke<McpCheckResult>('mcp_check_server', { config: payload })
}

function transformConfigToRust(
  config: McpServerConfig,
): Record<string, unknown> {
  const base = {
    name: config.name,
    description: config.description ?? null,
    enabled: config.enabled,
    transport: config.transport,
    connect_timeout_ms: config.connectTimeoutMs ?? null,
    list_tools_timeout_ms: config.listToolsTimeoutMs ?? null,
  }

  if (config.transport === 'stdio') {
    return {
      ...base,
      command: config.command,
      args: config.args ?? [],
      env: config.env ?? {},
      cwd: config.cwd ?? null,
    }
  }

  // http
  return {
    ...base,
    url: config.url,
    headers: config.headers ?? {},
    auth: config.auth ?? null,
    heartbeat_sec: config.heartbeatSec ?? null,
  }
}

/**
 * Lists all available tools for the MCP server with the given ID.
 * @param id - The MCP server ID to list tools for
 * @returns A promise that resolves to an array of tool information
 */
export async function mcpListTools(id: number): Promise<McpToolInfo[]> {
  return await invoke<McpToolInfo[]>('mcp_list_tools', { id })
}

/**
 * Calls an MCP tool on the server with the given ID.
 * @param id - The MCP server ID to call the tool on
 * @param tool - The name of the tool to call
 * @param args - The arguments to pass to the tool
 * @returns A promise that resolves to the tool's response as a string
 */
export async function mcpCallTool(
  id: number,
  tool: string,
  args: unknown,
): Promise<string> {
  return await invoke<string>('mcp_call_tool', { id, tool, args })
}
