import { Bot } from 'lucide-react'
import React from 'react'

import { Skeleton } from '@/components/ui/skeleton'
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

  if (message.role === 'assistant' && !message.content && !message.reasoning) {
    return <AssistantMessageSkeleton />
  }

  return (
    <div className={`flex p-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative group max-w-[75%] ${
          isUser ? 'rounded-2xl px-4 py-2 bg-slate-100' : 'p-4'
        }`}
      >
        {message.content && (
          <CopyButton
            text={message.content}
            ariaLabel="Copy message"
            className="absolute right-2 bottom-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          />
        )}

        {!isUser && message.reasoning && (
          <ReasoningDisplay
            reasoning={message.reasoning}
            isLoading={!message.content}
          />
        )}

        {message.content && (
          <Markdown
            className={`select-text mt-1 max-w-none ${
              isUser ? 'prose-sm' : 'prose-sm md:prose-base'
            }`}
          >
            {message.content}
          </Markdown>
        )}

        <time
          className="mt-2 block text-xs text-muted-foreground"
          title={new Date(message.created_at).toLocaleString()}
        >
          {new Date(message.created_at).toLocaleTimeString()}
        </time>
      </div>
    </div>
  )
}

function AssistantMessageSkeleton() {
  return (
    <div className="flex gap-3 p-4 bg-muted/30">
      <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 opacity-50" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}
