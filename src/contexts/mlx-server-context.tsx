import React, { createContext, useContext, useEffect, useState } from 'react'

import { mlxServer } from '@/lib/mlx-server'
import type { MLXServerStatus } from '@/types/mlx-server'

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
    isRunning: false,
    isReady: false,
  })
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let removeStatusListener: (() => void) | undefined
    let removeReadyListener: (() => void) | undefined
    let removeRestartingListener: (() => void) | undefined

    const setup = async () => {
      try {
        // Initialize service layer event listeners
        await mlxServer.initializeEventListeners()

        // Get initial status using the service layer
        const initialStatus = await mlxServer.getStatus()
        setStatus(initialStatus)
        setIsInitializing(false)

        // Subscribe to status changes through service layer
        removeStatusListener = mlxServer.addStatusListener((status) => {
          setStatus(status)
          setError(null) // Clear error when status updates successfully
        })

        // Subscribe to ready events through service layer
        removeReadyListener = mlxServer.addReadyListener(() => {
          console.log('MLX server is ready!')
          setIsInitializing(false)
        })

        // Subscribe to restarting events through service layer
        removeRestartingListener = mlxServer.addRestartingListener(() => {
          console.log('MLX server is restarting...')
          setIsInitializing(true)
        })
      } catch (err) {
        console.error('Failed to setup MLX server context:', err)
        setError(err instanceof Error ? err.message : String(err))
        setIsInitializing(false)
      }
    }

    void setup()

    // Cleanup
    return () => {
      removeStatusListener?.()
      removeReadyListener?.()
      removeRestartingListener?.()
    }
  }, [])

  const restartServer = async () => {
    setIsInitializing(true)
    setError(null)

    try {
      await mlxServer.restart()

      // Get updated status after restart
      const newStatus = await mlxServer.getStatus()

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
