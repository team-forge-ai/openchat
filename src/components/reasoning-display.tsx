import { Brain, ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from './ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible'

interface ReasoningDisplayProps {
  reasoning: string
  isLoading: boolean
  className?: string
}

export function ReasoningDisplay({
  reasoning,
  isLoading,
  className,
}: ReasoningDisplayProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Calculate character count or approximate token count
  const charCount = reasoning.length
  const approxTokens = Math.ceil(charCount / 4) // Rough approximation

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="flex w-full justify-between text-sm font-medium -mx-5"
        >
          <span className="flex items-center gap-1">
            {isOpen ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : isLoading ? (
              <Brain className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
            {isLoading ? 'Thinking...' : 'Reasoning'}
          </span>
          <span className="text-xs text-purple-600 dark:text-purple-400">
            ~{approxTokens} tokens
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="py-3">
        <div className="prose prose-sm max-w-none dark:prose-invert select-text">
          {reasoning}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
