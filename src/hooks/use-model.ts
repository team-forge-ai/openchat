import { useQuery } from '@tanstack/react-query'

import { getModel } from '@/lib/db/app-settings'

const DEFAULT_MODEL = 'lmstudio-community/Qwen3-30B-A3B-Instruct-2507-MLX-4bit'

interface UseModelResult {
  /** The configured model ID, or 'default' if none is set */
  modelId: string
  /** Whether the model query is currently loading */
  isLoading: boolean
}

/**
 * Hook to fetch the currently configured model from app settings.
 * Returns 'default' as a fallback if no model is configured.
 *
 * @returns Object containing the modelId and loading state
 */
export function useModel(): UseModelResult {
  const { data: configuredModel, isLoading } = useQuery({
    queryKey: ['app-settings', 'model'],
    queryFn: getModel,
  })

  return {
    modelId: configuredModel || DEFAULT_MODEL,
    isLoading,
  }
}

export { DEFAULT_MODEL }
