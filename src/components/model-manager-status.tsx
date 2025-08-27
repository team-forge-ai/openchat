import { useMemo } from 'react'

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
import {
  getModelManagerTooltipContent,
  type RandomTooltipMessages,
} from '@/lib/server-status-utils'

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

  // Memoize random messages to keep them stable during component lifecycle
  const randomMessages = useMemo(
    () => ({
      error: getRandomMessage(ERROR_MESSAGES),
      ready: getRandomMessage(READY_MESSAGES),
      download: getRandomMessage(DOWNLOAD_MESSAGES),
      loading: getRandomMessage(LOADING_MESSAGES),
      serverStarting: getRandomMessage(SERVER_STARTING_MESSAGES),
      initialization: getRandomMessage(INITIALIZATION_MESSAGES),
    }),
    [],
  )

  // Memoize tooltip messages to keep them stable during component lifecycle
  const tooltipMessages = useMemo(
    (): RandomTooltipMessages => ({
      ready: getRandomMessage([
        'Your AI is alive and ready to chat!',
        'Neural networks activated and standing by!',
        'Artificial consciousness online!',
        'Digital brain fully operational!',
        'AI systems green across the board!',
        'Ready to process your thoughts!',
        'Intelligence successfully summoned!',
        'Your personal AI assistant is awake!',
      ]),
      download: getRandomMessage([
        'Downloading the digital brain of',
        'Acquiring neural pathways for',
        'Fetching billions of parameters for',
        'Streaming consciousness data for',
        'Pulling synaptic weights for',
        'Downloading artificial memories for',
        'Collecting training wisdom for',
        'Gathering intelligence clusters for',
      ]),
      serverStarting: getRandomMessage([
        'Firing up the AI engines...',
        'Initializing neural processing cores...',
        'Booting artificial consciousness...',
        'Warming up the digital brain...',
        'Starting cognitive processing units...',
        'Activating intelligence servers...',
        'Spinning up neural networks...',
        'Powering on AI infrastructure...',
      ]),
      modelLoading: getRandomMessage([
        'Loading billions of neural connections...',
        'Awakening artificial memories...',
        'Initializing cognitive pathways...',
        'Building neural architecture...',
        'Activating synaptic networks...',
        'Constructing digital consciousness...',
        'Assembling intelligence matrices...',
        'Calibrating neural responses...',
      ]),
      initialization: getRandomMessage([
        'Weaving digital consciousness...',
        'Summoning artificial intelligence...',
        'Orchestrating neural symphony...',
        'Breathing life into algorithms...',
        'Awakening silicon dreams...',
        'Birthing digital thoughts...',
        'Cultivating artificial wisdom...',
        'Manifesting computational consciousness...',
      ]),
    }),
    [],
  )

  // Derive display properties from model manager status
  const getStatusDisplay = () => {
    if (error) {
      return {
        type: 'error' as const,
        text: randomMessages.error,
        iconColor: 'text-red-500',
        canRestart: true,
      }
    }

    if (status.isReady) {
      return {
        type: 'ready' as const,
        text: randomMessages.ready,
        iconColor: 'text-green-500',
        canRestart: false,
      }
    }

    if (downloadStatus.hasActiveDownload) {
      return {
        type: 'starting' as const,
        text: randomMessages.download,
        iconColor: 'text-blue-500',
        canRestart: false,
      }
    }

    if (status.model.isLoading) {
      return {
        type: 'starting' as const,
        text: randomMessages.loading,
        iconColor: 'text-orange-500',
        canRestart: false,
      }
    }

    if (!status.server.isRunning || !status.server.isHttpReady) {
      return {
        type: 'starting' as const,
        text: randomMessages.serverStarting,
        iconColor: 'text-orange-500',
        canRestart: false,
      }
    }

    return {
      type: 'starting' as const,
      text: randomMessages.initialization,
      iconColor: 'text-orange-500',
      canRestart: false,
    }
  }

  const statusDisplay = getStatusDisplay()
  const tooltipContent = getModelManagerTooltipContent(
    status,
    downloadStatus,
    tooltipMessages,
  )

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
