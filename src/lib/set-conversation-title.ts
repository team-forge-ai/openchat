import type { QueryClient } from '@tanstack/react-query'

import {
  getConversation,
  updateConversationTitleIfUnset,
} from '@/lib/db/conversations'
import { getMessagesForChat } from '@/lib/db/messages'
import { generateConversationTitle } from '@/lib/generate-conversation-title'
import type { ChatMessage } from '@/types/mlx-server'

export async function setConversationTitleIfUnset(
  queryClient: QueryClient,
  conversationId: number,
): Promise<void> {
  // Return early if the conversation already has a title
  const conversation = await getConversation(conversationId)

  if (conversation.title) {
    console.log('Conversation already has a title, skipping')
    return
  }

  const chatMessages: ChatMessage[] = (
    await getMessagesForChat(conversationId)
  ).map((m) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content,
  }))

  console.log('Generating title for conversation', conversationId)

  const maybeTitle = await generateConversationTitle(chatMessages)

  if (!maybeTitle) {
    console.log('No title generated, skipping')
    return
  }

  const updated = await updateConversationTitleIfUnset(
    conversationId,
    maybeTitle,
  )
  if (updated) {
    await queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }
}
