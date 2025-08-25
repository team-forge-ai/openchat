import React, { useEffect, useRef } from 'react'

import type { Message } from '@/types'

import { ChatEmptyState } from './chat-empty-state'
import { ChatMessage } from './chat-message'

interface ChatMessagesListProps {
  messages: Message[]
  isLoading: boolean
}

export const ChatMessagesList: React.FC<ChatMessagesListProps> = ({
  messages,
  isLoading,
}) => {
  const latestMessageAnchorRef = useRef<HTMLDivElement>(null)
  const messageStatuses = messages.flatMap((m) => [m.id, m.status])

  useEffect(() => {
    latestMessageAnchorRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [messageStatuses])

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.length === 0 && !isLoading ? (
        <ChatEmptyState />
      ) : (
        <div>
          {messages.map((message, index) => (
            <React.Fragment key={message.id}>
              {index === messages.length - 1 ? (
                <div ref={latestMessageAnchorRef} />
              ) : null}
              <ChatMessage
                message={message}
                shouldExpand={
                  message.status === 'pending' ||
                  (index === messages.length - 1 &&
                    message.role === 'assistant')
                }
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
