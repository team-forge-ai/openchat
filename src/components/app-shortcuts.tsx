import { useAppActions } from '@/hooks/use-app-actions'
import { useShortcut } from '@/hooks/use-shortcut'

export function AppShortcuts(): null {
  const { createNewConversation, toggleSettings } = useAppActions()

  // Create new conversation
  useShortcut('mod+n', () => {
    void createNewConversation()
  })

  // Toggle preferences
  useShortcut('mod+,', () => {
    toggleSettings()
  })

  return null
}

export default AppShortcuts
