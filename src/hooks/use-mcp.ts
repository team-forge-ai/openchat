import { useMutation, useQuery } from '@tanstack/react-query'

import { getMcpServers } from '@/lib/db/mcp-servers'
import { mcpCallTool, mcpListTools } from '@/lib/mcp-bridge'
import type { McpServerRow } from '@/types'
import type { McpToolInfo } from '@/types/mcp'

export function useMcp() {
  const serversQ = useQuery<McpServerRow[]>({
    queryKey: ['mcp-servers-enabled'],
    queryFn: async () => {
      const all = await getMcpServers()
      return all.filter((r) => !!r.enabled)
    },
  })

  const toolsQ = useQuery<{ server: McpServerRow; tools: McpToolInfo[] }[]>({
    queryKey: ['mcp-tools', serversQ.data?.map((s) => s.id).join(',')],
    enabled: !!serversQ.data?.length,
    queryFn: async () => {
      const servers = serversQ.data ?? []
      return await Promise.all(
        servers.map(async (s) => ({
          server: s,
          tools: await mcpListTools(s.id),
        })),
      )
    },
  })

  const call = useMutation({
    mutationFn: async (p: { serverId: number; tool: string; args: unknown }) =>
      await mcpCallTool(p.serverId, p.tool, p.args),
  })

  return {
    servers: serversQ.data ?? [],
    toolsByServer: toolsQ.data ?? [],
    call,
  }
}
