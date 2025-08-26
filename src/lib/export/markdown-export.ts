import type { Conversation, Message } from '@/types'

/**
 * Formats a single message for markdown export.
 *
 * @param message The message to format
 * @returns Formatted markdown string for the message
 */
function formatMessageForMarkdown(message: Message): string {
  const roleDisplayName = message.role === 'user' ? 'User' : 'Assistant'
  const timestamp = new Date(message.created_at).toLocaleString()

  let content = `## ${roleDisplayName} *(${timestamp})*\n\n`

  // Add reasoning if present (only for assistant messages)
  if (message.reasoning && message.role === 'assistant') {
    content += `**Reasoning:**\n${message.reasoning}\n\n`
  }

  // Add main message content
  if (message.content) {
    content += `${message.content}\n\n`
  }

  return content
}

/**
 * Generates a markdown representation of a conversation.
 *
 * @param conversation The conversation metadata
 * @param messages Array of messages in the conversation
 * @returns Complete markdown content as a string
 */
export function generateConversationMarkdown(
  conversation: Conversation,
  messages: Message[],
): string {
  const title = conversation.title || 'Untitled Conversation'
  const exportDate = new Date().toLocaleString()
  const createdDate = new Date(conversation.created_at).toLocaleString()

  let markdown = `# ${title}\n\n`
  markdown += `*Exported on ${exportDate}*\n\n`
  markdown += `**Created:** ${createdDate}\n`
  markdown += `**Last Updated:** ${new Date(conversation.updated_at).toLocaleString()}\n`
  markdown += `**Messages:** ${messages.length}\n\n`
  markdown += '---\n\n'

  // Add all messages
  const completedMessages = messages.filter((msg) => msg.status === 'complete')

  if (completedMessages.length === 0) {
    markdown += '*No completed messages in this conversation.*\n'
  } else {
    completedMessages.forEach((message, index) => {
      markdown += formatMessageForMarkdown(message)

      // Add separator between messages (except for the last one)
      if (index < completedMessages.length - 1) {
        markdown += '---\n\n'
      }
    })
  }

  return markdown
}

/**
 * Generates a safe filename for the conversation export.
 *
 * @param conversation The conversation metadata
 * @returns A sanitized filename suitable for download
 */
export function generateConversationFilename(
  conversation: Conversation,
): string {
  const title = conversation.title || 'Untitled Conversation'
  const date = new Date(conversation.created_at).toISOString().split('T')[0]

  // Sanitize title by removing/replacing invalid filename characters
  const sanitizedTitle = title
    .replace(/[^\s\w-]/g, '') // Remove special characters except word chars, spaces, hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim()
    .substring(0, 50) // Limit length

  return `${sanitizedTitle}-${date}.md`
}
