import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ChatWindow } from '@/components/ChatWindow'
import { ConversationList } from '@/components/ConversationList'
import { useAssistantResponder } from '@/hooks/use-assistant-response'
import { useConversations } from '@/hooks/use-conversations'
import { useMessages } from '@/hooks/use-messages'

import './App.css'

function App() {
  const queryClient = useQueryClient()

  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)

  // data hooks
  const {
    conversations,
    isLoading: isLoadingConversations,
    createConversation,
  } = useConversations()

  const {
    messages,
    isLoading: isLoadingMessages,
    addMessage,
  } = useMessages(selectedConversationId ?? null)

  const { generate } = useAssistantResponder()

  const isLoading = isLoadingMessages

  const sendMessage = async (content: string) => {
    if (!selectedConversationId) {
      return
    }

    // Insert user message locally
    await addMessage(selectedConversationId, 'user', content)

    // Ask assistant service for a reply
    const aiContent = await generate(selectedConversationId)

    // Insert assistant message locally
    await addMessage(selectedConversationId, 'assistant', aiContent)

    // Refresh caches
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['messages', selectedConversationId],
      }),
      queryClient.invalidateQueries({ queryKey: ['conversations'] }),
    ])
  }

  return (
    <div className="h-screen flex bg-background text-foreground">
      <ConversationList
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        onCreateConversation={async () => {
          const id = await createConversation()
          setSelectedConversationId(id)
        }}
        isLoading={isLoadingConversations}
      />

      <ChatWindow
        messages={messages}
        onSendMessage={sendMessage}
        isLoading={isLoading}
        conversationId={selectedConversationId}
      />
    </div>
  )
}

export default App
