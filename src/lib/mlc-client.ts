import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

// Standalone MLC client factory; does not depend on the service to avoid cycles

/**
 * Creates an OpenAI-compatible client bound to the local MLC server and model.
 *
 * @param options.modelId The MLC model identifier/path.
 * @param options.endpoint The base HTTP endpoint for the local MLC server.
 * @returns A language model instance usable with the AI SDK.
 * @throws If the endpoint is missing.
 */
export function createMlcClient(options: {
  modelId: string
  endpoint: string
}) {
  const endpoint = options.endpoint
  if (!endpoint) {
    throw new Error('MLC endpoint is not available')
  }

  const openai = createOpenAICompatible({
    name: 'mlc',
    baseURL: endpoint + '/v1',
    apiKey: 'dummy',
  })

  // // Wrap the model with middleware that extracts <think> ... </think>
  // const model = wrapLanguageModel({
  //   model: openai.chat(options.modelId),
  //   middleware: extractReasoningMiddleware({ tagName: 'think' }),
  // })

  return openai(options.modelId)
}
