import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getModel, setModel } from '@/lib/db/app-settings'
import { mlcServer } from '@/lib/mlc-server'
import type { Model } from '@/types/mlc-server'

interface UseModelSettingsResult {
  /** Currently configured model, or null if none is set */
  currentModel: string | null
  /** Available models from MLX server */
  availableModels: Model[]
  /** Whether the current model query is loading */
  isLoadingCurrent: boolean
  /** Whether the available models query is loading */
  isLoadingModels: boolean
  /** Whether the MLX server is ready to fetch models */
  isServerReady: boolean
  /** Error from fetching models, if any */
  error: Error | null
  /** Function to update the selected model */
  updateModel: (modelId: string | null) => Promise<void>
  /** Whether a model update is in progress */
  isUpdating: boolean
}

/**
 * Hook for managing model selection in settings.
 * Fetches the current model from app settings and available models from MLX server.
 * Provides a function to update the selected model.
 */
export function useModelSettings(): UseModelSettingsResult {
  const queryClient = useQueryClient()

  // Get current model from settings
  const { data: currentModel = null, isLoading: isLoadingCurrent } = useQuery({
    queryKey: ['app-settings', 'model'],
    queryFn: getModel,
  })

  // Get available models from MLX server
  const {
    data: availableModels = [],
    isLoading: isLoadingModels,
    error,
  } = useQuery({
    queryKey: ['mlx-models'],
    queryFn: () => mlcServer.fetchModels(),
    enabled: mlcServer.isReady,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Mutation to update the model
  const updateModelMutation = useMutation({
    mutationFn: (modelId: string | null) => setModel(modelId),
    onSuccess: () => {
      // Invalidate queries to refresh the UI
      void queryClient.invalidateQueries({
        queryKey: ['app-settings', 'model'],
      })
    },
  })

  return {
    currentModel,
    availableModels,
    isLoadingCurrent,
    isLoadingModels,
    isServerReady: mlcServer.isReady,
    error: error,
    updateModel: updateModelMutation.mutateAsync,
    isUpdating: updateModelMutation.isPending,
  }
}
