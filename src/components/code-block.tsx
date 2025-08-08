import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { memo, useEffect, useState } from 'react'
import { Fragment, jsx, jsxs, type JSX } from 'react/jsx-runtime'
//

import { extractText } from '@/components/markdown/utils'
import { CopyButton } from '@/components/ui/copy-button'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  language?: string
  children: React.ReactNode
  className?: string
}

async function codeToReactNode(
  code: string,
  language?: string,
): Promise<JSX.Element> {
  const { codeToHast } = await import('shiki')
  const hast = await codeToHast(code, {
    lang: language || 'plaintext',
    themes: {
      light: 'vitesse-light',
      dark: 'vitesse-dark',
    },
    defaultColor: false,
    cssVariablePrefix: '--s-',
  })
  return toJsxRuntime(hast, { Fragment, jsxs, jsx }) as JSX.Element
}

function CodeBlockComponent({ language, children, className }: CodeBlockProps) {
  const [reactNode, setReactNode] = useState<JSX.Element | null>(null)
  useEffect(() => {
    let canceled = false
    const run = async () => {
      const reactNode = await codeToReactNode(
        typeof children === 'string' ? children : '',
        language,
      )
      if (canceled) {
        return
      }
      setReactNode(reactNode)
    }

    void run()
    return () => {
      canceled = true
    }
  }, [language, children])

  // Add a wrapper with overflow handling
  const codeBlockClasses = cn(
    'overflow-x-auto max-w-prose rounded-md',
    className,
  )

  const getCopyText = () => extractText(children)

  return (
    <div className="relative group">
      <CopyButton
        getText={getCopyText}
        ariaLabel="Copy code"
        className="absolute right-2 top-2 z-10"
      />

      {reactNode ? (
        <div className={codeBlockClasses}>{reactNode}</div>
      ) : (
        <div className={codeBlockClasses}>
          <code>
            <pre className="whitespace-pre">{children}</pre>
          </code>
        </div>
      )}
    </div>
  )
}

export const CodeBlock = memo(CodeBlockComponent)
