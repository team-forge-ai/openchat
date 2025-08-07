import {
  Loader2,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
  User,
} from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { useConversation } from '@/contexts/conversation-context'
import { useConversations } from '@/hooks/use-conversations'

import { WindowDragBar } from './Titlebar'

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
      <WindowDragBar />

      {/* Header Section */}
      <SidebarHeader className="border-b pt-0">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold">OpenChat</h1>
            <p className="text-xs text-muted-foreground">AI Assistant</p>
          </div>
        </div>

        <div className="px-2 pb-2">
          <Button
            onClick={handleCreateConversation}
            className="w-full"
            disabled={isLoadingConversations || createConversation.isLoading}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {createConversation.isLoading ? 'Creating...' : 'New Chat'}
          </Button>
        </div>
      </SidebarHeader>

      {/* Main Content */}
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
                  <SidebarMenuItem key={conversation.id} className="group">
                    <SidebarMenuButton
                      isActive={selectedConversationId === conversation.id}
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className="w-full justify-start pr-8"
                    >
                      <MessageSquare className="h-4 w-4 mr-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">
                          {conversation.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(
                            conversation.updated_at,
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    </SidebarMenuButton>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <SidebarMenuAction
                          className="opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                          disabled={deleteConversation.isLoading}
                          onClick={(e) => {
                            // If shift is pressed, skip confirmation and delete immediately
                            if (e.shiftKey) {
                              e.preventDefault()
                              e.stopPropagation()
                              handleDeleteConversation(conversation.id)
                            }
                            // Otherwise, let the AlertDialog handle the click
                          }}
                        >
                          {deleteConversation.isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </SidebarMenuAction>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete Conversation
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &ldquo;
                            {conversation.title}&rdquo;? This action cannot be
                            undone and will permanently delete the conversation
                            and all its messages.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleDeleteConversation(conversation.id)
                            }
                            disabled={deleteConversation.isLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deleteConversation.isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              'Delete'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer Section */}
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                // TODO: Implement settings functionality
                console.log('Settings clicked')
              }}
              className="w-full justify-start"
            >
              <Settings className="h-4 w-4 mr-3" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarSeparator className="my-2" />

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                // TODO: Implement user profile functionality
                console.log('User profile clicked')
              }}
              className="w-full justify-start"
            >
              <User className="h-4 w-4 mr-3" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">User</span>
                <span className="text-xs text-muted-foreground">
                  Manage account
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
