import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import React, { createContext, useContext, useEffect, useState } from 'react'

interface MLXServerStatus {
  is_running: boolean
  port?: number
  model_path?: string
  pid?: number
  error?: string
}

interface MLXServerContextValue {
  status: MLXServerStatus
  isInitializing: boolean
  error: string | null
  restartServer: () => Promise<void>
}

const MLXServerContext = createContext<MLXServerContextValue | undefined>(
  undefined,
)

interface MLXServerProviderProps {
  children: React.ReactNode
}

export function MLXServerProvider({ children }: MLXServerProviderProps) {
  const [status, setStatus] = useState<MLXServerStatus>({
    is_running: false,
  })
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let unlisten: UnlistenFn | undefined

    const setup = async () => {
      try {
        // Get initial status from Rust
        const initialStatus = await invoke<MLXServerStatus>('mlx_get_status')
        setStatus(initialStatus)
        setIsInitializing(false)

        if (initialStatus.error) {
          setError(initialStatus.error)
        }

        // Listen for status changes from Rust
        unlisten = await listen<MLXServerStatus>(
          'mlx-status-changed',
          (event) => {
            console.log('MLX server status changed:', event.payload)
            setStatus(event.payload)

            if (event.payload.error) {
              setError(event.payload.error)
            } else {
              setError(null)
            }
          },
        )

        // Listen for ready event
        const unlistenReady = await listen('mlx-ready', () => {
          console.log('MLX server is ready!')
          setIsInitializing(false)
        })

        // Listen for restarting event
        const unlistenRestarting = await listen('mlx-restarting', () => {
          console.log('MLX server is restarting...')
          setIsInitializing(true)
        })

        // Clean up additional listeners
        return () => {
          unlistenReady()
          unlistenRestarting()
        }
      } catch (err) {
        console.error('Failed to setup MLX server context:', err)
        setError(err instanceof Error ? err.message : String(err))
        setIsInitializing(false)
      }
    }

    void setup()

    // Cleanup
    return () => {
      unlisten?.()
    }
  }, [])

  const restartServer = async () => {
    setIsInitializing(true)
    setError(null)

    try {
      const newStatus = await invoke<MLXServerStatus>('mlx_restart')
      setStatus(newStatus)
      console.log('MLX server restarted successfully:', newStatus)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('Failed to restart MLX server:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsInitializing(false)
    }
  }

  return (
    <MLXServerContext.Provider
      value={{
        status,
        isInitializing,
        error,
        restartServer,
      }}
    >
      {children}
    </MLXServerContext.Provider>
  )
}

export function useMLXServer() {
  const context = useContext(MLXServerContext)
  if (!context) {
    throw new Error('useMLXServer must be used within MLXServerProvider')
  }
  return context
}
