import './markdown.css'

import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { cn } from '@/lib/utils'

import { components } from './components'
import { QuickReply } from './quick-reply'
import {
  rehypeEmailArtifacts,
  rehypeMarkCodeBlocks,
  rehypeQuickReplies,
} from './rehype-plugins'
import type { QuickReplyComponentProps } from './types'

const remarkPlugins = [remarkMath, remarkGfm]
const rehypePlugins = [
  rehypeRaw,
  rehypeKatex,
  rehypeMarkCodeBlocks,
  rehypeEmailArtifacts,
  rehypeQuickReplies,
]

interface MarkdownProps {
  children: string
  className?: string
  onSendMessage?: (text: string) => void
}

function NonMemoizedMarkdown({
  children,
  className,
  onSendMessage,
}: MarkdownProps) {
  const componentsWithSendMessage = useMemo(() => {
    return {
      ...components,
      'quick-reply': ({ node: _node, children }: QuickReplyComponentProps) => (
        <QuickReply onSend={onSendMessage}>{children}</QuickReply>
      ),
    }
  }, [onSendMessage])

  return (
    <div
      className={cn(
        'relative',
        'prose prose-slate text-inherit max-w-max prose-p:max-w-prose prose-headings:text-sm',
        'dark:prose-invert',
        'prose-headings:text-inherit prose-strong:text-inherit prose-em:text-inherit',
        // Add styling for code blocks to handle overflow
        'prose-pre:overflow-x-auto prose-pre:max-w-full',
        // Disable code block quotes
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-blockquote:text-inherit prose-a:text-inherit',
        'prose-hr:border-black/5 prose-hr:my-4 prose-hr:mx-4',
        'prose-gray',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={componentsWithSendMessage}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

export const Markdown = memo(NonMemoizedMarkdown)
