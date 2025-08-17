import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getSystemPrompt,
  setSystemPrompt as setSystemPromptDb,
} from '@/lib/db/app-settings'

interface UseSystemPromptResult {
  systemPrompt: string
  isLoading: boolean
  setSystemPrompt: (value: string) => void
}

/**
 * useSystemPrompt
 *
 * Provides accessors for the global system prompt stored in the local DB,
 * including the current value, loading state, and a setter that updates the
 * DB and invalidates the related cache.
 *
 * @returns An object with `systemPrompt`, `isLoading`, and `setSystemPrompt(value)`.
 */
export function useSystemPrompt(): UseSystemPromptResult {
  const queryClient = useQueryClient()

  const { data: systemPrompt = '', isFetching } = useQuery<string>({
    queryKey: ['app-settings', 'system-prompt'],
    queryFn: () => getSystemPrompt(),
  })

  const update = useMutation({
    mutationFn: async (value: string) => await setSystemPromptDb(value),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['app-settings', 'system-prompt'],
      })
    },
  })

  return {
    systemPrompt,
    isLoading: isFetching,
    setSystemPrompt: (value: string) => update.mutate(value),
  }
}
