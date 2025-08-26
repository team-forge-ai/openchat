import { useEffect } from 'react'

import { useAppActions } from '@/hooks/use-app-actions'
import { MENU_NEW_CHAT, MENU_OPEN_SETTINGS, MENU_RELOAD } from '@/lib/events'

export function AppMenuEvents(): null {
  const { createNewConversation, openSettings } = useAppActions()

  useEffect(() => {
    const handleNewChat = () => {
      void createNewConversation()
    }
    const handleOpenSettings = () => {
      openSettings()
    }

    window.addEventListener(MENU_NEW_CHAT, handleNewChat as EventListener)
    window.addEventListener(
      MENU_OPEN_SETTINGS,
      handleOpenSettings as EventListener,
    )
    const handleReload = () => {
      window.location.reload()
    }
    window.addEventListener(MENU_RELOAD, handleReload as EventListener)

    return () => {
      window.removeEventListener(MENU_NEW_CHAT, handleNewChat as EventListener)
      window.removeEventListener(
        MENU_OPEN_SETTINGS,
        handleOpenSettings as EventListener,
      )
      window.removeEventListener(MENU_RELOAD, handleReload as EventListener)
    }
  }, [createNewConversation, openSettings])

  return null
}

export default AppMenuEvents
