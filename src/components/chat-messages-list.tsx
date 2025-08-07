import React, { useEffect, useRef } from 'react'

import type { Message } from '@/types'

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.length === 0 && !isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <div className="text-lg font-medium mb-2">Welcome to OpenChat</div>
            <div>Send a message to get started.</div>
          </div>
        </div>
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
