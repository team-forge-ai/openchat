import { useCallback } from 'react'

import { useAppContext } from '@/contexts/app-context'
import { useConversations } from '@/hooks/use-conversations'

/**
 * useAppActions
 *
 * Returns imperative actions for common app-level behaviors:
 * - create a new conversation and select it
 * - toggle the settings view
 * - open the settings view
 *
 * @returns An object with action callbacks: `createNewConversation()`, `toggleSettings()`, `openSettings()`.
 */
export function useAppActions() {
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

  const toggleSettings = useCallback(() => {
    setView(view === 'settings' ? 'conversations' : 'settings')
  }, [setView, view])

  const openSettings = useCallback(() => {
    if (view !== 'settings') {
      setView('settings')
    }
  }, [setView, view])

  return {
    createNewConversation,
    toggleSettings,
    openSettings,
  }
}
