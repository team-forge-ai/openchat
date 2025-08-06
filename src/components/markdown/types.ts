import type { Components } from 'react-markdown'
import type { Node } from 'unist'

// Better TypeScript typings for rehype elements
export interface ElementProperties {
  className?: string[]
  isCodeBlock?: boolean
  isEmailArtifact?: boolean
  isQuickReply?: boolean
  emailType?: string
  emailSubject?: string
  emailTo?: string
  [key: string]: unknown
}

export interface ElementNode extends Node {
  type: 'element'
  tagName: string
  properties?: ElementProperties
  children: Array<ElementNode | TextNode>
}

export interface TextNode extends Node {
  type: 'text'
  value: string
}

// Extend Components type to include custom elements
export interface EmailArtifactComponentProps {
  node: ElementNode
  children: React.ReactNode
}

export interface QuickReplyComponentProps {
  node: ElementNode
  children: React.ReactNode
  onSend?: (text: string) => void
}

export type ExtendedComponents = Partial<Components> & {
  'email-artifact'?: (
    props: EmailArtifactComponentProps,
  ) => React.ReactElement | null
  'quick-reply'?: (props: QuickReplyComponentProps) => React.ReactElement | null
}
