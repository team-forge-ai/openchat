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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const previousMessageCountRef = useRef<number>(messages.length)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      scrollToBottom()
    }
    previousMessageCountRef.current = messages.length
  }, [messages.length])

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.length === 0 && !isLoading ? (
        <ChatEmptyState />
      ) : (
        <div>
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  )
}
