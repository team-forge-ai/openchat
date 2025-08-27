import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import type { DownloadProgressState } from '@/contexts/download-progress-context'
import { useDownloadProgress } from '@/contexts/download-progress-context'
import { downloadModel } from '@/lib/commands'

interface UseModelDownloadResult {
  /** Download progress state for the model */
  downloadState: DownloadProgressState
  /** Function to start downloading the model */
  downloadModel: (repoId: string) => Promise<void>
  /** Whether a download is currently in progress */
  isDownloading: boolean
  /** Whether the download completed successfully */
  isDownloadComplete: boolean
  /** Whether the download failed */
  isDownloadFailed: boolean
  /** Download progress percentage (0-100) */
  downloadProgress: number
}

/**
 * Hook for managing model downloads with progress tracking.
 * Uses the download progress context to track download state.
 */
export function useModelDownload(repoId: string): UseModelDownloadResult {
  const queryClient = useQueryClient()
  const downloadStates = useDownloadProgress()

  const downloadState = downloadStates[repoId] || {
    status: 'idle' as const,
    totalBytes: null,
    receivedBytes: 0,
    filesCompleted: 0,
    filesFailed: 0,
    lastFile: undefined,
  }

  const downloadMutation = useMutation({
    mutationFn: (modelRepoId: string) => downloadModel(modelRepoId),
    onSuccess: () => {
      // Invalidate model queries to refresh the available models list
      void queryClient.invalidateQueries({ queryKey: ['mlx-models'] })
    },
  })

  const handleDownload = useCallback(
    async (modelRepoId: string) => {
      await downloadMutation.mutateAsync(modelRepoId)
    },
    [downloadMutation],
  )

  const isDownloading = useMemo(
    () => downloadState.status === 'downloading',
    [downloadState.status],
  )

  const isDownloadComplete = useMemo(
    () => downloadState.status === 'completed',
    [downloadState.status],
  )

  const isDownloadFailed = useMemo(
    () => downloadState.status === 'failed',
    [downloadState.status],
  )

  const downloadProgress = useMemo(() => {
    if (!downloadState.totalBytes || downloadState.totalBytes === 0) {
      return 0
    }
    return Math.floor(
      (downloadState.receivedBytes / downloadState.totalBytes) * 100,
    )
  }, [downloadState.receivedBytes, downloadState.totalBytes])

  return {
    downloadState,
    downloadModel: handleDownload,
    isDownloading,
    isDownloadComplete,
    isDownloadFailed,
    downloadProgress,
  }
}
