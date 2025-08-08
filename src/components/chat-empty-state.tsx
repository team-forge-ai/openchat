import React from 'react'

export const ChatEmptyState: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full relative">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="empty-aurora">
          <span className="aurora-blob aurora-blob-1" />
          <span className="aurora-blob aurora-blob-2" />
          <span className="aurora-blob aurora-blob-3" />
          <span className="aurora-blob aurora-blob-4" />
        </div>
        <div className="absolute inset-0 h-full w-full bg-gradient-to-b from-transparent to-white dark:to-black" />
      </div>
      <div className="relative z-10 text-center text-foreground">
        <div className="text-lg font-medium mb-2">Welcome to OpenChat</div>
        <div>Send a message to get started.</div>
      </div>
    </div>
  )
}
