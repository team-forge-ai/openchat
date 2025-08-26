import './markdown.css'

import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { cn } from '@/lib/utils'

import { components } from './components'
import { rehypeMarkCodeBlocks } from './rehype-plugins'

const remarkPlugins = [remarkMath, remarkGfm]
const rehypePlugins = [rehypeRaw, rehypeKatex, rehypeMarkCodeBlocks]

interface MarkdownProps {
  children: string
  className?: string
}

function NonMemoizedMarkdown({ children, className }: MarkdownProps) {
  const componentsWithSendMessage = useMemo(() => {
    return {
      ...components,
    }
  }, [])

  return (
    <div
      className={cn(
        'relative',
        'prose prose-slate text-inherit max-w-max prose-p:max-w-prose prose-headings:text-sm',
        'dark:prose-invert',
        'prose-headings:text-inherit prose-strong:text-inherit prose-em:text-inherit',
        // Add styling for code blocks to handle overflow
        'prose-pre:overflow-x-auto prose-pre:max-w-full prose-pre:bg-transparent prose-pre:text-inherit',
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
