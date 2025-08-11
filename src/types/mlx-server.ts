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
  isHttpReady: boolean
  isModelReady: boolean
  port?: number
  pid?: number | null
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  reasoning?: string // Optional reasoning content
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

export interface ChatCompletionOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
  signal?: AbortSignal
  tools?: ToolSpec[]
  toolChoice?: ToolChoice
  parallelToolCalls?: boolean
}

export interface ChatCompletionChoice {
  index: number
  message?: {
    role: string
    content: string | null
    reasoning?: string // Optional reasoning content
    tool_calls?: ToolCall[]
  }
  delta?: {
    content?: string
    reasoning?: string // Optional reasoning chunk for streaming
    tool_calls?: ToolCallDelta[]
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

// OpenAI-compatible tool spec and tool call types
export interface ToolFunction {
  name: string
  description?: string
  // JSON Schema for function parameters. Use unknown to avoid any.
  parameters?: Record<string, unknown>
}

export interface ToolSpec {
  type: 'function'
  function: ToolFunction
}

export type ToolChoice =
  | 'none'
  | 'auto'
  | 'required'
  | {
      type: 'function'
      function: { name: string }
    }

export interface ToolCallFunctionSpec {
  name: string
  arguments: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: ToolCallFunctionSpec
}

export interface ToolCallDeltaFunctionSpec {
  name?: string
  arguments?: string
}

export interface ToolCallDelta {
  index?: number
  id?: string
  type?: 'function'
  function?: ToolCallDeltaFunctionSpec
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
