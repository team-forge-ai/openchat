import { invoke } from '@tauri-apps/api/core'

import { dbPromise } from '@/lib/db'
import type { Message } from '@/types'

interface UseAssistantResponder {
  generate: (conversationId: number) => Promise<string>
}

export function useAssistantResponder(): UseAssistantResponder {
  const generate = async (conversationId: number): Promise<string> => {
    // Build ordered context directly inside the hook
    const db = await dbPromise
    const context = await db.select<Message[]>(
      'SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id',
      [conversationId],
    )
    return await invoke<string>('generate_assistant_response', { context })
  }

  return { generate }
}
