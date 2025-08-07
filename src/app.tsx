import { AppSidebar } from '@/components/app-sidebar'
import { ChatWindow } from '@/components/chat-window'
import { MLXServerStatus } from '@/components/mlx-server-status'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { ConversationProvider } from '@/contexts/conversation-context'
import { MLXServerProvider } from '@/contexts/mlx-server-context'

import './App.css'
import { WindowDragRegion } from './components/window-drag-region'

function AppContent() {
  return (
    <div className="h-screen flex flex-col select-none">
      <div className="flex-1 overflow-hidden flex flex-col">
        <SidebarProvider defaultOpen={true}>
          <AppSidebar />

          <SidebarInset>
            <div className="flex h-full flex-col overflow-hidden">
              <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1" />
                <div className="flex-1" />
                <MLXServerStatus />
              </header>

              <div className="flex-1 flex flex-col overflow-hidden">
                <ChatWindow />
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  )
}

function App() {
  return (
    <MLXServerProvider>
      <ConversationProvider>
        <WindowDragRegion className="fixed z-100 top-0 left-0 w-full h-8" />

        <AppContent />
      </ConversationProvider>
    </MLXServerProvider>
  )
}

export default App
