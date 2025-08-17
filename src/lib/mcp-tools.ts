import type { Tool } from '@ai-sdk/provider-utils'
import { jsonSchema } from '@ai-sdk/provider-utils'

import type { McpServerRow } from '@/types'
import type { McpToolInfo } from '@/types/mcp'

export type McpToolCaller = (
  serverId: number,
  toolName: string,
  args: unknown,
) => Promise<string>

/**
 * Builds a dynamic tools map for the AI SDK from discovered MCP tools.
 * Tool keys are generated as `mcp_<serverId>_<toolName>`.
 *
 * @param items Pairings of server row and its tools list.
 * @param callTool Callback used to execute a tool with arguments.
 * @returns A map consumable by AI SDK tool registries.
 */
export function createMcpToolsMap(
  items: { server: McpServerRow; tools: McpToolInfo[] }[],
  callTool: McpToolCaller,
): Record<string, Tool> {
  const map: Record<string, Tool> = {}

  for (const { server, tools } of items) {
    for (const t of tools) {
      const key = `mcp_${server.id}_${t.name}`
      const description =
        t.description ?? `MCP tool ${t.name} on ${server.name}`

      const inputSchema = t.inputSchema
        ? jsonSchema(t.inputSchema)
        : jsonSchema({
            type: 'object',
            properties: {},
            additionalProperties: true,
          })

      const dynamicTool: Tool = {
        type: 'dynamic',
        description,
        inputSchema,
        execute: async (params) => {
          try {
            const output = await callTool(server.id, t.name, params)
            return {
              content: [{ type: 'text', text: output }],
              isError: false,
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              content: [{ type: 'text', text: message }],
              isError: true,
            }
          }
        },
      }

      map[key] = dynamicTool
    }
  }

  return map
}
