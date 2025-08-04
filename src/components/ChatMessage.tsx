import { Bot, User } from 'lucide-react'
import React from 'react'

import type { Message } from '@/types'

interface ChatMessageProps {
  message: Message
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex gap-3 p-4 ${isUser ? 'bg-background' : 'bg-muted/30'}`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
