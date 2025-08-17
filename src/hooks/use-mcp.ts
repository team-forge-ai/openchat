/**
 * React hook for interacting with configured MCP (Model Context Protocol) servers.
 *
 * Responsibilities:
 * - Loads enabled MCP servers from the local database.
 * - For each enabled server, fetches its available tools.
 * - Exposes a mutation for invoking a specific tool on a specific server.
 *
 * Data flow and caching:
 * - Servers are loaded via a query keyed by `mcp-servers-enabled`.
 * - Tools are loaded via a follow-up query keyed by `mcp-tools` and a stable
 *   list of server IDs. When the set or order of enabled servers changes, tools
 *   are refetched.
 * - Tool invocation returns the tool's string result payload.
 */
import type { UseMutationResult } from '@tanstack/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'

import { getMcpServers } from '@/lib/db/mcp-servers'
import { mcpCallTool, mcpListTools } from '@/lib/mcp-bridge'
import type { McpServerRow } from '@/types'
import type { McpToolInfo } from '@/types/mcp'

/**
 * Parameters for invoking an MCP tool via the `call` mutation.
 */
export type CallParams = {
  serverId: number
  tool: string
  args: unknown
}

/**
 * Tools available on a specific MCP server.
 */
export interface ToolsByServer {
  server: McpServerRow
  tools: McpToolInfo[]
}

/**
 * Result object returned by {@link useMcp}.
 */
export interface UseMcpResult {
  /** Enabled MCP servers. */
  servers: McpServerRow[]
  /** Tools grouped by server for the enabled servers. */
  toolsByServer: ToolsByServer[]
  /**
   * Mutation for invoking an MCP tool.
   * - `variables.serverId`: ID of the target server.
   * - `variables.tool`: Tool name.
   * - `variables.args`: Tool arguments (validated by the server/tool).
   *
   * Resolves to the tool's string result.
   */
  call: UseMutationResult<string, unknown, CallParams, unknown>
}

/**
 * Load enabled MCP servers, discover their tools, and expose a mutation to call tools.
 *
 * @returns {@link UseMcpResult}
 * @example
 * const { servers, toolsByServer, call } = useMcp()
 *
 * // invoke a tool
 * call.mutate({ serverId: 1, tool: 'search', args: { query: 'hello' } })
 */
export function useMcp(): UseMcpResult {
  const serversQ = useQuery<McpServerRow[]>({
    queryKey: ['mcp-servers-enabled'],
    queryFn: async () => {
      const all = await getMcpServers()
      return all.filter((r) => !!r.enabled)
    },
  })

  const toolsQ = useQuery<ToolsByServer[]>({
    queryKey: [
      'mcp-tools',
      (serversQ.data ?? [])
        .map((s) => s.id)
        .sort((a, b) => a - b)
        .join(','),
    ],
    enabled: !!serversQ.data?.length,
    queryFn: async () => {
      const servers = serversQ.data ?? []
      const tools = await Promise.all(
        servers.map(async (s) => ({
          server: s,
          tools: await mcpListTools(s.id),
        })),
      )

      return tools
    },
  })

  const call = useMutation<string, unknown, CallParams>({
    mutationFn: async (variables: CallParams) =>
      await mcpCallTool(variables.serverId, variables.tool, variables.args),
  })

  if (toolsQ.error) {
    console.error('toolsQ error', toolsQ.error)
  }

  if (serversQ.error) {
    console.error('serversQ error', serversQ.error)
  }

  return {
    servers: serversQ.data ?? [],
    toolsByServer: toolsQ.data ?? [],
    call,
  }
}
