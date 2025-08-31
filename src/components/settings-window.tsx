import React from 'react'

import { Separator } from '@/components/ui/separator'
import { SidebarInset } from '@/components/ui/sidebar'

import { DangerZone } from './settings/danger-zone'
import { McpServersSettings } from './settings/mcp-servers'
import { ModelDownload } from './settings/model-download'
import { ModelSelection } from './settings/model-selection'
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

        <section id="model-selection" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Model</h2>
            <p className="text-muted-foreground">
              Choose which model to use for new conversations.
            </p>
          </div>
          <Separator className="my-6" />
          <ModelSelection />
        </section>

        <section id="model-download" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Download Model
            </h2>
            <p className="text-muted-foreground">
              Download new models from Hugging Face to use in your
              conversations. Must be MLX compatible.
            </p>
          </div>
          <Separator className="my-6" />
          <ModelDownload />
        </section>

        <section id="mcp-servers" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">AI Tools</h2>
            <p className="text-muted-foreground">
              Extend the capabilities of your AI with custom MCP tools.
            </p>
          </div>
          <Separator className="my-6" />
          <McpServersSettings />
        </section>

        <section id="danger-zone" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Danger Zone</h2>
            <p className="text-muted-foreground">
              Irreversible and destructive actions.
            </p>
          </div>
          <Separator className="my-6" />
          <DangerZone />
        </section>
      </div>
    </SidebarInset>
  )
}
