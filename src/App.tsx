import { AppSidebar } from '@/components/AppSidebar'
import { ChatWindow } from '@/components/ChatWindow'
import { MLXServerStatus } from '@/components/mlx-server-status'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { ConversationProvider } from '@/contexts/conversation-context'
import { MLXServerProvider } from '@/contexts/mlx-server-context'

import './App.css'

function AppContent() {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />

      <SidebarInset>
        <div className="flex h-full flex-col">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1" />
            <MLXServerStatus />
          </header>

          <div className="flex-1">
            <ChatWindow />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function App() {
  return (
    <MLXServerProvider>
      <ConversationProvider>
        <AppContent />
      </ConversationProvider>
    </MLXServerProvider>
  )
}

export default App
