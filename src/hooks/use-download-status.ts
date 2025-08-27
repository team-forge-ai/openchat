import { useMemo } from 'react'

import { useActiveDownloads } from '@/contexts/download-progress-context'

export interface DownloadStatusInfo {
  hasActiveDownload: boolean
  repoId?: string
  progressPercent?: number
  isDownloading: boolean
}

/**
 * Hook to derive download status information for the first active download
 */
export function useDownloadStatus(): DownloadStatusInfo {
  const activeDownloads = useActiveDownloads()

  return useMemo(() => {
    if (activeDownloads.length === 0) {
      return {
        hasActiveDownload: false,
        isDownloading: false,
      }
    }

    const { repoId, state } = activeDownloads[0]
    const progressPercent =
      state.totalBytes && state.totalBytes > 0
        ? Math.min(
            100,
            Math.floor((state.receivedBytes / state.totalBytes) * 100),
          )
        : undefined

    return {
      hasActiveDownload: true,
      repoId,
      progressPercent,
      isDownloading: state.status === 'downloading',
    }
  }, [activeDownloads])
}
