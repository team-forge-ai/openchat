import { createOpenAI } from '@ai-sdk/openai'
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai'

export function createMlxClient({
  modelId,
  endpoint,
}: {
  modelId: string
  endpoint: string
}) {
  const openai = createOpenAI({ baseURL: endpoint, apiKey: 'dummy' })

  // Wrap the model with middleware that extracts <think> ... </think>
  const model = wrapLanguageModel({
    model: openai.chat(modelId),
    middleware: extractReasoningMiddleware({ tagName: 'think' }),
  })

  return model
}
