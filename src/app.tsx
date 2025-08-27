import { AppHeader } from '@/components/app-header'
import { AppMenuEvents } from '@/components/app-menu-events'
import { AppShortcuts } from '@/components/app-shortcuts'
import { AppSidebar } from '@/components/app-sidebar'
import { ChatWindow } from '@/components/chat-window'
import { SettingsSidebar } from '@/components/settings-sidebar'
import { SettingsWindow } from '@/components/settings-window'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { AppContextProvider, useAppContext } from '@/contexts/app-context'
import { DownloadProgressProvider } from '@/contexts/download-progress-context'
import { ModelManagerProvider } from '@/contexts/model-manager-context'
import { useDownloadToasts } from '@/hooks/use-download-toast'

import './App.css'

function AppContent() {
  const { view } = useAppContext()

  // Automatically manage download toasts
  useDownloadToasts()

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
    <ModelManagerProvider>
      <DownloadProgressProvider>
        <AppContextProvider>
          <AppMenuEvents />
          <AppShortcuts />
          <AppContent />
          <Toaster />
        </AppContextProvider>
      </DownloadProgressProvider>
    </ModelManagerProvider>
  )
}

export default App
