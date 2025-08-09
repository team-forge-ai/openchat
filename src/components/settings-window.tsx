import React from 'react'

import { Separator } from '@/components/ui/separator'
import { SidebarInset } from '@/components/ui/sidebar'

import { SystemPromptSettings } from './settings/system-prompt'

export const SettingsWindow: React.FC = () => {
  return (
    <SidebarInset>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="py-8 px-6 md:px-8 space-y-12 max-w-5xl mx-auto w-full">
            <section id="system-prompt" className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  System Prompt
                </h2>
                <p className="text-muted-foreground">
                  This prompt will be used as the system role for future chats.
                </p>
              </div>
              <Separator className="my-6" />
              <SystemPromptSettings />
            </section>
          </div>
        </div>
      </div>
    </SidebarInset>
  )
}
