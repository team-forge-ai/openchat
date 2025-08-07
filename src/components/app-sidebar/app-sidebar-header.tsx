import { Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SidebarHeader } from '@/components/ui/sidebar'
import { WindowDragRegion } from '@/components/window-drag-region'

interface AppSidebarHeaderProps {
  onCreate: () => void
  disabled: boolean
  isCreating: boolean
}

export function AppSidebarHeader({
  onCreate,
  disabled,
}: AppSidebarHeaderProps) {
  return (
    <WindowDragRegion>
      <SidebarHeader className="border-b h-[60px] flex items-end justify-center px-3">
        <Button
          onClick={onCreate}
          disabled={disabled}
          size="sm"
          className="bg-purple-700"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </SidebarHeader>
    </WindowDragRegion>
  )
}
