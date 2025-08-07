import { Bot, User } from 'lucide-react'
import React from 'react'

import type { Message } from '@/types'

import { Markdown } from './markdown/markdown'
import { ReasoningDisplay } from './reasoning-display'
import { CopyButton } from './ui/copy-button'

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

      <div className="flex-1 min-w-0 relative group">
        <CopyButton
          text={message.content}
          ariaLabel="Copy message"
          className="absolute right-2 bottom-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
        />
        {/* Show reasoning for assistant messages if available */}
        {!isUser && message.reasoning && (
          <ReasoningDisplay reasoning={message.reasoning} />
        )}

        <Markdown className="select-text">{message.content}</Markdown>
        <time
          className="text-xs text-muted-foreground mt-2"
          title={new Date(message.created_at).toLocaleString()}
        >
          {new Date(message.created_at).toLocaleTimeString()}
        </time>
      </div>
    </div>
  )
}
