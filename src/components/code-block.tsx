import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { memo, useEffect, useState } from 'react'
import { Fragment, jsx, jsxs, type JSX } from 'react/jsx-runtime'

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

  if (reactNode) {
    return <div className={codeBlockClasses}>{reactNode}</div>
  } else {
    return (
      <div className={codeBlockClasses}>
        <code>
          <pre className="whitespace-pre">{children}</pre>
        </code>
      </div>
    )
  }
}

export const CodeBlock = memo(CodeBlockComponent)
