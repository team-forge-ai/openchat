import { z } from 'zod'

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

// Zod schemas for MLC server model API responses
export const ModelSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  created: z.number(),
})

export const ModelsResponseSchema = z.object({
  object: z.literal('list'),
  data: z.array(ModelSchema),
})

// TypeScript types derived from Zod schemas
export type Model = z.infer<typeof ModelSchema>
export type ModelsResponse = z.infer<typeof ModelsResponseSchema>
