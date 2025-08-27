import type { ModelMessage } from 'ai'
import { generateObject } from 'ai'
import { z } from 'zod'

import { DEFAULT_MODEL } from '@/hooks/use-model'
import { getModel } from '@/lib/db/app-settings'
import { createMlcClient } from '@/lib/mlc-client'
import { mlcServer } from '@/lib/mlc-server'
import { toTitleCase } from '@/lib/utils'

/**
 * Attempts to generate a short, descriptive conversation title from chat messages.
 * Uses the local MLC model to produce a JSON object and sanitizes the result.
 *
 * @param messages Chat messages to summarize.
 * @param modelId Optional model ID to use. If not provided, uses the app setting or 'default'.
 * @returns A title string, or null if one could not be generated.
 */
export async function generateConversationTitle(
  messages: ModelMessage[],
  modelId?: string,
): Promise<string | null> {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null
  }

  const chatMessages: ModelMessage[] = [
    {
      role: 'system',
      content: 'Follow the users instructions exactly.',
    },
    {
      role: 'user',
      content:
        'Given the following conversation messages, output a short, descriptive title of 2-3 words. Title case. No quotes, emojis, or trailing punctuation. Respond as a JSON object matching the schema { "title": string }. Ignore messages that are purely conversational (e.g. "Hello", "Hi", "How are you?"). If no good title is possible, set title to "None".\n\n' +
        JSON.stringify(messages) +
        '\n\n' +
        'Only return the JSON object.',
    },
  ]

  // Get the configured model or use the provided override
  const configuredModelId = modelId || (await getModel()) || DEFAULT_MODEL

  const endpoint = mlcServer.endpoint
  if (!endpoint) {
    throw new Error('MLC server is not ready')
  }

  const model = createMlcClient({ modelId: configuredModelId, endpoint })

  try {
    console.log('Generating conversation title with messages:', chatMessages)
    const { object } = await generateObject({
      model,
      messages: chatMessages,
      schema: z.object({
        title: z.string(),
      }),
    })
    const content = object.title
    console.log('Conversation title content:', content)

    const cleaned = sanitizeTitle(content)
    if (!cleaned || isGenericTitle(cleaned)) {
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
    'hello',
    'greeting',
  ])
  return generics.has(t)
}
