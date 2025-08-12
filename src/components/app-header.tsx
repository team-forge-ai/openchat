import { MLCServerStatus } from '@/components/mlc-server-status'
import { SidebarTrigger } from '@/components/ui/sidebar'

export function AppHeader() {
  return (
    <header
      data-tauri-drag-region
      className="flex h-[60px] shrink-0 items-center gap-2 border-b px-5"
    >
      <SidebarTrigger className="-ml-2" />
      <div className="flex-1" />
      <MLCServerStatus />
    </header>
  )
}
