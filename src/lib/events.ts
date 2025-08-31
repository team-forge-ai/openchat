import { listen, type UnlistenFn } from '@tauri-apps/api/event'

// ==================== Event Constants ====================

export const MENU_NEW_CHAT = 'tauri://menu-new-chat'
export const MENU_OPEN_SETTINGS = 'tauri://menu-open-settings'
export const MENU_RELOAD = 'tauri://menu-reload'

const MLC_STATUS_CHANGED_EVENT = 'mlc-status-changed'
const MLC_DOWNLOAD_PROGRESS_EVENT = 'mlc-download-progress'

// ==================== Type Definitions ====================

// MLC Server Status Events
export interface MlcServerStatus {
  isRunning: boolean
  isHttpReady: boolean
  port?: number
  pid?: number | null
  error?: string | null
}

// Wire type for MLC server status (snake_case from Rust)
interface MlcServerStatusWire {
  is_running: boolean
  is_http_ready: boolean
  port?: number
  pid?: number | null
  error?: string | null
}

// Download Progress Events (camelCase for frontend)
export interface RepoDiscoveredEvent {
  type: 'repoDiscovered'
  repoId: string
  numFiles: number
  totalBytes: number
}

export interface FileStartedEvent {
  type: 'fileStarted'
  repoId: string
  path: string
  totalBytes?: number | null
}

export interface BytesTransferredEvent {
  type: 'bytesTransferred'
  repoId: string
  path: string
  bytes: number
  progressPercent: number
}

export interface FileCompletedEvent {
  type: 'fileCompleted'
  repoId: string
  path: string
}

export interface FileFailedEvent {
  type: 'fileFailed'
  repoId: string
  path: string
  error: string
}

export interface CompletedEvent {
  type: 'completed'
  repoId: string
  filesDownloaded: number
  bytesDownloaded: number
}

export type DownloadProgressEvent =
  | RepoDiscoveredEvent
  | FileStartedEvent
  | BytesTransferredEvent
  | FileCompletedEvent
  | FileFailedEvent
  | CompletedEvent

// Wire types for download progress (snake_case from Rust)
interface DownloadProgressWire {
  type:
    | 'repo_discovered'
    | 'file_started'
    | 'bytes_transferred'
    | 'file_completed'
    | 'file_failed'
    | 'completed'
  repo_id: string
  num_files?: number
  total_bytes?: number | null
  path?: string
  bytes?: number
  error?: string
  files_downloaded?: number
  bytes_downloaded?: number
  progress_percent?: number
}

// ==================== Conversion Utilities ====================

function convertMlcServerStatus(wire: MlcServerStatusWire): MlcServerStatus {
  return {
    isRunning: wire.is_running,
    isHttpReady: wire.is_http_ready,
    port: wire.port,
    pid: wire.pid,
    error: wire.error,
  }
}

function convertDownloadProgressEvent(
  wire: DownloadProgressWire,
): DownloadProgressEvent | null {
  const baseFields = {
    repoId: wire.repo_id,
  }

  switch (wire.type) {
    case 'repo_discovered':
      return {
        type: 'repoDiscovered',
        ...baseFields,
        numFiles: wire.num_files!,
        totalBytes: wire.total_bytes!,
      }
    case 'file_started':
      return {
        type: 'fileStarted',
        ...baseFields,
        path: wire.path!,
        totalBytes: wire.total_bytes ?? null,
      }
    case 'bytes_transferred':
      return {
        type: 'bytesTransferred',
        ...baseFields,
        path: wire.path!,
        bytes: wire.bytes!,
        progressPercent: wire.progress_percent!,
      }
    case 'file_completed':
      return {
        type: 'fileCompleted',
        ...baseFields,
        path: wire.path!,
      }
    case 'file_failed':
      return {
        type: 'fileFailed',
        ...baseFields,
        path: wire.path!,
        error: wire.error!,
      }
    case 'completed':
      return {
        type: 'completed',
        ...baseFields,
        filesDownloaded: wire.files_downloaded!,
        bytesDownloaded: wire.bytes_downloaded!,
      }
    default:
      return null
  }
}

// ==================== Event Listeners ====================

/**
 * Subscribes to MLC server status change events.
 *
 * @param onEvent Callback invoked for each MlcServerStatus update
 * @returns Promise resolving to an unsubscribe function
 */
export async function subscribeToMlcStatusChanges(
  onEvent: (status: MlcServerStatus) => void,
): Promise<UnlistenFn> {
  return await listen<MlcServerStatusWire>(
    MLC_STATUS_CHANGED_EVENT,
    (event) => {
      const status = convertMlcServerStatus(event.payload)
      onEvent(status)
    },
  )
}

/**
 * Subscribes to model download progress events.
 *
 * @param onEvent Callback invoked for each valid DownloadProgressEvent
 * @returns Promise resolving to an unsubscribe function
 */
export async function subscribeToDownloadProgress(
  onEvent: (event: DownloadProgressEvent) => void,
): Promise<UnlistenFn> {
  return await listen<DownloadProgressWire>(
    MLC_DOWNLOAD_PROGRESS_EVENT,
    (event) => {
      const progressEvent = convertDownloadProgressEvent(event.payload)
      if (progressEvent) {
        onEvent(progressEvent)
      }
    },
  )
}

// ==================== Event Utilities ====================

/**
 * Checks if a download progress event is terminal (completed or failed).
 */
export function isTerminalDownloadEvent(
  event: DownloadProgressEvent,
): event is CompletedEvent | FileFailedEvent {
  return event.type === 'completed' || event.type === 'fileFailed'
}

/**
 * Checks if a download progress event indicates an error.
 */
export function isErrorDownloadEvent(
  event: DownloadProgressEvent,
): event is FileFailedEvent {
  return event.type === 'fileFailed'
}
