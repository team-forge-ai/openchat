import type { ColumnType } from 'kysely'

import type { MessageStatus } from '@/types'

export interface ConversationsTable {
  id: ColumnType<number, never, never>
  title: ColumnType<string | null, string | null | undefined, string | null>
  created_at: ColumnType<string, string | undefined, never>
  updated_at: ColumnType<string, string | undefined, string>
}

export interface MessagesTable {
  id: ColumnType<number, never, never>
  conversation_id: ColumnType<number, number, never>
  role: ColumnType<'user' | 'assistant', 'user' | 'assistant', never>
  content: ColumnType<string, string, string>
  reasoning: ColumnType<string | null, string | null | undefined, string | null>
  status: ColumnType<MessageStatus, MessageStatus | undefined, MessageStatus>
  created_at: ColumnType<string, string | undefined, never>
}

export interface DB {
  conversations: ConversationsTable
  messages: MessagesTable
}
