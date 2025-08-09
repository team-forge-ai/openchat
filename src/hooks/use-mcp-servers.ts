import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  deleteMcpServer,
  getMcpServers,
  insertMcpServer,
  setMcpServerEnabled,
  updateMcpServer,
} from '@/lib/db/mcp-servers'
import { mcpCheckServer } from '@/lib/mcp-bridge'
import type { McpCheckResult, McpServerConfig } from '@/types/mcp'

export function useMcpServers(search?: string) {
  const queryClient = useQueryClient()

  const list = useQuery({
    queryKey: ['mcp-servers', search ?? ''],
    queryFn: () => getMcpServers(search),
  })

  const create = useMutation({
    mutationFn: (attrs: Parameters<typeof insertMcpServer>[0]) =>
      insertMcpServer(attrs),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
    },
  })

  const update = useMutation({
    mutationFn: (vars: {
      id: number
      attrs: Parameters<typeof updateMcpServer>[1]
    }) => updateMcpServer(vars.id, vars.attrs),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteMcpServer(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
    },
  })

  const setEnabled = useMutation({
    mutationFn: (vars: { id: number; enabled: boolean }) =>
      setMcpServerEnabled(vars.id, vars.enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
    },
  })

  const check = async (config: McpServerConfig): Promise<McpCheckResult> =>
    await mcpCheckServer(config)

  return {
    servers: list.data ?? [],
    isLoading: list.isFetching,
    create,
    update,
    remove,
    setEnabled,
    check,
  }
}
