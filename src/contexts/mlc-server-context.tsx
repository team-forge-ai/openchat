import React, { createContext, useContext, useEffect, useState } from 'react'

import { mlcServer } from '@/lib/mlc-server'
import type { MLCStatus } from '@/types/mlc-server'

interface MLCServerContextValue {
  status: MLCStatus
  error: string | null
  restartServer: () => Promise<void>
  isReady: boolean
}

const MLCServerContext = createContext<MLCServerContextValue | undefined>(
  undefined,
)

interface MLCServerProviderProps {
  children: React.ReactNode
}

export function MLCServerProvider({ children }: MLCServerProviderProps) {
  const [status, setStatus] = useState<MLCStatus>({
    isReady: false,
    port: undefined,
    error: null,
  })
  const [error, setError] = useState<string | null>(null)

  const isReady = status.isReady

  useEffect(() => {
    let removeStatusListener: (() => void) | undefined

    const setup = async () => {
      try {
        // Initialize service layer event listeners
        await mlcServer.initializeEventListeners()

        // Get initial status using the service layer
        const initialStatus = await mlcServer.fetchStatus()
        setStatus(initialStatus)

        // If server is not ready, start it
        if (!initialStatus.isReady) {
          console.log('MLC server not ready, starting...')
          try {
            await mlcServer.start()
          } catch (err) {
            console.error('Failed to start MLC server:', err)
            setError(err instanceof Error ? err.message : String(err))
          }
        }

        // Subscribe to status changes through service layer
        removeStatusListener = mlcServer.addStatusListener((status) => {
          setStatus(status)
          setError(null) // Clear error when status updates successfully
        })
      } catch (err) {
        console.error('Failed to setup MLC server context:', err)
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
      await mlcServer.restart()

      // Get updated status after restart
      const newStatus = await mlcServer.fetchStatus()

      setStatus(newStatus)
      console.log('MLC server restarted successfully:', newStatus)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('Failed to restart MLC server:', errorMessage)
      setError(errorMessage)
    }
  }

  return (
    <MLCServerContext.Provider
      value={{
        status,
        error,
        restartServer,
        isReady,
      }}
    >
      {children}
    </MLCServerContext.Provider>
  )
}

export function useMLCServer() {
  const context = useContext(MLCServerContext)
  if (!context) {
    throw new Error('useMLCServer must be used within MLCServerProvider')
  }
  return context
}
