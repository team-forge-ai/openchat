import { AppSidebarConversations } from '@/components/app-sidebar/app-sidebar-conversations'
import { AppSidebarFooter } from '@/components/app-sidebar/app-sidebar-footer'
import { AppSidebarHeader } from '@/components/app-sidebar/app-sidebar-header'
import { Sidebar } from '@/components/ui/sidebar'
import { useConversation } from '@/contexts/conversation-context'
import { useConversations } from '@/hooks/use-conversations'

export function AppSidebar() {
  const { selectedConversationId, setSelectedConversationId } =
    useConversation()
  const {
    conversations,
    isLoading: isLoadingConversations,
    createConversation,
    deleteConversation,
  } = useConversations()

  const handleCreateConversation = async () => {
    const id = await createConversation.mutateAsync()
    setSelectedConversationId(id)
  }

  const handleDeleteConversation = (conversationId: number) => {
    deleteConversation.mutate(conversationId)
  }

  return (
    <Sidebar>
      <AppSidebarHeader
        onCreate={handleCreateConversation}
        disabled={isLoadingConversations || createConversation.isLoading}
        isCreating={createConversation.isLoading}
      />
      <AppSidebarConversations
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelect={setSelectedConversationId}
        onDelete={handleDeleteConversation}
        isDeleting={deleteConversation.isLoading}
      />
      <AppSidebarFooter />
    </Sidebar>
  )
}
