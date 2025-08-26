import React from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

import { Markdown } from './markdown/markdown'
import { ReasoningDisplay } from './reasoning-display'
import { CopyButton } from './ui/copy-button'

interface ChatMessageProps {
  message: Message
  shouldExpand?: boolean
  onSendMessage?: (text: string) => void
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  shouldExpand,
}) => {
  const isUser = message.role === 'user'

  if (message.role === 'assistant' && !message.content && !message.reasoning) {
    return <AssistantMessageSkeleton />
  }

  return (
    <div
      className={cn(
        'flex p-3',
        shouldExpand && 'min-h-[calc(100vh-130px)]',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={`relative group ${
          isUser
            ? 'rounded-2xl px-4 py-2 bg-slate-100 dark:bg-slate-900'
            : 'p-4'
        }`}
      >
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

        {message.status === 'complete' && (
          <footer className="flex items-center justify-center gap-2 mt-1 group">
            <time
              className="text-xs text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity"
              title={new Date(message.created_at).toLocaleString()}
            >
              {new Date(message.created_at).toLocaleTimeString()}
            </time>

            <div className="flex-1" />

            {message.content && (
              <CopyButton
                text={message.content}
                ariaLabel="Copy message"
                className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              />
            )}
          </footer>
        )}
      </div>
    </div>
  )
}

function AssistantMessageSkeleton() {
  return (
    <div className="flex gap-3 p-4">
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}
