import { useState } from 'react'

import { AppSidebar } from '@/components/AppSidebar'
import { ChatWindow } from '@/components/ChatWindow'
import { MLXServerStatus } from '@/components/mlx-server-status'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { MLXServerProvider, useMLXServer } from '@/contexts/mlx-server-context'
import { useConversations } from '@/hooks/use-conversations'
import { useMessages } from '@/hooks/use-messages'

import './App.css'

function AppContent() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)

  const { status: mlxStatus, isInitializing: isMLXInitializing } =
    useMLXServer()

  // Conversations list
  const {
    conversations,
    isLoading: isLoadingConversations,
    createConversation,
    deleteConversation,
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

  // Disable chat if MLX server is not ready
  const isChatDisabled = !mlxStatus.isRunning || isMLXInitializing

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        onCreateConversation={async () => {
          const id = await createConversation.mutateAsync()
          setSelectedConversationId(id)
        }}
        isCreatingConversation={createConversation.isLoading}
        onDeleteConversation={(conversationId) => {
          // If we're deleting the currently selected conversation,
          // auto-select the most recent remaining conversation
          if (selectedConversationId === conversationId) {
            const remainingConversations = conversations.filter(
              (c) => c.id !== conversationId,
            )
            if (remainingConversations.length > 0) {
              setSelectedConversationId(remainingConversations[0].id)
            } else {
              setSelectedConversationId(null)
            }
          }

          deleteConversation.mutate(conversationId)
        }}
        isDeletingConversation={deleteConversation.isLoading}
        isLoading={isLoadingConversations}
      />

      <SidebarInset>
        <div className="flex h-full flex-col">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1" />
            <MLXServerStatus />
          </header>

          <div className="flex-1">
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
              isDisabled={isChatDisabled}
              disabledMessage={
                isMLXInitializing
                  ? 'AI server is starting up, please wait...'
                  : !mlxStatus.isRunning
                    ? 'AI server is not available. Please check the status above.'
                    : undefined
              }
            />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function App() {
  return (
    <MLXServerProvider modelPath="models/Qwen3-0.6B-MLX-4bit">
      <AppContent />
    </MLXServerProvider>
  )
}

export default App
