import { useState } from 'react'

import { cn } from '@/lib/utils'

import { Button } from './button'

export interface CopyButtonProps {
  text?: string
  getText?: () => string
  className?: string
  ariaLabel?: string
  timeoutMs?: number
}

export function CopyButton({
  text,
  getText,
  className,
  ariaLabel = 'Copy to clipboard',
  timeoutMs = 1500,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const value = text ?? getText?.() ?? ''
    if (!value) {
      return
    }
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), timeoutMs)
  }

  return (
    <Button
      type="button"
      onClick={handleCopy}
      size="icon"
      variant="ghost"
      aria-label={copied ? 'Copied' : ariaLabel}
      className={cn(className, 'w-3 h-3')}
    >
      {copied ? (
        <svg
          className="size-full"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg
          className="size-full"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </Button>
  )
}
