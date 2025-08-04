import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'

import { ChatWindow } from '@/components/ChatWindow'
import { ConversationList } from '@/components/ConversationList'
import type { Conversation, Message } from '@/types'
import './App.css'

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)

  // Load conversations on app start
  useEffect(() => {
    void loadConversations()
  }, [])

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      void loadMessages(selectedConversationId)
    } else {
      setMessages([])
    }
  }, [selectedConversationId])

  const loadConversations = async () => {
    try {
      setIsLoadingConversations(true)
      const loadedConversations: Conversation[] =
        await invoke('get_conversations')
      setConversations(loadedConversations)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setIsLoadingConversations(false)
    }
  }

  const loadMessages = async (conversationId: number) => {
    try {
      const loadedMessages: Message[] = await invoke('get_messages', {
        conversationId,
      })
      setMessages(loadedMessages)
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  const createConversation = async () => {
    try {
      setIsLoading(true)
      const newConversation: Conversation = await invoke(
        'create_conversation',
        {
          title: `New Chat ${new Date().toLocaleString()}`,
        },
      )

      setConversations((prev) => [newConversation, ...prev])
      setSelectedConversationId(newConversation.id)
    } catch (error) {
      console.error('Failed to create conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (content: string) => {
    if (!selectedConversationId) {
      return
    }

    try {
      setIsLoading(true)

      // Add user message to UI immediately
      const userMessage: Message = {
        id: Date.now(), // Temporary ID
        conversation_id: selectedConversationId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Send message to backend
      const aiMessage: Message = await invoke('send_message', {
        conversationId: selectedConversationId,
        content,
      })

      // Replace temporary user message and add AI response
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== userMessage.id)
        return [...withoutTemp, aiMessage]
      })

      // Reload messages to get the actual user message with proper ID
      await loadMessages(selectedConversationId)

      // Update conversations list to reflect new activity
      await loadConversations()
    } catch (error) {
      console.error('Failed to send message:', error)
      // Remove the temporary user message on error
      setMessages((prev) => prev.filter((m) => m.id !== Date.now()))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-screen flex bg-background text-foreground">
      <ConversationList
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        onCreateConversation={createConversation}
        isLoading={isLoading || isLoadingConversations}
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
