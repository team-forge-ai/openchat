import { useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { useState } from 'react'

import { ChatWindow } from '@/components/ChatWindow'
import { ConversationList } from '@/components/ConversationList'
import { useConversations } from '@/hooks/use-conversations'
import { useMessages } from '@/hooks/use-messages'
import type { Message } from '@/types'
import './App.css'

function App() {
  const queryClient = useQueryClient()

  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)

  // data hooks
  const { data: conversations = [], isFetching: isLoadingConversations } =
    useConversations()

  const { data: messages = [], isFetching: isLoadingMessages } = useMessages(
    selectedConversationId ?? null,
  )

  const isLoading = isLoadingMessages

  const createConversation = async () => {
    const newConv = await invoke<any>('create_conversation', {
      title: `New Chat ${new Date().toLocaleString()}`,
    })
    // refresh list and select new
    await queryClient.invalidateQueries({ queryKey: ['conversations'] })
    setSelectedConversationId(newConv.id)
  }

  const sendMessage = async (content: string) => {
    if (!selectedConversationId) {
      return
    }

    // optimistic UI insert
    const tempMsg: Message = {
      id: Date.now(),
      conversation_id: selectedConversationId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }

    queryClient.setQueryData<Message[]>(
      ['messages', selectedConversationId],
      (old = []) => [...old, tempMsg],
    )

    await invoke('send_message', {
      conversationId: selectedConversationId,
      content,
    })

    // refresh caches
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
        onCreateConversation={createConversation}
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
