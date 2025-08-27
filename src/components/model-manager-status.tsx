import { ServerRestartButton } from '@/components/server-restart-button'
import { ServerStatusIndicator } from '@/components/server-status-indicator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useModelManager } from '@/contexts/model-manager-context'
import { useDownloadStatus } from '@/hooks/use-download-status'
import { getModelManagerTooltipContent } from '@/lib/server-status-utils'

export function ModelManagerStatus() {
  const { status, error, restartServer } = useModelManager()
  const downloadStatus = useDownloadStatus()

  // Derive display properties from model manager status
  const getStatusDisplay = () => {
    if (error) {
      return {
        type: 'error' as const,
        text: 'AI error',
        iconColor: 'text-red-500',
        canRestart: true,
      }
    }

    if (status.isReady) {
      return {
        type: 'ready' as const,
        text: 'AI ready',
        iconColor: 'text-green-500',
        canRestart: false,
      }
    }

    if (downloadStatus.hasActiveDownload) {
      return {
        type: 'starting' as const,
        text: 'Downloading model...',
        iconColor: 'text-blue-500',
        canRestart: false,
      }
    }

    if (status.model.isLoading) {
      return {
        type: 'starting' as const,
        text: 'Loading model...',
        iconColor: 'text-orange-500',
        canRestart: false,
      }
    }

    if (!status.server.isReady) {
      return {
        type: 'starting' as const,
        text: 'Starting server...',
        iconColor: 'text-orange-500',
        canRestart: false,
      }
    }

    return {
      type: 'starting' as const,
      text: 'Initializing...',
      iconColor: 'text-orange-500',
      canRestart: false,
    }
  }

  const statusDisplay = getStatusDisplay()
  const tooltipContent = getModelManagerTooltipContent(status, downloadStatus)

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <ServerStatusIndicator
                statusType={statusDisplay.type}
                statusText={statusDisplay.text}
                iconColor={statusDisplay.iconColor}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>

        {statusDisplay.canRestart && (
          <ServerRestartButton onRestart={restartServer} />
        )}
      </div>
    </TooltipProvider>
  )
}
