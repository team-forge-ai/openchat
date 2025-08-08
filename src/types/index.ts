export interface Conversation {
  id: number
  title: string
  created_at: string
  updated_at: string
}

export type MessageStatus = 'pending' | 'complete' | 'error'

export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  reasoning?: string // Optional reasoning content for assistant messages
  status: MessageStatus
  created_at: string
}
