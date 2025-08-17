import { createOpenAI } from '@ai-sdk/openai'
import { invoke } from '@tauri-apps/api/core'

/**
 * Creates an OpenAI model instance using the `OPENAI_API_KEY` provided by
 * the host environment via Tauri. Defaults to `gpt-4o-mini`.
 *
 * @returns A configured model instance.
 * @throws If the API key is not available.
 */
export async function createOpenAiModel() {
  const apiKey = await invoke<string | null>('get_env_var', {
    name: 'OPENAI_API_KEY',
  })

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  return createOpenAI({
    apiKey,
  })('gpt-4o-mini')
}
