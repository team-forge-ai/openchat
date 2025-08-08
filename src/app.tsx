import { AppHeader } from '@/components/app-header'
import { AppShortcuts } from '@/components/app-shortcuts'
import { AppSidebar } from '@/components/app-sidebar'
import { ChatWindow } from '@/components/chat-window'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppContextProvider } from '@/contexts/app-context'
import { MLXServerProvider } from '@/contexts/mlx-server-context'

import './App.css'

function AppContent() {
  return (
    <div className="h-screen flex flex-col select-none">
      <div className="flex-1 overflow-hidden flex flex-col">
        <SidebarProvider defaultOpen={true}>
          <AppSidebar />

          <SidebarInset>
            <div className="flex h-full flex-col overflow-hidden">
              <AppHeader />

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
      <AppContextProvider>
        <AppShortcuts />
        <AppContent />
      </AppContextProvider>
    </MLXServerProvider>
  )
}

export default App
