import type { QueryClient } from '@tanstack/react-query'

import { getMessagesForChat, updateConversationTitleIfUnset } from '@/lib/db'
import { generateConversationTitle } from '@/lib/generate-conversation-name'
import type { ChatMessage } from '@/types/mlx-server'

export async function setConversationTitleIfUnset(
  queryClient: QueryClient,
  conversationId: number,
): Promise<void> {
  try {
    const chatMessages: ChatMessage[] = (
      await getMessagesForChat(conversationId)
    ).map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }))

    const maybeTitle = await generateConversationTitle(chatMessages)
    if (!maybeTitle) {
      return
    }

    const updated = await updateConversationTitleIfUnset(
      conversationId,
      maybeTitle,
    )
    if (updated) {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  } catch (e) {
    console.warn('Failed to set conversation title', e)
  }
}
