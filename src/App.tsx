import { useState } from 'react'

import { ChatWindow } from '@/components/ChatWindow'
import { ConversationList } from '@/components/ConversationList'
import { useConversations } from '@/hooks/use-conversations'
import { useMessages } from '@/hooks/use-messages'

import './App.css'

function App() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)

  // Conversations list
  const {
    conversations,
    isLoading: isLoadingConversations,
    createConversation,
  } = useConversations()

  // Messages + send mutation for the selected conversation
  const {
    messages,
    isLoading: isLoadingMessages,
    sendMessage,
    isSendingMessage,
  } = useMessages(selectedConversationId ?? null)

  // Aggregate loading state: fetching or sending
  const isLoading = isLoadingMessages || isSendingMessage

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
        onSendMessage={async (content) => {
          if (selectedConversationId) {
            await sendMessage({
              conversationId: selectedConversationId,
              content,
            })
          }
        }}
        isLoading={isLoading}
        conversationId={selectedConversationId}
      />
    </div>
  )
}

export default App
