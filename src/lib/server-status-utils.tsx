import type { ReactNode } from 'react'

import { DownloadProgressTooltip } from '@/components/download-progress-tooltip'
import type {
  DownloadStatusInfo,
  ServerStatusInfo,
} from '@/hooks/use-server-status'

/**
 * Generates tooltip content based on server and download status
 */
export function getStatusTooltipContent(
  serverStatus: ServerStatusInfo,
  downloadStatus: DownloadStatusInfo,
  error?: string | null,
): ReactNode {
  // Error state
  if (serverStatus.hasError && error) {
    return (
      <div className="space-y-1">
        <p className="font-semibold">Error:</p>
        <p className="text-xs">{error}</p>
      </div>
    )
  }

  // Ready state
  if (serverStatus.type === 'ready') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <span className="font-semibold text-muted-foreground/80">
            Status:
          </span>
          <span className="text-xs">Ready</span>
        </div>
      </div>
    )
  }

  // Download in progress
  if (downloadStatus.hasActiveDownload) {
    return <DownloadProgressTooltip downloadStatus={downloadStatus} />
  }

  // Starting or offline
  if (serverStatus.type === 'starting') {
    return <div className="space-y-1">Status: Starting up...</div>
  }

  return 'AI is not running'
}
