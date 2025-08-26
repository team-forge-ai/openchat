import { useMutation } from '@tanstack/react-query'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { toast } from 'sonner'

import { getConversation } from '@/lib/db/conversations'
import { getMessages } from '@/lib/db/messages'
import { generateConversationMarkdown } from '@/lib/export/markdown-export'

interface ExportConversationVariables {
  conversationId: number
}

interface UseConversationExportResult {
  copyAsMarkdown: (conversationId: number) => void
  isCopying: boolean
  error: Error | null
}

/**
 * Hook for copying conversations to clipboard in various formats.
 * Currently supports markdown copying with potential for future format support.
 */
export function useConversationExport(): UseConversationExportResult {
  const mutation = useMutation<void, Error, ExportConversationVariables>({
    mutationFn: async ({ conversationId }) => {
      try {
        // Fetch conversation and messages data
        const [conversation, messages] = await Promise.all([
          getConversation(conversationId),
          getMessages(conversationId),
        ])

        // Generate markdown content
        const markdownContent = generateConversationMarkdown(
          conversation,
          messages,
        )

        // Copy to clipboard using Tauri clipboard plugin
        await writeText(markdownContent)

        // Show success toast
        toast.success('Conversation copied to clipboard', {
          description: `${messages.length} messages copied as markdown`,
          duration: 3000,
        })
      } catch (error) {
        // Show error toast
        toast.error('Failed to copy conversation', {
          description:
            error instanceof Error ? error.message : 'Unknown error occurred',
          duration: 5000,
        })

        throw new Error(
          error instanceof Error
            ? `Failed to copy conversation: ${error.message}`
            : 'Failed to copy conversation',
        )
      }
    },
  })

  return {
    copyAsMarkdown: (conversationId: number) => {
      mutation.mutate({ conversationId })
    },
    isCopying: mutation.isPending,
    error: mutation.error,
  }
}
