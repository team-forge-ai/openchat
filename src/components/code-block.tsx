import { lazy, memo, Suspense } from 'react'

import { extractText } from '@/components/markdown/utils'
import { CopyButton } from '@/components/ui/copy-button'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  language?: string
  children: React.ReactNode
  className?: string
  showLanguage?: boolean
  showLineNumbers?: boolean
  lineNumbersStartAt?: number
  addDefaultStyles?: boolean
  defaultColor?: string
}

// Lazy load the Shiki component for better performance
const LazyShikiHighlighter = lazy(() =>
  import('react-shiki').then((module) => ({
    default: module.ShikiHighlighter,
  })),
)

// Loading fallback component that matches the existing UI structure
function CodeBlockSkeleton({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const codeBlockClasses = cn(className)

  return (
    <div className={codeBlockClasses}>
      <code>
        <pre className="whitespace-pre">{children}</pre>
      </code>
    </div>
  )
}

function CodeBlockComponent({ language, children, className }: CodeBlockProps) {
  const { resolvedTheme: theme } = useTheme()

  const codeContent =
    typeof children === 'string' ? children : extractText(children)

  // Add a wrapper with overflow handling
  const codeBlockClasses = cn('text-xs', className)

  const getCopyText = () => extractText(children)

  return (
    <div className="relative group">
      <CopyButton
        getText={getCopyText}
        ariaLabel="Copy code"
        className="absolute -right-3 -top-3 z-10"
      />

      <Suspense
        fallback={
          <CodeBlockSkeleton className={codeBlockClasses}>
            {children}
          </CodeBlockSkeleton>
        }
      >
        <LazyShikiHighlighter
          language={language || 'plaintext'}
          theme={theme === 'dark' ? 'vitesse-dark' : 'vitesse-light'}
          className={codeBlockClasses}
          showLanguage={false}
          addDefaultStyles={false}
        >
          {codeContent}
        </LazyShikiHighlighter>
      </Suspense>
    </div>
  )
}

export const CodeBlock = memo(CodeBlockComponent)
