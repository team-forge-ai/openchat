import React, { createContext, useContext, useEffect, useState } from 'react'

import { modelManager, type ModelManagerStatus } from '@/lib/model-manager'

interface ModelManagerContextValue {
  /** Combined status of server and model */
  status: ModelManagerStatus
  /** Whether the system is fully ready (server + model) */
  isReady: boolean
  /** Any error from server or model operations */
  error: string | null
  /** Restart the MLX server */
  restartServer: () => Promise<void>
  /** Switch to a new model (downloads if needed) */
  switchModel: (repoId: string) => Promise<void>
}

const ModelManagerContext = createContext<ModelManagerContextValue | undefined>(
  undefined,
)

interface ModelManagerProviderProps {
  children: React.ReactNode
}

export function ModelManagerProvider({ children }: ModelManagerProviderProps) {
  const [status, setStatus] = useState<ModelManagerStatus>(() =>
    modelManager.getStatus(),
  )

  const isReady = status.isReady
  const error = status.error

  useEffect(() => {
    let removeStatusListener: (() => void) | undefined

    const setup = async () => {
      try {
        // Initialize the model manager
        await modelManager.initialize()

        // Subscribe to status changes
        removeStatusListener = modelManager.addStatusListener((newStatus) => {
          setStatus(newStatus)
        })

        // Update status after initialization
        setStatus(modelManager.getStatus())
      } catch (err) {
        console.error('Failed to setup model manager:', err)
        // Update status to reflect the error
        setStatus(modelManager.getStatus())
      }
    }

    void setup()

    // Cleanup
    return () => {
      removeStatusListener?.()
    }
  }, [])

  const restartServer = async () => {
    await modelManager.restartServer()
  }

  const switchModel = async (repoId: string) => {
    await modelManager.switchModel(repoId)
  }

  const contextValue: ModelManagerContextValue = {
    status,
    isReady,
    error,
    restartServer,
    switchModel,
  }

  return (
    <ModelManagerContext.Provider value={contextValue}>
      {children}
    </ModelManagerContext.Provider>
  )
}

export function useModelManager(): ModelManagerContextValue {
  const context = useContext(ModelManagerContext)
  if (context === undefined) {
    throw new Error(
      'useModelManager must be used within a ModelManagerProvider',
    )
  }
  return context
}
