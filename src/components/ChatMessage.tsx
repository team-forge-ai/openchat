import { Bot, User } from 'lucide-react'
import React from 'react'

import type { Message } from '@/types'

import { Markdown } from './markdown/markdown'
import { ReasoningDisplay } from './reasoning-display'

interface ChatMessageProps {
  message: Message
  onSendMessage?: (text: string) => void
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
        {/* Show reasoning for assistant messages if available */}
        {!isUser && message.reasoning && (
          <ReasoningDisplay reasoning={message.reasoning} />
        )}

        <Markdown>{message.content}</Markdown>
        <div className="text-xs text-muted-foreground mt-2">
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
