import { z } from 'zod'

// Chat completion schemas
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
})

// Reasoning schemas
export const ReasoningItemSchema = z.object({
  id: z.string(),
  type: z.literal('reasoning'),
  summary: z
    .array(
      z.object({
        text: z.string(),
        type: z.string().optional(),
      }),
    )
    .optional(),
  content: z.string().optional(), // Full reasoning content (may not be exposed)
})

export const ChatCompletionChoiceSchema = z.object({
  index: z.number(),
  message: z
    .object({
      role: z.string(),
      content: z.string(),
      reasoning: z.string().optional(), // Reasoning content if available
    })
    .optional(),
  delta: z
    .object({
      role: z.string().optional(),
      content: z.string().optional(),
      reasoning: z.string().optional(), // Streaming reasoning chunks (legacy)
    })
    .optional(),
  finish_reason: z.string().nullable().optional(),
  logprobs: z.any().nullable().optional(),
  reasoning_event: z
    .object({
      type: z.enum(['start', 'partial', 'complete']),
      id: z.string(),
      content: z.string().nullable(),
      partial: z.boolean(),
    })
    .nullable()
    .optional(),
})

export const ChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(ChatCompletionChoiceSchema),
  reasoning: ReasoningItemSchema.optional(), // Top-level reasoning item
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
      reasoning_tokens: z.number().optional(), // Reasoning tokens count
    })
    .optional(),
})

// Stream chunk schema (for streaming responses)
export const StreamChunkSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(ChatCompletionChoiceSchema),
})

// Models endpoint schemas
export const ModelSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  owned_by: z.string(),
})

export const ModelsResponseSchema = z.object({
  object: z.string(),
  data: z.array(ModelSchema),
})

// Type exports (inferred from schemas)
export type ChatMessage = z.infer<typeof ChatMessageSchema>
export type ReasoningItem = z.infer<typeof ReasoningItemSchema>
export type ChatCompletionChoice = z.infer<typeof ChatCompletionChoiceSchema>
export type ChatCompletionResponse = z.infer<
  typeof ChatCompletionResponseSchema
>
export type StreamChunk = z.infer<typeof StreamChunkSchema>
export type Model = z.infer<typeof ModelSchema>
export type ModelsResponse = z.infer<typeof ModelsResponseSchema>
