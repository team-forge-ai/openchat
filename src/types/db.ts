import type { ColumnType } from 'kysely'

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
  status: ColumnType<
    'pending' | 'complete' | 'error',
    'pending' | 'complete' | 'error' | undefined,
    'pending' | 'complete' | 'error'
  >
  created_at: ColumnType<string, string | undefined, never>
}

export interface DB {
  conversations: ConversationsTable
  messages: MessagesTable
}
