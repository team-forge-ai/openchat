import { z } from 'zod'

// Chat completion schemas
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
})

export const ChatCompletionChoiceSchema = z.object({
  index: z.number(),
  message: z
    .object({
      role: z.string(),
      content: z.string(),
    })
    .optional(),
  delta: z
    .object({
      content: z.string().optional(),
    })
    .optional(),
  finish_reason: z.string().nullable().optional(),
})

export const ChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(ChatCompletionChoiceSchema),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
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
export type ChatCompletionChoice = z.infer<typeof ChatCompletionChoiceSchema>
export type ChatCompletionResponse = z.infer<
  typeof ChatCompletionResponseSchema
>
export type StreamChunk = z.infer<typeof StreamChunkSchema>
export type Model = z.infer<typeof ModelSchema>
export type ModelsResponse = z.infer<typeof ModelsResponseSchema>
