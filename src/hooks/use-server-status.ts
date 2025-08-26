import { useMemo } from 'react'

import { useActiveDownloads } from '@/contexts/download-progress-context'
import { useMLCServer } from '@/contexts/mlc-server-context'

export type ServerStatusType = 'error' | 'ready' | 'starting' | 'offline'

export interface ServerStatusInfo {
  type: ServerStatusType
  text: string
  iconColor: string
  hasError: boolean
  canRestart: boolean
}

/**
 * Hook to derive server status information from MLC server state
 */
export function useServerStatus(): ServerStatusInfo {
  const { error, isReady } = useMLCServer()

  return useMemo(() => {
    if (error) {
      return {
        type: 'error',
        text: 'AI error',
        iconColor: 'text-red-500',
        hasError: true,
        canRestart: true,
      }
    }

    if (isReady) {
      return {
        type: 'ready',
        text: 'AI ready',
        iconColor: 'text-green-500',
        hasError: false,
        canRestart: false,
      }
    }

    // Not ready - could be starting or offline
    return {
      type: 'starting',
      text: 'AI starting...',
      iconColor: 'text-orange-500',
      hasError: false,
      canRestart: false,
    }
  }, [error, isReady])
}

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
