import { cn } from '@/lib/utils'

interface WindowDragBarProps {
  className?: string
}

export function WindowDragBar({ className }: WindowDragBarProps) {
  return (
    <div
      data-tauri-drag-region
      className={cn('z-50 h-8 select-none', className)}
    ></div>
  )
}
