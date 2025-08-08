import { Loader2, Mic, Plus, Send } from 'lucide-react'
import React, { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  onEnterKey: (e: React.KeyboardEvent) => void
  disabled: boolean
  isLoading?: boolean
  focusKey?: number
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  onEnterKey,
  disabled,
  isLoading = false,
  focusKey,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled, focusKey])

  return (
    <div className="border-t border-border p-4">
      <form onSubmit={onSubmit} className="flex w-full">
        <div className="flex w-full relative items-center gap-1 rounded-full border border-input bg-muted/50 px-2 py-1.5 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Add"
            className="absolute left-2 rounded-full"
          >
            <Plus className="w-4 h-4" />
          </Button>

          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onEnterKey}
            placeholder={disabled ? 'AI is not ready...' : 'Ask anything'}
            className="flex-1 pl-10 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-0 resize-none leading-6 py-1.5 min-h-[1.5rem] max-h-40 outline-none"
            rows={1}
            autoFocus
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Microphone"
          >
            <Mic className="w-4 h-4" />
          </Button>

          <Button
            type="submit"
            disabled={!value.trim() || disabled}
            size="icon"
            className="rounded-full"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
