import { SquarePen } from 'lucide-react'
import { useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { SidebarHeader } from '@/components/ui/sidebar'
import { WindowDragRegion } from '@/components/window-drag-region'
import { useAppContext } from '@/contexts/app-context'
import { useConversations } from '@/hooks/use-conversations'

export function AppSidebarHeader() {
  const { setSelectedConversationId } = useAppContext()
  const { isLoading, createConversation } = useConversations()

  const handleCreate = useCallback(async () => {
    const id = await createConversation.mutateAsync()
    setSelectedConversationId(id)
  }, [createConversation, setSelectedConversationId])

  return (
    <WindowDragRegion>
      <SidebarHeader className="border-b h-[60px] flex items-end justify-center px-3">
        <Button
          onClick={handleCreate}
          disabled={isLoading || createConversation.isLoading}
          size="sm"
          variant="ghost"
          title="New chat"
        >
          <SquarePen className="h-4 w-4" />
        </Button>
      </SidebarHeader>
    </WindowDragRegion>
  )
}
