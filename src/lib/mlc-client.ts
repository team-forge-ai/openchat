import { createOpenAI } from '@ai-sdk/openai'
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai'

// Standalone MLC client factory; does not depend on the service to avoid cycles

export function createMlcClient(options: {
  modelId: string
  endpoint: string
}) {
  const endpoint = options.endpoint
  if (!endpoint) {
    throw new Error('MLC endpoint is not available')
  }

  const openai = createOpenAI({ baseURL: endpoint + '/v1', apiKey: 'dummy' })

  // Wrap the model with middleware that extracts <think> ... </think>
  const model = wrapLanguageModel({
    model: openai.chat(options.modelId),
    middleware: extractReasoningMiddleware({ tagName: 'think' }),
  })

  return model
}
