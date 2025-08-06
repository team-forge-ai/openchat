import React from 'react'

export function extractCodeLanguage(
  prop: string | number | boolean | (string | number)[] | null | undefined,
): string | null {
  if (Array.isArray(prop)) {
    for (const item of prop) {
      const languageName = extractCodeLanguage(item)
      if (languageName) {
        return languageName
      }
    }
  }
  if (typeof prop === 'string') {
    const match = prop.match(/^language-(\w+)$/)
    if (match) {
      return match[1]
    }
  }
  return null
}

// Extract text content from children recursively
export function extractText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>
    if (element.props.children) {
      return React.Children.toArray(element.props.children)
        .map(extractText)
        .join('')
    }
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('')
  }
  return ''
}
