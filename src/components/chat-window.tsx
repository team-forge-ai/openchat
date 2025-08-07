import React, { useState } from 'react'

import { useConversation } from '@/contexts/conversation-context'
import { useMLXServer } from '@/contexts/mlx-server-context'
import { useConversations } from '@/hooks/use-conversations'
import { useMessages } from '@/hooks/use-messages'

import { ChatErrorBanner } from './chat-error-banner'
import { ChatInput } from './chat-input'
import { ChatMessagesList } from './chat-messages-list'

export const ChatWindow: React.FC = () => {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { selectedConversationId, setSelectedConversationId } =
    useConversation()

  const {
    messages,
    isLoading: isLoadingMessages,
    sendMessage,
    isSendingMessage,
  } = useMessages(selectedConversationId)

  const { createConversation } = useConversations()
  const { status: mlxStatus } = useMLXServer()
  const isChatDisabled = !mlxStatus.isRunning || !mlxStatus.isReady

  // Aggregate loading state: fetching or sending
  const isLoading = isLoadingMessages || isSendingMessage

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading || isChatDisabled) {
      return
    }

    const messageContent = inputValue.trim()
    setInputValue('')
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
      // Re-set the input value if the message failed to send
      setInputValue(messageContent)
      setError(
        error instanceof Error ? error.message : 'Failed to send message',
      )
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit(e)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ChatMessagesList messages={messages} isLoading={isLoading} />
      {error && <ChatErrorBanner error={error} />}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        onEnterKey={handleKeyDown}
        disabled={isLoading || isChatDisabled}
        focusKey={selectedConversationId ?? 0}
        isLoading={isLoading}
      />
    </div>
  )
}
