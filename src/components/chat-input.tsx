import { Loader2, Send } from 'lucide-react'
import React, { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled, focusKey])

  return (
    <div className="border-t border-border p-4">
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onEnterKey}
          placeholder={disabled ? 'AI is not ready...' : 'Type your message...'}
          className="flex-1"
          autoFocus
        />
        <Button
          type="submit"
          disabled={!value.trim() || disabled}
          size="icon"
          aria-label="Send message"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
    </div>
  )
}
