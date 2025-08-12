import { AppHeader } from '@/components/app-header'
import { AppShortcuts } from '@/components/app-shortcuts'
import { AppSidebar } from '@/components/app-sidebar'
import { ChatWindow } from '@/components/chat-window'
import { SettingsSidebar } from '@/components/settings-sidebar'
import { SettingsWindow } from '@/components/settings-window'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppContextProvider, useAppContext } from '@/contexts/app-context'
import { MLCServerProvider } from '@/contexts/mlc-server-context'

import './App.css'

function AppContent() {
  const { view } = useAppContext()
  return (
    <div className="h-screen flex flex-col select-none">
      <div className="flex-1 overflow-hidden flex flex-col">
        <SidebarProvider defaultOpen={true}>
          {view === 'conversations' ? <AppSidebar /> : <SettingsSidebar />}

          <SidebarInset>
            <div className="flex h-full flex-col overflow-hidden">
              <AppHeader />

              <div className="flex-1 flex flex-col overflow-hidden">
                {view === 'conversations' ? <ChatWindow /> : <SettingsWindow />}
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
    <MLCServerProvider>
      <AppContextProvider>
        <AppShortcuts />
        <AppContent />
      </AppContextProvider>
    </MLCServerProvider>
  )
}

export default App
