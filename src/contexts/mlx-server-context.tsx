import React, { createContext, useContext, useEffect, useState } from 'react'

import { mlxServer } from '@/lib/mlx-server'
import type { MLXServerStatus } from '@/types/mlx-server'

interface MLXServerContextValue {
  status: MLXServerStatus
  error: string | null
  restartServer: () => Promise<void>
  isReady: boolean
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
    isHttpReady: false,
    isModelReady: false,
  })
  const [error, setError] = useState<string | null>(null)

  const isReady = status.isRunning && status.isHttpReady && status.isModelReady

  useEffect(() => {
    let removeStatusListener: (() => void) | undefined

    const setup = async () => {
      try {
        // Initialize service layer event listeners
        await mlxServer.initializeEventListeners()

        // Get initial status using the service layer
        const initialStatus = await mlxServer.getStatus()
        setStatus(initialStatus)

        // Subscribe to status changes through service layer
        removeStatusListener = mlxServer.addStatusListener((status) => {
          setStatus(status)
          setError(null) // Clear error when status updates successfully
        })
      } catch (err) {
        console.error('Failed to setup MLX server context:', err)
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    void setup()

    // Cleanup
    return () => {
      removeStatusListener?.()
    }
  }, [])

  const restartServer = async () => {
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
    }
  }

  return (
    <MLXServerContext.Provider
      value={{
        status,
        error,
        restartServer,
        isReady,
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
