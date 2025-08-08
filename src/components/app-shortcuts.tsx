import { useCallback } from 'react'

import { useAppContext } from '@/contexts/app-context'
import { useConversations } from '@/hooks/use-conversations'
import { useShortcut } from '@/hooks/use-shortcut'

export function AppShortcuts(): null {
  const { setSelectedConversationId } = useAppContext()
  const { createConversation, isLoading } = useConversations()

  const createNewConversation = useCallback(async () => {
    if (isLoading) {
      return
    }
    try {
      const id = await createConversation.mutateAsync()
      setSelectedConversationId(id)
    } catch (error) {
      console.error('Failed to create new conversation', error)
    }
  }, [createConversation, isLoading, setSelectedConversationId])

  useShortcut('mod+n', () => {
    void createNewConversation()
  })

  return null
}

export default AppShortcuts
