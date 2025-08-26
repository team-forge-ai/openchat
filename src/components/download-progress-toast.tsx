import { X } from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import type { DownloadProgressState } from '@/contexts/download-progress-context'

interface DownloadProgressToastProps {
  repoId: string
  state: DownloadProgressState
  onDismiss?: () => void
  isDismissible?: boolean
}

/**
 * Custom toast content for download progress with progress bar
 */
export function DownloadProgressToast({
  repoId,
  state,
  onDismiss,
  isDismissible = false,
}: DownloadProgressToastProps) {
  const progressPercent =
    state.totalBytes && state.totalBytes > 0
      ? Math.min(
          100,
          Math.floor((state.receivedBytes / state.totalBytes) * 100),
        )
      : undefined

  const getStatusText = () => {
    switch (state.status) {
      case 'downloading':
        return 'Downloading'
      case 'completed':
        return 'Download complete'
      case 'failed':
        return 'Download failed'
      default:
        return 'Preparing download'
    }
  }

  const getStatusColor = () => {
    switch (state.status) {
      case 'downloading':
        return 'text-blue-500'
      case 'completed':
        return 'text-green-500'
      case 'failed':
        return 'text-red-500'
      default:
        return 'text-orange-500'
    }
  }

  return (
    <div className="flex flex-col gap-3 min-w-[300px]">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            {isDismissible && onDismiss && (
              <button
                onClick={onDismiss}
                className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-sm"
                aria-label="Dismiss notification"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-[250px]">
            {repoId}
          </span>
        </div>
      </div>

      {state.status === 'downloading' && (
        <div className="flex flex-col gap-2">
          <Progress value={progressPercent} className="w-full h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {progressPercent !== undefined
                ? `${progressPercent}%`
                : 'Calculating...'}
            </span>
            {state.totalBytes && (
              <span>
                {Math.round(state.receivedBytes / 1024 / 1024)} MB /{' '}
                {Math.round(state.totalBytes / 1024 / 1024)} MB
              </span>
            )}
          </div>
        </div>
      )}

      {state.status === 'failed' && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
          Download failed. Please try again.
        </div>
      )}

      {state.status === 'completed' && (
        <div className="text-xs text-green-600 dark:text-green-400">
          Model downloaded successfully
        </div>
      )}
    </div>
  )
}
