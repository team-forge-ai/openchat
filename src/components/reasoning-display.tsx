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
}

export function ReasoningDisplay({ reasoning }: ReasoningDisplayProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Calculate character count or approximate token count
  const charCount = reasoning.length
  const approxTokens = Math.ceil(charCount / 4) // Rough approximation

  return (
    <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex w-full justify-between p-3 text-sm font-medium text-blue-700 hover:bg-blue-100/50 dark:text-blue-300 dark:hover:bg-blue-900/30"
          >
            <span className="flex items-center gap-2">
              {isOpen ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
              <Brain className="h-4 w-4" />
              Reasoning process
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400">
              ~{approxTokens} tokens
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-blue-200 p-3 dark:border-blue-800">
          <div className="prose prose-sm max-w-none text-blue-900 dark:prose-invert dark:text-blue-100">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
              {reasoning}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
