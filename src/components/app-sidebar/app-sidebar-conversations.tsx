import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar'
import type { Conversation } from '@/types'

import { AppSidebarConversationItem } from './app-sidebar-conversation-item'

interface AppSidebarConversationsProps {
  conversations: Conversation[]
  selectedConversationId: number | null
  onSelect: (id: number) => void
  onDelete: (id: number) => void
  isDeleting: boolean
}

export function AppSidebarConversations({
  conversations,
  selectedConversationId,
  onSelect,
  onDelete,
  isDeleting,
}: AppSidebarConversationsProps) {
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Recent Conversations</SidebarGroupLabel>
        <SidebarGroupContent>
          {conversations.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No conversations yet.
              <br />
              Start a new chat to get started.
            </div>
          ) : (
            <SidebarMenu>
              {conversations.map((conversation) => (
                <AppSidebarConversationItem
                  key={conversation.id}
                  id={conversation.id}
                  title={conversation.title}
                  updatedAt={conversation.updated_at}
                  isActive={selectedConversationId === conversation.id}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  isDeleting={isDeleting}
                />
              ))}
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
