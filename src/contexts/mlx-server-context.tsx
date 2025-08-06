import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

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
  children: ReactNode
  modelPath?: string
}

export function MLXServerProvider({
  children,
  modelPath = 'models/Qwen3-0.6B-MLX-4bit',
}: MLXServerProviderProps) {
  const [status, setStatus] = useState<MLXServerStatus>({
    isRunning: false,
    port: undefined,
    modelPath: undefined,
    pid: null,
  })
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initializeServer = async () => {
    setIsInitializing(true)
    setError(null)

    try {
      console.log('Starting MLX server with model:', modelPath)

      await mlxServer.start({
        modelPath,
        port: 8000,
        host: '127.0.0.1',
        logLevel: 'INFO',
        maxTokens: 500,
        temperature: 0.7,
      })

      const serverStatus = mlxServer.getStatus()
      setStatus(serverStatus)
      console.log('MLX server started successfully:', serverStatus)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('Failed to start MLX server:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsInitializing(false)
    }
  }

  const restartServer = async () => {
    try {
      // Stop the server if it's running
      if (status.isRunning) {
        await mlxServer.stop()
      }
      // Restart it
      await initializeServer()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
    }
  }

  // Initialize server on mount
  useEffect(() => {
    void initializeServer()

    // Cleanup: stop server on unmount
    return () => {
      mlxServer.stop().catch((err) => {
        console.error('Error stopping MLX server on cleanup:', err)
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic health check
  useEffect(() => {
    if (!status.isRunning) {
      return
    }

    const interval = setInterval(async () => {
      const isHealthy = await mlxServer.healthCheck()
      if (!isHealthy && status.isRunning) {
        console.warn('MLX server health check failed')
        setStatus(mlxServer.getStatus())
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [status.isRunning])

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
  if (context === undefined) {
    throw new Error('useMLXServer must be used within a MLXServerProvider')
  }
  return context
}
