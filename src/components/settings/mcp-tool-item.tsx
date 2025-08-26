import { Wrench } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import type { McpCheckResult } from '@/types/mcp'

interface ToolItemProps {
  tool: NonNullable<McpCheckResult['tools']>[0]
}

export function ToolItem({ tool }: ToolItemProps) {
  const [showDescription, setShowDescription] = useState(false)

  return (
    <div className="rounded border border-green-200 dark:border-green-700 bg-white dark:bg-green-900/10 p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-3 w-3 text-green-600 dark:text-green-400" />
          <span className="font-medium text-green-900 dark:text-green-100">
            {tool.name}
          </span>
        </div>
        {tool.description && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
            onClick={() => setShowDescription(!showDescription)}
          >
            {showDescription ? 'Hide' : 'Show'} info
          </Button>
        )}
      </div>
      {tool.description && (
        <Collapsible open={showDescription} onOpenChange={setShowDescription}>
          <CollapsibleContent className="mt-2">
            <div className="text-xs text-green-600 dark:text-green-400 leading-relaxed">
              {tool.description}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
