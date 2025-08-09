import { useState } from 'react'

import { useSystemPrompt } from '@/hooks/use-app-settings'
import { DEFAULT_SETTINGS_PROMPT } from '@/lib/prompt'
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
        placeholder={DEFAULT_SETTINGS_PROMPT}
        className={cn(
          'w-full min-h-40 rounded-md border border-input bg-transparent p-3 text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none',
        )}
      />
    </div>
  )
}
