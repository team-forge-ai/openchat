import React, { useState } from 'react'

import { useAppContext } from '@/contexts/app-context'
import { useMLCServer } from '@/contexts/mlc-server-context'
import { useConversations } from '@/hooks/use-conversations'
import { useMessages } from '@/hooks/use-messages'

import { ChatErrorBanner } from './chat-error-banner'
import { ChatInput } from './chat-input'
import { ChatMessagesList } from './chat-messages-list'

export const ChatWindow: React.FC = () => {
  const [error, setError] = useState<string | null>(null)
  const { selectedConversationId, setSelectedConversationId } = useAppContext()

  const {
    messages,
    isLoading: isLoadingMessages,
    sendMessage,
    isSendingMessage,
    abortStreaming,
  } = useMessages(selectedConversationId)

  const { createConversation } = useConversations()
  const { isReady } = useMLCServer()
  const isChatDisabled = !isReady

  // Aggregate loading state: fetching or sending
  const isLoading = isLoadingMessages || isSendingMessage

  const handleSubmit = async (text: string) => {
    if (!text.trim() || isLoading || isChatDisabled) {
      return
    }

    const messageContent = text.trim()
    setError(null)

    try {
      let currentConversationId = selectedConversationId

      // If no conversation is selected, create a new one
      if (!currentConversationId) {
        const newId = await createConversation.mutateAsync()
        setSelectedConversationId(newId)
        currentConversationId = newId
      }

      await sendMessage({
        conversationId: currentConversationId,
        content: messageContent,
      })
    } catch (error) {
      console.error('Error sending message', error)

      setError(
        error instanceof Error ? error.message : 'Failed to send message',
      )
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ChatMessagesList messages={messages} isLoading={isLoading} />

      {error && <ChatErrorBanner error={error} />}

      <ChatInput
        onSubmit={handleSubmit}
        disabled={isLoading || isChatDisabled}
        focusKey={selectedConversationId ?? 0}
        isLoading={isLoading}
        onAbort={abortStreaming}
      />
    </div>
  )
}
