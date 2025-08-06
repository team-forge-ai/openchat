import { CodeBlock } from '../code-block'

import { EmailArtifact } from './email-artifact'
import { MarkdownImage } from './markdown-image'
import { QuickReply } from './quick-reply'
import type { ExtendedComponents } from './types'
import { extractCodeLanguage } from './utils'

export const components: ExtendedComponents = {
  code: ({ node, className, children }) => {
    const language = extractCodeLanguage(className)

    // Get the code type from the node properties
    const isCodeBlock = Boolean(node?.properties?.isCodeBlock)

    // If not a code block, render as inline code
    if (!isCodeBlock) {
      return <code className={className}>{children}</code>
    }

    // Use CodeBlock for code blocks with proper overflow handling
    return (
      <CodeBlock
        language={language || undefined}
        className="overflow-x-auto whitespace-pre"
      >
        {children}
      </CodeBlock>
    )
  },
  // The pre wrapper is already handled by CodeBlock
  pre: ({ children }) => <>{children}</>,
  // Use the new MarkdownImage component
  img: ({ node: _node, src, alt, ...props }) => {
    return <MarkdownImage src={src} alt={alt} {...props} />
  },
  // Add custom component handler for email-artifact
  'email-artifact': ({ node, children }) => {
    const { emailSubject, emailTo } = node?.properties ?? {}

    return (
      <EmailArtifact subject={emailSubject} to={emailTo}>
        {children}
      </EmailArtifact>
    )
  },
  // Add custom component handler for quick-reply
  'quick-reply': ({ node: _node, children, onSend }) => {
    return <QuickReply onSend={onSend}>{children}</QuickReply>
  },
}
