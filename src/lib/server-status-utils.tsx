import type { ReactNode } from 'react'

import { DownloadProgressTooltip } from '@/components/download-progress-tooltip'
import type { DownloadStatusInfo } from '@/hooks/use-download-status'
import type { ModelManagerStatus } from '@/lib/model-manager'

/**
 * Generates tooltip content based on model manager and download status
 */
export function getModelManagerTooltipContent(
  status: ModelManagerStatus,
  downloadStatus: DownloadStatusInfo,
): ReactNode {
  // Error state
  if (status.error) {
    return (
      <div className="space-y-1">
        <p className="font-semibold">Error:</p>
        <p className="text-xs">{status.error}</p>
      </div>
    )
  }

  // Ready state
  if (status.isReady) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <span className="font-semibold text-muted-foreground/80">
            Status:
          </span>
          <span className="text-xs">Ready</span>
        </div>
        {status.model.currentModel && (
          <div className="flex gap-1">
            <span className="font-semibold text-muted-foreground/80">
              Model:
            </span>
            <span className="text-xs">{status.model.currentModel}</span>
          </div>
        )}
      </div>
    )
  }

  // Download in progress
  if (downloadStatus.hasActiveDownload) {
    return <DownloadProgressTooltip downloadStatus={downloadStatus} />
  }

  // Server not ready
  if (!status.server.isRunning || !status.server.isHttpReady) {
    return <div className="space-y-1">Status: Server starting...</div>
  }

  // Model loading
  if (status.model.isLoading) {
    return <div className="space-y-1">Status: Loading model...</div>
  }

  return 'System initializing...'
}
