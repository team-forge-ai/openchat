import { Search } from 'lucide-react'
import { useCallback, useDeferredValue, useState } from 'react'

import { Input } from '@/components/ui/input'
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar'
import { useConversation } from '@/contexts/conversation-context'
import { useConversations } from '@/hooks/use-conversations'

import { AppSidebarConversationItem } from './app-sidebar-conversation-item'

export function AppSidebarConversations() {
  const { selectedConversationId, setSelectedConversationId } =
    useConversation()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const { conversations, deleteConversation } = useConversations(deferredQuery)

  const handleSelect = useCallback(
    (id: number) => setSelectedConversationId(id),
    [setSelectedConversationId],
  )
  const handleDelete = useCallback(
    (id: number) => {
      if (selectedConversationId === id) {
        setSelectedConversationId(null)
      }
      deleteConversation.mutate(id)
    },
    [deleteConversation, selectedConversationId, setSelectedConversationId],
  )
  return (
    <SidebarContent>
      <SidebarGroup>
        <div className="pt-1 pb-3 px-1">
          <div className="relative backdrop-blur-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="h-8 rounded-full bg-muted/50 border-0 pl-9 pr-4 shadow-none focus-visible:ring-2 focus-visible:ring-ring/40 placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
            />
          </div>
        </div>

        <SidebarGroupLabel className="sr-only">
          Recent conversations
        </SidebarGroupLabel>
        <SidebarGroupContent>
          {conversations.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {query ? 'No conversations found.' : 'No conversations yet.'}
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
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                  isDeleting={deleteConversation.isLoading}
                />
              ))}
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
