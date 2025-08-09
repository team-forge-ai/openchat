import { Send, Square } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

import { ChatToolsDropdown } from './chat/chat-tools-dropdown'
// tools dropdown provided by parent via toolsDropdown prop
// Dropdown provided via toolsDropdown prop

interface ChatInputProps {
  onSubmit: (text: string) => void
  disabled: boolean
  isLoading?: boolean
  focusKey?: number
  onAbort?: () => void
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSubmit,
  disabled,
  isLoading = false,
  focusKey,
  onAbort,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')

  const resizeTextarea = () => {
    const el = inputRef.current
    if (!el) {
      return
    }
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled, focusKey])

  useEffect(() => {
    resizeTextarea()
  }, [text])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) {
      return
    }
    onSubmit(trimmed)
    setText('')
    // Reset height after clearing
    requestAnimationFrame(() => resizeTextarea())
  }

  return (
    <div className="border-t border-border p-4">
      <form onSubmit={handleFormSubmit} className="flex w-full">
        {(() => {
          const lines = Math.max(1, text.split('\n').length)
          const radiusClass =
            lines <= 1
              ? 'rounded-full'
              : lines <= 3
                ? 'rounded-2xl'
                : lines <= 5
                  ? 'rounded-xl'
                  : 'rounded-lg'
          return (
            <div
              className={`flex w-full relative items-center gap-1 ${radiusClass} border border-input bg-muted/50 px-2 py-1.5 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]`}
            >
              <div className="absolute left-2">
                <ChatToolsDropdown />
              </div>

              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleFormSubmit(e)
                  }
                }}
                placeholder="Ask anything"
                className="flex-1 pl-10 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-0 resize-none leading-6 py-1.5 min-h-[1.5rem] max-h-40 outline-none"
                rows={1}
                autoFocus
              />

              {isLoading && onAbort ? (
                <Button
                  type="button"
                  onClick={() => onAbort()}
                  size="icon"
                  variant="destructive"
                  className="rounded-full"
                  aria-label="Abort generation"
                >
                  <Square className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!text.trim() || disabled}
                  size="icon"
                  className="rounded-full"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
          )
        })()}
      </form>
    </div>
  )
}
