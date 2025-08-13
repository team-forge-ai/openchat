import { z } from 'zod'

export const MLC_DOWNLOAD_PROGRESS_EVENT = 'mlc-download-progress'

// Raw snake_case payloads from Rust (as emitted by serde)
const RawRepoDiscovered = z.object({
  type: z.literal('repo_discovered'),
  repo_id: z.string(),
  num_files: z.number(),
  total_bytes: z.number(),
})
const RawFileStarted = z.object({
  type: z.literal('file_started'),
  repo_id: z.string(),
  path: z.string(),
  total_bytes: z.number().optional().nullable(),
})
const RawBytesTransferred = z.object({
  type: z.literal('bytes_transferred'),
  repo_id: z.string(),
  path: z.string(),
  bytes: z.number(),
})
const RawFileCompleted = z.object({
  type: z.literal('file_completed'),
  repo_id: z.string(),
  path: z.string(),
})
const RawFileFailed = z.object({
  type: z.literal('file_failed'),
  repo_id: z.string(),
  path: z.string(),
  error: z.string(),
})
const RawCompleted = z.object({
  type: z.literal('completed'),
  repo_id: z.string(),
  files_downloaded: z.number(),
  bytes_downloaded: z.number(),
})

const RawDownloadProgressEventSchema = z.discriminatedUnion('type', [
  RawRepoDiscovered,
  RawFileStarted,
  RawBytesTransferred,
  RawFileCompleted,
  RawFileFailed,
  RawCompleted,
])
export type RawDownloadProgressEvent = z.infer<
  typeof RawDownloadProgressEventSchema
>

// Normalized camelCase payloads for the frontend
export interface RepoDiscoveredEvent {
  type: 'repo_discovered'
  repoId: string
  numFiles: number
  totalBytes: number
}
export interface FileStartedEvent {
  type: 'file_started'
  repoId: string
  path: string
  totalBytes?: number | null
}
export interface BytesTransferredEvent {
  type: 'bytes_transferred'
  repoId: string
  path: string
  bytes: number
}
export interface FileCompletedEvent {
  type: 'file_completed'
  repoId: string
  path: string
}
export interface FileFailedEvent {
  type: 'file_failed'
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

export function parseDownloadProgressEvent(
  value: unknown,
): DownloadProgressEvent | null {
  const result = RawDownloadProgressEventSchema.safeParse(value)
  if (!result.success) {
    return null
  }
  const e = result.data
  switch (e.type) {
    case 'repo_discovered':
      return {
        type: e.type,
        repoId: e.repo_id,
        numFiles: e.num_files,
        totalBytes: e.total_bytes,
      }
    case 'file_started':
      return {
        type: e.type,
        repoId: e.repo_id,
        path: e.path,
        totalBytes: e.total_bytes ?? null,
      }
    case 'bytes_transferred':
      return { type: e.type, repoId: e.repo_id, path: e.path, bytes: e.bytes }
    case 'file_completed':
      return { type: e.type, repoId: e.repo_id, path: e.path }
    case 'file_failed':
      return { type: e.type, repoId: e.repo_id, path: e.path, error: e.error }
    case 'completed':
      return {
        type: e.type,
        repoId: e.repo_id,
        filesDownloaded: e.files_downloaded,
        bytesDownloaded: e.bytes_downloaded,
      }
    default:
      return null
  }
}

export function isTerminalEvent(
  e: DownloadProgressEvent,
): e is CompletedEvent | FileFailedEvent {
  return e.type === 'completed' || e.type === 'file_failed'
}

export function isErrorEvent(e: DownloadProgressEvent): e is FileFailedEvent {
  return e.type === 'file_failed'
}
