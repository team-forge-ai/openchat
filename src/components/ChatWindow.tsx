import { AlertCircle, Loader2, Send } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Message } from '@/types'

import { ChatMessage } from './ChatMessage'

interface ChatWindowProps {
  messages: Message[]
  onSendMessage: (content: string) => Promise<void>
  isLoading: boolean
  conversationId: number | null
  isDisabled?: boolean
  disabledMessage?: string
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  onSendMessage,
  isLoading,
  conversationId,
  isDisabled = false,
  disabledMessage,
}) => {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading || !conversationId || isDisabled) {
      return
    }

    const messageContent = inputValue.trim()
    setInputValue('')
    setError(null)

    try {
      await onSendMessage(messageContent)
    } catch (error) {
      console.error('Failed to send message:', error)
      // Re-set the input value if the message failed to send
      setInputValue(messageContent)
      setError(
        error instanceof Error ? error.message : 'Failed to send message',
      )
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit(e)
    }
  }

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-lg font-medium mb-2">Welcome to OpenChat</div>
          <div>Select a conversation or create a new one to get started</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <div className="text-lg font-medium mb-2">
                Start a conversation
              </div>
              <div>Send a message to begin chatting</div>
            </div>
          </div>
        ) : (
          <div>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex gap-3 p-4 bg-muted/30">
                <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="flex-1">
                  <div className="text-muted-foreground">AI is thinking...</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="border-t border-destructive/20 bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Disabled message */}
      {isDisabled && disabledMessage && (
        <div className="border-t border-warning/20 bg-warning/10 p-3">
          <div className="flex items-center gap-2 text-sm text-warning-foreground">
            <AlertCircle className="w-4 h-4" />
            <span>{disabledMessage}</span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isDisabled ? 'AI server is not ready...' : 'Type your message...'
            }
            disabled={isLoading || isDisabled}
            className="flex-1"
            autoFocus
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isLoading || isDisabled}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
