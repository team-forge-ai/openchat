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

// Fun status message collections for the main display
const ERROR_MESSAGES = [
  'AI hiccup',
  'Neural glitch',
  'Brain freeze',
  'Oops, AI stumbled',
  'Digital hiccup',
  'AI needs coffee',
]

const READY_MESSAGES = [
  'AI awakened',
  'Brain online',
  'Ready to think',
  'Consciousness active',
  'AI standing by',
  'Neural networks live',
]

const DOWNLOAD_MESSAGES = [
  'Downloading AI brain...',
  'Fetching neural data...',
  'Acquiring intelligence...',
  'Streaming consciousness...',
  'Downloading wisdom...',
  'Pulling AI memories...',
]

const LOADING_MESSAGES = [
  'Waking up the AI...',
  'Booting consciousness...',
  'Loading neural pathways...',
  'Awakening digital mind...',
  'Initializing intelligence...',
  'Starting AI brain...',
]

const SERVER_STARTING_MESSAGES = [
  'Booting neural networks...',
  'Starting AI engines...',
  'Firing up intelligence...',
  'Powering AI systems...',
  'Activating neural cores...',
  'Spinning up consciousness...',
]

const INITIALIZATION_MESSAGES = [
  'Summoning artificial intelligence...',
  'Weaving digital consciousness...',
  'Birthing AI thoughts...',
  'Manifesting intelligence...',
  'Awakening silicon dreams...',
  'Creating digital awareness...',
]

/**
 * Randomly selects a message from an array
 */
function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)]
}

export function ModelManagerStatus() {
  const { status, error, restartServer } = useModelManager()
  const downloadStatus = useDownloadStatus()

  // Derive display properties from model manager status
  const getStatusDisplay = () => {
    if (error) {
      return {
        type: 'error' as const,
        text: getRandomMessage(ERROR_MESSAGES),
        iconColor: 'text-red-500',
        canRestart: true,
      }
    }

    if (status.isReady) {
      return {
        type: 'ready' as const,
        text: getRandomMessage(READY_MESSAGES),
        iconColor: 'text-green-500',
        canRestart: false,
      }
    }

    if (downloadStatus.hasActiveDownload) {
      return {
        type: 'starting' as const,
        text: getRandomMessage(DOWNLOAD_MESSAGES),
        iconColor: 'text-blue-500',
        canRestart: false,
      }
    }

    if (status.model.isLoading) {
      return {
        type: 'starting' as const,
        text: getRandomMessage(LOADING_MESSAGES),
        iconColor: 'text-orange-500',
        canRestart: false,
      }
    }

    if (!status.server.isRunning || !status.server.isHttpReady) {
      return {
        type: 'starting' as const,
        text: getRandomMessage(SERVER_STARTING_MESSAGES),
        iconColor: 'text-orange-500',
        canRestart: false,
      }
    }

    return {
      type: 'starting' as const,
      text: getRandomMessage(INITIALIZATION_MESSAGES),
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
