import { MailIcon } from 'lucide-react'
import React from 'react'

import { Button } from '../ui/button'

import { extractText } from './utils'

interface EmailArtifactProps {
  subject?: string
  to?: string
  children: React.ReactNode
}

export function EmailArtifact({ subject, to, children }: EmailArtifactProps) {
  const bodyText = extractText(children)

  // Create mailto link
  const mailtoLink = `mailto:${to || ''}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(bodyText)}`

  return (
    <div className="my-4 rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">To:</span>
          <span>{to || 'No recipients'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">Subject:</span>
          <span>{subject || 'No subject'}</span>
        </div>
      </div>

      <div className="mb-4 rounded border bg-muted/50 p-4">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {children}
        </div>
      </div>

      <div className="flex justify-end">
        <Button asChild variant="outline" size="lg">
          <a
            href={mailtoLink}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline"
          >
            <MailIcon className="h-4 w-4" />
            Open in Email Client
          </a>
        </Button>
      </div>
    </div>
  )
}
