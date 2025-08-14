import React from 'react'

import { Separator } from '@/components/ui/separator'
import { SidebarInset } from '@/components/ui/sidebar'

import { McpServersSettings } from './settings/mcp-servers'
import { SystemPromptSettings } from './settings/system-prompt'

export const SettingsWindow: React.FC = () => {
  return (
    <SidebarInset className="flex-1 overflow-y-auto">
      <div className="py-8 px-6 md:px-8 space-y-12 max-w-5xl mx-auto w-full">
        <section id="system-prompt" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">System Prompt</h2>
            <p className="text-muted-foreground">
              This prompt will be used as the system role for future chats.
            </p>
          </div>
          <Separator className="my-6" />
          <SystemPromptSettings />
        </section>

        <section id="mcp-servers" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">MCP Servers</h2>
            <p className="text-muted-foreground">
              Configure and validate MCP servers. These are stored locally.
            </p>
          </div>
          <Separator className="my-6" />
          <McpServersSettings />
        </section>
      </div>
    </SidebarInset>
  )
}
