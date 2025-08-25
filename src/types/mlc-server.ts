// MLC Server shared client-side status
export interface MLCStatus {
  isReady: boolean
  port?: number
  error?: string | null
}

export interface MLCServerStatusWire {
  is_running: boolean
  is_http_ready: boolean
  port?: number
  pid?: number | null
  error?: string | null
}

// ChatMessage type used in title generation utilities
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | null | undefined
}
