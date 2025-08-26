import type { QueryClient } from '@tanstack/react-query'
import type { ModelMessage } from 'ai'

import {
  getConversation,
  updateConversationTitleIfUnset,
} from '@/lib/db/conversations'
import { getMessagesForChat } from '@/lib/db/messages'
import { generateConversationTitle } from '@/lib/generate-conversation-title'

/**
 * Generates and sets a conversation title if none exists.
 * Uses recent messages to produce a short title with the local model.
 * Invalidates the `conversations` query on success.
 *
 * @param queryClient React Query client used to invalidate caches.
 * @param conversationId The conversation identifier.
 */
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

  const chatMessages: ModelMessage[] = await getMessagesForChat(conversationId)

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
