import type { ReactNode } from 'react'

import type { DownloadStatusInfo } from '@/hooks/use-download-status'
import type { ModelManagerStatus } from '@/lib/model-manager'

// Fun status message collections
const READY_MESSAGES = [
  'Your AI is alive and ready to chat!',
  'Neural networks activated and standing by!',
  'Artificial consciousness online!',
  'Digital brain fully operational!',
  'AI systems green across the board!',
  'Ready to process your thoughts!',
  'Intelligence successfully summoned!',
  'Your personal AI assistant is awake!',
]

const DOWNLOAD_MESSAGES = [
  'Downloading the digital brain of',
  'Acquiring neural pathways for',
  'Fetching billions of parameters for',
  'Streaming consciousness data for',
  'Pulling synaptic weights for',
  'Downloading artificial memories for',
  'Collecting training wisdom for',
  'Gathering intelligence clusters for',
]

const SERVER_STARTING_MESSAGES = [
  'Firing up the AI engines...',
  'Initializing neural processing cores...',
  'Booting artificial consciousness...',
  'Warming up the digital brain...',
  'Starting cognitive processing units...',
  'Activating intelligence servers...',
  'Spinning up neural networks...',
  'Powering on AI infrastructure...',
]

const MODEL_LOADING_MESSAGES = [
  'Loading billions of neural connections...',
  'Awakening artificial memories...',
  'Initializing cognitive pathways...',
  'Building neural architecture...',
  'Activating synaptic networks...',
  'Constructing digital consciousness...',
  'Assembling intelligence matrices...',
  'Calibrating neural responses...',
]

const INITIALIZATION_MESSAGES = [
  'Weaving digital consciousness...',
  'Summoning artificial intelligence...',
  'Orchestrating neural symphony...',
  'Breathing life into algorithms...',
  'Awakening silicon dreams...',
  'Birthing digital thoughts...',
  'Cultivating artificial wisdom...',
  'Manifesting computational consciousness...',
]

/**
 * Randomly selects a message from an array
 */
function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)]
}

export interface RandomTooltipMessages {
  ready: string
  download: string
  serverStarting: string
  modelLoading: string
  initialization: string
}

/**
 * Generates tooltip content based on model manager and download status
 */
export function getModelManagerTooltipContent(
  status: ModelManagerStatus,
  downloadStatus: DownloadStatusInfo,
  randomMessages?: RandomTooltipMessages,
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

  // Use provided random messages or generate new ones
  const messages = randomMessages || {
    ready: getRandomMessage(READY_MESSAGES),
    download: getRandomMessage(DOWNLOAD_MESSAGES),
    serverStarting: getRandomMessage(SERVER_STARTING_MESSAGES),
    modelLoading: getRandomMessage(MODEL_LOADING_MESSAGES),
    initialization: getRandomMessage(INITIALIZATION_MESSAGES),
  }

  // Ready state
  if (status.isReady) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <span className="font-semibold text-muted-foreground/80">
            Status:
          </span>
          <span className="text-xs">{messages.ready}</span>
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
    return (
      <div className="space-y-1">
        Status: {messages.download} {downloadStatus.repoId ?? 'your AI'}...
      </div>
    )
  }

  // Server not ready
  if (!status.server.isRunning || !status.server.isHttpReady) {
    return <div className="space-y-1">Status: {messages.serverStarting}</div>
  }

  // Model loading
  if (status.model.isLoading) {
    return <div className="space-y-1">Status: {messages.modelLoading}</div>
  }

  return messages.initialization
}
