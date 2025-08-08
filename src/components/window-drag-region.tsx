import { cn } from '@/lib/utils'

interface WindowDragRegionProps {
  className?: string
  children?: React.ReactNode
}

export function WindowDragRegion({
  className,
  children,
}: WindowDragRegionProps) {
  return (
    <div data-tauri-drag-region className={cn('select-none', className)}>
      {children}
    </div>
  )
}
