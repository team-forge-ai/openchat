import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Plus, X } from 'lucide-react'
import { useCallback, useState } from 'react'

import { cn } from '@/lib/utils'

interface TitlebarProps {
  className?: string
}

export function Titlebar({ className }: TitlebarProps) {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null)

  const handleMinimize = useCallback(async () => {
    const appWindow = getCurrentWindow()
    await appWindow.minimize()
  }, [])

  const handleMaximize = useCallback(async () => {
    const appWindow = getCurrentWindow()
    await appWindow.toggleMaximize()
  }, [])

  const handleClose = useCallback(async () => {
    const appWindow = getCurrentWindow()
    await appWindow.close()
  }, [])

  return (
    <div
      data-tauri-drag-region
      className={cn('z-50 flex h-8 select-none items-center', className)}
    >
      <div className="flex items-center gap-2 pl-3">
        {/* Close Button - Red */}
        <button
          onClick={handleClose}
          onMouseEnter={() => setHoveredButton('close')}
          onMouseLeave={() => setHoveredButton(null)}
          className="group relative flex h-3 w-3 items-center justify-center rounded-full bg-red-500 transition-all duration-150 hover:bg-red-600"
          title="Close"
          type="button"
        >
          {hoveredButton === 'close' && (
            <X className="h-2 w-2 text-red-900 opacity-60" strokeWidth={3} />
          )}
        </button>

        {/* Minimize Button - Yellow */}
        <button
          onClick={handleMinimize}
          onMouseEnter={() => setHoveredButton('minimize')}
          onMouseLeave={() => setHoveredButton(null)}
          className="group relative flex h-3 w-3 items-center justify-center rounded-full bg-yellow-500 transition-all duration-150 hover:bg-yellow-600"
          title="Minimize"
          type="button"
        >
          {hoveredButton === 'minimize' && (
            <Minus
              className="h-2 w-2 text-yellow-900 opacity-60"
              strokeWidth={3}
            />
          )}
        </button>

        {/* Maximize Button - Green */}
        <button
          onClick={handleMaximize}
          onMouseEnter={() => setHoveredButton('maximize')}
          onMouseLeave={() => setHoveredButton(null)}
          className="group relative flex h-3 w-3 items-center justify-center rounded-full bg-green-500 transition-all duration-150 hover:bg-green-600"
          title="Maximize"
          type="button"
        >
          {hoveredButton === 'maximize' && (
            <Plus
              className="h-2 w-2 text-green-900 opacity-60"
              strokeWidth={3}
            />
          )}
        </button>
      </div>
    </div>
  )
}
