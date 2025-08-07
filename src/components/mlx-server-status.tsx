import { AlertCircle, CheckCircle, Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useMLXServer } from '@/contexts/mlx-server-context'

export function MLXServerStatus() {
  const { status, isInitializing, error, restartServer } = useMLXServer()

  const getStatusIcon = () => {
    if (isInitializing) {
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
    }
    if (error) {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }
    if (status.is_running) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    return <AlertCircle className="h-4 w-4 text-gray-400" />
  }

  const getStatusText = () => {
    if (isInitializing) {
      return 'Starting AI server...'
    }
    if (error) {
      return 'AI server error'
    }
    if (status.is_running) {
      return 'AI server running'
    }
    return 'AI server offline'
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
    if (status.is_running) {
      return (
        <div className="space-y-1">
          <p>Model: {status.model_path?.split('/').pop()}</p>
          <p>Port: {status.port}</p>
          {status.pid && <p>PID: {status.pid}</p>}
        </div>
      )
    }
    return 'AI server is not running'
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 text-sm">
              {getStatusIcon()}
              <span className="text-muted-foreground">{getStatusText()}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>{getTooltipContent()}</TooltipContent>
        </Tooltip>

        {(error || !status.is_running) && !isInitializing && (
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
            <TooltipContent>Restart AI server</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
