// MLX Server type definitions

export interface MLXServerConfig {
  port?: number
  host?: string
  logLevel?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'
  maxTokens?: number
  temperature?: number
}

export interface MLXServerStatus {
  isRunning: boolean
  isReady: boolean
  port?: number
  pid?: number | null
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  reasoning?: string // Optional reasoning content
}

export interface ChatCompletionOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

export interface ChatCompletionChoice {
  index: number
  message?: {
    role: string
    content: string
    reasoning?: string // Optional reasoning content
  }
  delta?: {
    content?: string
    reasoning?: string // Optional reasoning chunk for streaming
  }
  finish_reason?: string | null
}

export interface ReasoningItem {
  id: string
  type: 'reasoning'
  summary?: Array<{
    text: string
    type?: string
  }>
  content?: string // Full reasoning content (may not be exposed)
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: ChatCompletionChoice[]
  reasoning?: ReasoningItem // Optional reasoning item
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    reasoning_tokens?: number // Optional reasoning tokens count
  }
}

export interface Model {
  id: string
  object: string
  created: number
  owned_by: string
}

export interface ModelsResponse {
  object: string
  data: Model[]
}

export interface StreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: ChatCompletionChoice[]
}

// Error types
export class MLXServerError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'MLXServerError'
  }
}

export class MLXServerNotRunningError extends MLXServerError {
  constructor() {
    super('MLX server is not running', 'SERVER_NOT_RUNNING')
  }
}

export class MLXServerAlreadyRunningError extends MLXServerError {
  constructor() {
    super('MLX server is already running', 'SERVER_ALREADY_RUNNING')
  }
}

export class MLXServerStartupError extends MLXServerError {
  constructor(message: string) {
    super(`Failed to start MLX server: ${message}`, 'SERVER_STARTUP_ERROR')
  }
}

// Constants
export const DEFAULT_CONFIG = {
  PORT: 8000,
  HOST: '127.0.0.1',
  LOG_LEVEL: 'INFO' as const,
  MAX_STARTUP_ATTEMPTS: 30,
  STARTUP_CHECK_INTERVAL: 1000,
  INITIAL_STARTUP_DELAY: 20000,
} as const
