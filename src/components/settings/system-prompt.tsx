import { useState } from 'react'

import { useSystemPrompt } from '@/hooks/use-app-settings'
import { cn } from '@/lib/utils'

export function SystemPromptSettings() {
  const { systemPrompt, setSystemPrompt } = useSystemPrompt()
  const [value, setValue] = useState(systemPrompt || '')

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setSystemPrompt(value)}
        placeholder="Type a system prompt to guide the assistant"
        className={cn(
          'w-full min-h-40 rounded-md border border-input bg-transparent p-3 text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none',
        )}
      />
      <div className="mt-2 text-xs text-muted-foreground">
        Saved automatically.
      </div>
    </div>
  )
}
