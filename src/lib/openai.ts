import { createOpenAI } from '@ai-sdk/openai'
import { invoke } from '@tauri-apps/api/core'

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
