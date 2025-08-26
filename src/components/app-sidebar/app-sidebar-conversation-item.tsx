import { Copy, Loader2, MoreVertical, Trash2 } from 'lucide-react'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useConversationExport } from '@/hooks/use-conversation-export'

interface AppSidebarConversationItemProps {
  id: number
  title: string | null
  updatedAt: string
  isActive: boolean
  onSelect: (id: number) => void
  onDelete: (id: number) => void
  isDeleting: boolean
}

export function AppSidebarConversationItem({
  id,
  title,
  updatedAt,
  isActive,
  onSelect,
  onDelete,
  isDeleting,
}: AppSidebarConversationItemProps) {
  const { copyAsMarkdown, isCopying } = useConversationExport()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => onSelect(id)}
        className="w-full justify-start pr-8"
      >
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium">{title || 'Untitled'}</div>
          <time className="sr-only">
            {new Date(updatedAt).toLocaleDateString()}
          </time>
        </div>
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction className="opacity-0 group-hover/menu-item:opacity-100 transition duration-75 text-muted-foreground/50">
            {isDeleting ? (
              <Loader2 className="h-2 w-2 animate-spin" />
            ) : (
              <MoreVertical className="h-2 w-2" />
            )}
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => copyAsMarkdown(id)}
            disabled={isCopying}
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copy as Markdown</span>
          </DropdownMenuItem>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={isDeleting}
                onSelect={(e) => {
                  // Allow AlertDialog to open; prevent default navigation semantics
                  e.preventDefault()
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &ldquo;{title}&rdquo;? This
                  action cannot be undone and will permanently delete the
                  conversation and all its messages.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(id)}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
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
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
