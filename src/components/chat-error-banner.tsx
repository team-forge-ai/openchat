import { AlertCircle } from 'lucide-react'
import React from 'react'

interface ChatErrorBannerProps {
  error: string
}

export const ChatErrorBanner: React.FC<ChatErrorBannerProps> = ({ error }) => {
  return (
    <div className="border-t border-destructive/20 bg-destructive/10 p-3">
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="w-4 h-4" />
        <span>{error}</span>
      </div>
    </div>
  )
}
