import { AlertCircle, CheckCircle, Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useMLCServer } from '@/contexts/mlc-server-context'

export function MLCServerStatus() {
  const { status, error, restartServer, isReady } = useMLCServer()

  const getStatusIcon = () => {
    if (error) {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }
    if (isReady) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    if (!isReady) {
      return <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
    }
    return <AlertCircle className="h-4 w-4 text-gray-400" />
  }

  const getStatusText = () => {
    if (error) {
      return 'AI error'
    }
    if (isReady) {
      return 'AI ready'
    }
    if (!isReady) {
      return 'AI starting...'
    }
    return 'AI offline'
  }

  const getTooltipContent = () => {
    if (error) {
      return (
        <div className="space-y-1">
          <p className="font-semibold">Error:</p>
          <p className="text-xs">{error}</p>
        </div>
      )
    }
    if (isReady) {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <span className="font-semibold text-muted-foreground/80">
              Status:
            </span>
            <span className="text-xs">Ready</span>
          </div>
          <div className="flex gap-1">
            <span className="font-semibold text-muted-foreground/80">
              Model:
            </span>
            <span className="text-xs">{status.modelPath}</span>
          </div>
        </div>
      )
    }
    if (!isReady && status.isReady) {
      return <div className="space-y-1">Status: Starting up...</div>
    }
    return 'AI is not running'
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center gap-2 text-[10px] uppercase"
              style={{ fontWeight: '600' }}
            >
              {getStatusIcon()}
              <span className="text-muted-foreground/80 cursor-default">
                {getStatusText()}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>{getTooltipContent()}</TooltipContent>
        </Tooltip>

        {error && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={restartServer}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restart AI</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
