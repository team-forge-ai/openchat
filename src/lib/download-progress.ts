import { listen } from '@tauri-apps/api/event'

import {
  MLC_DOWNLOAD_PROGRESS_EVENT,
  parseDownloadProgressEvent,
  type DownloadProgressEvent,
} from '@/types/download'

export type Unsubscribe = () => void

export async function subscribeDownloadProgress(
  onEvent: (evt: DownloadProgressEvent) => void,
): Promise<Unsubscribe> {
  const unlisten = await listen(MLC_DOWNLOAD_PROGRESS_EVENT, (e) => {
    const normalized = parseDownloadProgressEvent(e.payload)
    if (normalized) {
      onEvent(normalized)
    }
  })
  return () => {
    unlisten()
  }
}
