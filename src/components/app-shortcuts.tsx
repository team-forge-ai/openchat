import { useCallback } from 'react'

import { useAppContext } from '@/contexts/app-context'
import { useConversations } from '@/hooks/use-conversations'
import { useShortcut } from '@/hooks/use-shortcut'

export function AppShortcuts(): null {
  const { setSelectedConversationId, view, setView } = useAppContext()
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

  // Create new conversation
  useShortcut('mod+n', () => {
    void createNewConversation()
  })

  // Toggle preferences
  useShortcut('mod+,', () => {
    setView(view === 'settings' ? 'conversations' : 'settings')
  })

  return null
}

export default AppShortcuts
