import { z } from 'zod'

// Chat completion schemas
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().nullable().optional(),
  tool_call_id: z.string().optional(),
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
  content: z.string().optional(),
})

export const ChatCompletionChoiceSchema = z.object({
  index: z.number(),
  message: z
    .object({
      role: z.string(),
      content: z.string().nullable(),
      reasoning: z.string().optional(),
      tool_calls: z
        .array(
          z.object({
            id: z.string(),
            type: z.literal('function'),
            function: z.object({
              name: z.string(),
              arguments: z.string(),
            }),
          }),
        )
        .optional(),
    })
    .optional(),
  delta: z
    .object({
      role: z.string().optional(),
      content: z.string().optional(),
      reasoning: z.string().optional(),
      tool_calls: z
        .array(
          z.object({
            index: z.number().optional(),
            id: z.string().optional(),
            type: z.literal('function').optional(),
            function: z
              .object({
                name: z.string().optional(),
                arguments: z.string().optional(),
              })
              .optional(),
          }),
        )
        .optional(),
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
  reasoning: ReasoningItemSchema.optional(),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
      reasoning_tokens: z.number().optional(),
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

// Type exports (inferred from schemas)
export type ChatMessage = z.infer<typeof ChatMessageSchema>
export type ReasoningItem = z.infer<typeof ReasoningItemSchema>
export type ChatCompletionChoice = z.infer<typeof ChatCompletionChoiceSchema>
export type ChatCompletionResponse = z.infer<
  typeof ChatCompletionResponseSchema
>
export type StreamChunk = z.infer<typeof StreamChunkSchema>
