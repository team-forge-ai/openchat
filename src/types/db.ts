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

export interface AppSettingsTable {
  id: ColumnType<number, number, number>
  system_prompt: ColumnType<string, string | undefined, string>
  created_at: ColumnType<string, string | undefined, never>
  updated_at: ColumnType<string, string | undefined, string>
}

export interface McpServersTable {
  id: ColumnType<number, never, never>
  name: ColumnType<string, string, string>
  description: ColumnType<
    string | null,
    string | null | undefined,
    string | null
  >
  enabled: ColumnType<number, number | undefined, number>
  transport: ColumnType<
    'stdio' | 'websocket' | 'http',
    'stdio' | 'websocket' | 'http',
    'stdio' | 'websocket' | 'http'
  >
  command: ColumnType<string | null, string | null | undefined, string | null>
  args: ColumnType<string | null, string | null | undefined, string | null>
  env: ColumnType<string | null, string | null | undefined, string | null>
  cwd: ColumnType<string | null, string | null | undefined, string | null>
  url: ColumnType<string | null, string | null | undefined, string | null>
  headers: ColumnType<string | null, string | null | undefined, string | null>
  auth: ColumnType<string | null, string | null | undefined, string | null>
  heartbeat_sec: ColumnType<
    number | null,
    number | null | undefined,
    number | null
  >
  connect_timeout_ms: ColumnType<
    number | null,
    number | null | undefined,
    number | null
  >
  list_tools_timeout_ms: ColumnType<
    number | null,
    number | null | undefined,
    number | null
  >
  created_at: ColumnType<string, string | undefined, never>
  updated_at: ColumnType<string, string | undefined, string>
}

export interface DB {
  conversations: ConversationsTable
  messages: MessagesTable
  app_settings: AppSettingsTable
  mcp_servers: McpServersTable
}
