import type { DownloadStatusInfo } from '@/hooks/use-server-status'

interface DownloadProgressTooltipProps {
  downloadStatus: DownloadStatusInfo
}

/**
 * Displays download progress information in a tooltip
 */
export function DownloadProgressTooltip({
  downloadStatus,
}: DownloadProgressTooltipProps) {
  const { repoId, progressPercent } = downloadStatus

  if (!repoId) {
    return null
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex gap-1">
        <span className="font-semibold text-muted-foreground/80">
          Downloading:
        </span>
        <span className="truncate max-w-[220px]">{repoId}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-36 bg-muted rounded overflow-hidden">
          {progressPercent !== undefined ? (
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          ) : (
            <div className="h-full bg-orange-500 animate-pulse w-full opacity-60" />
          )}
        </div>
        {progressPercent !== undefined ? (
          <span>{progressPercent}%</span>
        ) : (
          <span>...</span>
        )}
      </div>
    </div>
  )
}
