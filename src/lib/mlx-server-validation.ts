import { invoke } from '@tauri-apps/api/core'

import {
  DEFAULT_CONFIG,
  MLXServerAlreadyRunningError,
  MLXServerStartupError,
} from '@/types/mlx-server'

interface PortInfo {
  port: number
  is_available: boolean
  is_mlx_server: boolean
}

// Default port range to try when the preferred port is unavailable
const PORT_RANGE = {
  START: 8000,
  END: 8010,
}

/**
 * Check if a port is available using Tauri's native port checking
 */
export async function checkPortAvailable(port: number): Promise<boolean> {
  try {
    const available = await invoke<boolean>('check_port_available', { port })
    if (!available) {
      console.log(`Port ${port} is already in use`)
    }
    return available
  } catch (error) {
    console.error('Error checking port availability:', error)
    throw new MLXServerStartupError(
      `Failed to check port availability: ${error}`,
    )
  }
}

/**
 * Get detailed information about what's using a port
 */
export async function getPortInfo(port: number): Promise<PortInfo> {
  try {
    return await invoke<PortInfo>('get_port_info', { port })
  } catch (error) {
    console.error('Error getting port info:', error)
    throw new MLXServerStartupError(`Failed to get port info: ${error}`)
  }
}

/**
 * Find an available port starting from the preferred port
 * @param preferredPort - The port to try first
 * @param maxAttempts - Maximum number of ports to try
 * @returns The first available port found
 */
export async function findAvailablePort(
  preferredPort: number = DEFAULT_CONFIG.PORT,
  maxAttempts: number = 10,
): Promise<number> {
  console.log(`Looking for available port starting from ${preferredPort}...`)

  // First try the preferred port
  const preferredPortInfo = await getPortInfo(preferredPort)

  if (preferredPortInfo.is_available) {
    console.log(`Preferred port ${preferredPort} is available`)
    return preferredPort
  }

  if (preferredPortInfo.is_mlx_server) {
    console.warn(`Port ${preferredPort} is already in use by an MLX server`)
    throw new MLXServerAlreadyRunningError()
  }

  console.log(
    `Preferred port ${preferredPort} is in use, searching for alternatives...`,
  )

  // Try ports in the range
  const startPort = Math.max(PORT_RANGE.START, preferredPort + 1)
  const endPort = Math.min(PORT_RANGE.END, preferredPort + maxAttempts)

  for (let port = startPort; port <= endPort; port++) {
    try {
      const portInfo = await getPortInfo(port)

      if (portInfo.is_available) {
        console.log(`Found available port: ${port}`)
        return port
      }

      if (portInfo.is_mlx_server) {
        console.log(`Port ${port} has an MLX server, skipping...`)
        continue
      }
    } catch (error) {
      console.error(`Error checking port ${port}:`, error)
      continue
    }
  }

  // If we still haven't found a port, try going backwards from preferred port
  const backwardStart = Math.max(PORT_RANGE.START, preferredPort - maxAttempts)
  const backwardEnd = preferredPort - 1

  for (let port = backwardEnd; port >= backwardStart; port--) {
    try {
      const portInfo = await getPortInfo(port)

      if (portInfo.is_available) {
        console.log(`Found available port: ${port}`)
        return port
      }

      if (portInfo.is_mlx_server) {
        console.log(`Port ${port} has an MLX server, skipping...`)
        continue
      }
    } catch (error) {
      console.error(`Error checking port ${port}:`, error)
      continue
    }
  }

  throw new MLXServerStartupError(
    `No available ports found in range ${backwardStart}-${endPort}`,
  )
}

/**
 * Validate port availability and check what's using it
 * @deprecated Use findAvailablePort instead for automatic port selection
 */
export async function validatePort(port: number): Promise<void> {
  const portInfo = await getPortInfo(port)

  if (!portInfo.is_available) {
    if (portInfo.is_mlx_server) {
      console.warn(
        `Port ${port} is already in use by what appears to be an MLX server`,
      )
      throw new MLXServerAlreadyRunningError()
    } else {
      throw new MLXServerStartupError(
        `Port ${port} is already in use by another process`,
      )
    }
  }
}

/**
 * Validate server state before starting
 */
export function validateServerState(state: {
  isRunning: boolean
  child: { pid?: number } | null
  command: unknown
}): void {
  // Check instance state consistency
  if (state.isRunning || state.child || state.command) {
    console.log('Server state check:', {
      isRunning: state.isRunning,
      hasChild: !!state.child,
      hasCommand: !!state.command,
      pid: state.child?.pid,
    })

    if (state.isRunning) {
      throw new MLXServerAlreadyRunningError()
    }

    // Clean state will be handled by the caller
    console.log('Inconsistent state detected, cleanup required')
  }
}
