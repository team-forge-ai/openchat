import { ServerRestartButton } from '@/components/server-restart-button'
import { ServerStatusIndicator } from '@/components/server-status-indicator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useMLCServer } from '@/contexts/mlc-server-context'
import { useDownloadStatus, useServerStatus } from '@/hooks/use-server-status'
import { getStatusTooltipContent } from '@/lib/server-status-utils'

export function MLCServerStatus() {
  const { restartServer } = useMLCServer()
  const serverStatus = useServerStatus()
  const downloadStatus = useDownloadStatus()

  const tooltipContent = getStatusTooltipContent(serverStatus, downloadStatus)

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <ServerStatusIndicator
                statusType={serverStatus.type}
                statusText={serverStatus.text}
                iconColor={serverStatus.iconColor}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>

        {serverStatus.canRestart && (
          <ServerRestartButton onRestart={restartServer} />
        )}
      </div>
    </TooltipProvider>
  )
}
