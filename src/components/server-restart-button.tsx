import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ServerRestartButtonProps {
  onRestart: () => Promise<void>
}

/**
 * Button to restart the MLC server with tooltip
 */
export function ServerRestartButton({ onRestart }: ServerRestartButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onRestart}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Restart AI</TooltipContent>
    </Tooltip>
  )
}
