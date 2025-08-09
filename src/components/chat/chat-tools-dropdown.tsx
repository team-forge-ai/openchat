import { Plus } from 'lucide-react'
import React from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMcp } from '@/hooks/use-mcp'

export const ChatToolsDropdown: React.FC = () => {
  const { toolsByServer } = useMcp()

  const flatTools = toolsByServer.flatMap(({ server, tools }) =>
    tools.map((t) => ({
      serverId: server.id,
      serverName: server.name,
      toolName: t.name,
    })),
  )

  //   const handleSelect = async (
  //     serverId: number,
  //     serverName: string,
  //     toolName: string,
  //   ) => {
  //     if (!conversationId) {
  //       return
  //     }
  //     const argsStr = window.prompt(
  //       `Args JSON for ${serverName}:${toolName}`,
  //       '{}',
  //     )
  //     if (argsStr === null) {
  //       return
  //     }
  //     let args: unknown = {}
  //     try {
  //       args = JSON.parse(argsStr)
  //     } catch {
  //       return
  //     }
  //     const output = await call.mutateAsync({ serverId, tool: toolName, args })
  //     await insertMessage({
  //       conversation_id: conversationId,
  //       role: 'assistant',
  //       content: `\n\n[tool: ${serverName}:${toolName}]\n${output}\n\n`,
  //       reasoning: null,
  //       status: 'complete',
  //     })
  //     await queryClient.invalidateQueries({
  //       queryKey: ['messages', conversationId],
  //     })
  //   }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={flatTools.length === 0}
          aria-label="Tools"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {flatTools.length === 0 ? (
          <div className="px-2 py-1 text-sm text-muted-foreground">
            No tools
          </div>
        ) : (
          flatTools.map((t) => (
            <DropdownMenuItem
              key={`${t.serverId}:${t.toolName}`}
              //   onClick={() => handleSelect(t.serverId, t.serverName, t.toolName)}
            >
              {t.serverName}: {t.toolName}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
