import { SendIcon } from 'lucide-react'
import React from 'react'

import { Button } from '../ui/button'

import { extractText } from './utils'

interface QuickReplyProps {
  children: React.ReactNode
  onSend?: (text: string) => void
}

export function QuickReply({ children, onSend }: QuickReplyProps) {
  const replyText = extractText(children)

  const handleClick = () => {
    if (onSend && replyText.trim()) {
      onSend(replyText.trim())
    }
  }

  return (
    <span className="my-2 block">
      <Button
        variant="outline"
        size="sm"
        className="mr-2 h-auto whitespace-normal px-3 py-2 text-left"
        onClick={handleClick}
        disabled={!onSend || !replyText.trim()}
      >
        <SendIcon className="mr-2 h-3 w-3 flex-shrink-0" />
        <span className="flex-1">{children}</span>
      </Button>
    </span>
  )
}
