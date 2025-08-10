import { mlxServer } from '@/lib/mlx-server'
import { toTitleCase } from '@/lib/utils'
import type { ChatMessage } from '@/types/mlx-server'

/**
 * Attempts to generate a short, descriptive conversation name from the given chat messages.
 * Returns the name as a string, or null if a suitable name could not be generated.
 */
export async function generateConversationTitle(
  messages: ChatMessage[],
): Promise<string | null> {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null
  }

  const chatMessages: ChatMessage[] = [
    {
      role: 'system',
      content: 'Follow the users instructions exactly.',
    },
    {
      role: 'user',
      content:
        'Given the following conversation messages, output a short, descriptive title of 2-3 words. Title case. No quotes, emojis, or trailing punctuation. If no good title is possible, respond exactly with: None\n\n' +
        JSON.stringify(messages) +
        '\n\n' +
        'Output only the title, no other text.',
    },
  ]

  try {
    const response = await mlxServer.chatCompletion(chatMessages)
    const content = response.choices[0]?.message?.content ?? ''

    const cleaned = sanitizeTitle(content)
    if (!cleaned || isGenericTitle(cleaned)) {
      return null
    }

    if (/^none$/i.test(cleaned)) {
      return null
    }

    const wordCount = cleaned.trim().split(/\s+/).length
    if (wordCount < 2 || wordCount > 10) {
      return null
    }

    if (cleaned.length > 60) {
      return null
    }

    const titled = toTitleCase(cleaned)
    return titled
  } catch (error) {
    console.error('Failed to generate conversation title:', error)
    return null
  }
}

function sanitizeTitle(rawTitle: string): string {
  const firstLine = rawTitle.split('\n')[0] ?? ''
  const withoutQuotes = firstLine.replace(/^[\s"'‘’“”]+|[\s"'‘’“”]+$/g, '')
  const withoutTrailingPunct = withoutQuotes.replace(/[\p{P}\p{S}]+$/u, '')
  const collapsed = withoutTrailingPunct.replace(/\s+/g, ' ').trim()
  return collapsed
}

function isGenericTitle(title: string): boolean {
  const t = title.toLowerCase()
  const generics = new Set([
    'none',
    'n/a',
    'untitled',
    'no title',
    'conversation',
    'chat',
    'general',
    'misc',
  ])
  return generics.has(t)
}
