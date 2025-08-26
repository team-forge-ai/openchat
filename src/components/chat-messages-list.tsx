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
  const lastMessage = messages[messages.length - 1]
  const shouldScrollToPendingMessage = lastMessage?.status === 'pending'
  const shouldScrollToLatestMessage = lastMessage?.content.length > 0

  useEffect(() => {
    if (shouldScrollToPendingMessage || shouldScrollToLatestMessage) {
      latestMessageAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [shouldScrollToPendingMessage, shouldScrollToLatestMessage])

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
