import { AlertCircle, CheckCircle } from 'lucide-react'

import { Separator } from '@/components/ui/separator'
import type { McpCheckResult } from '@/types/mcp'

import { ToolItem } from './mcp-tool-item'

interface McpTestResultProps {
  result: McpCheckResult
}

export function McpTestResult({ result }: McpTestResultProps) {
  if (result.ok) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            Connection successful
          </span>
        </div>

        <div className="mt-2 text-sm text-green-700 dark:text-green-300">
          {result.toolsCount === 0 ? (
            'No tools available'
          ) : (
            <>
              {result.tools && result.tools.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <div className="space-y-2">
                    {result.tools.map((tool, index) => (
                      <ToolItem key={index} tool={tool} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {result.warning && (
          <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
            Warning: {result.warning}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <span className="text-sm font-medium text-red-800 dark:text-red-200">
          Connection failed
        </span>
      </div>
      {result.error && (
        <div className="mt-2 text-sm text-red-700 dark:text-red-300">
          {result.error}
        </div>
      )}
    </div>
  )
}
