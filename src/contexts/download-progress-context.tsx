import React from 'react'

import type { DownloadProgressEvent } from '@/lib/events'
import { subscribeToDownloadProgress } from '@/lib/events'

type Status = 'idle' | 'downloading' | 'failed' | 'completed'

export interface DownloadProgressState {
  status: Status
  totalBytes?: number | null
  receivedBytes: number
  filesCompleted: number
  filesFailed: number
  lastFile?: string
}

const initialState: DownloadProgressState = {
  status: 'idle',
  totalBytes: null,
  receivedBytes: 0,
  filesCompleted: 0,
  filesFailed: 0,
}

type Action = { type: 'reset' } | { type: 'event'; evt: DownloadProgressEvent }

function reducer(
  state: DownloadProgressState,
  action: Action,
): DownloadProgressState {
  switch (action.type) {
    case 'reset':
      return initialState
    case 'event': {
      const event = action.evt
      switch (event.type) {
        case 'repoDiscovered':
          return {
            ...initialState,
            status: 'downloading',
            totalBytes: event.totalBytes,
          }
        case 'fileStarted':
          return {
            ...state,
            status: 'downloading',
            lastFile: event.path,
          }
        case 'bytesTransferred':
          return {
            ...state,
            status: 'downloading',
            receivedBytes: state.receivedBytes + event.bytes,
          }
        case 'fileCompleted':
          return {
            ...state,
            status: 'downloading',
            filesCompleted: state.filesCompleted + 1,
            lastFile: event.path,
          }
        case 'fileFailed':
          return {
            ...state,
            status: 'failed',
            filesFailed: state.filesFailed + 1,
            lastFile: event.path,
          }
        case 'completed':
          return { ...state, status: 'completed' }
        default:
          return state
      }
    }
    default:
      return state
  }
}

type RepoProgressMap = Record<string, DownloadProgressState>
const DownloadProgressContext = React.createContext<RepoProgressMap>({})

export function DownloadProgressProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [stateMap, setStateMap] = React.useState<
    Record<string, DownloadProgressState>
  >({})
  const dispatchFor = React.useCallback(
    (repoId: string, evt: DownloadProgressEvent) => {
      setStateMap((prev) => {
        const current = prev[repoId] ?? initialState
        const next = reducer(current, { type: 'event', evt })
        return { ...prev, [repoId]: next }
      })
    },
    [],
  )

  React.useEffect(() => {
    let raf = 0
    let pendingBytes = 0
    let unsub: null | (() => void) = null
    const attach = async () => {
      unsub = await subscribeToDownloadProgress((evt) => {
        const repoId = evt.repoId
        if (evt.type === 'bytesTransferred') {
          pendingBytes += evt.bytes
          if (!raf) {
            raf = requestAnimationFrame(() => {
              dispatchFor(repoId, {
                ...evt,
                bytes: pendingBytes,
              })
              pendingBytes = 0
              raf = 0
            })
          }
        } else {
          dispatchFor(repoId, evt)
        }
      })
    }
    void attach()
    return () => {
      if (raf) {
        cancelAnimationFrame(raf)
      }
      if (unsub) {
        unsub()
      }
    }
  }, [dispatchFor])

  return (
    <DownloadProgressContext.Provider value={stateMap}>
      {children}
    </DownloadProgressContext.Provider>
  )
}

export function useDownloadProgress() {
  return React.useContext(DownloadProgressContext)
}

export function useActiveDownloads(): Array<{
  repoId: string
  state: DownloadProgressState
}> {
  const map = React.useContext(DownloadProgressContext)
  return Object.entries(map)
    .filter(([, state]) => state.status === 'downloading')
    .map(([repoId, state]) => ({ repoId, state }))
}
