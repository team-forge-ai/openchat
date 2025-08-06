import type { Node } from 'unist'
import { visit } from 'unist-util-visit'

import type { ElementNode } from './types'

// Rehype plugin that marks code nodes as inline or block based on their parent
export function rehypeMarkCodeBlocks() {
  return (tree: Node) => {
    visit(
      tree,
      'element',
      (node: ElementNode, _index: number, parent: ElementNode | null) => {
        // If this is a code element
        if (node.tagName === 'code') {
          // Code with a pre parent is a block, otherwise it's inline
          const isCodeBlock = Boolean(parent && parent.tagName === 'pre')
          node.properties = node.properties || {}
          node.properties.isCodeBlock = isCodeBlock
        }
      },
    )
  }
}

/* Examples of other rehype plugins that could be added here 

// Rehype plugin to handle email artifacts
export function rehypeEmailArtifacts() {
  return (tree: Node) => {
    visit(tree, 'element', (node: ElementNode) => {
      if (node.tagName === 'email-artifact') {
        // Ensure we have a properties object
        node.properties = node.properties || {}

        node.properties.isEmailArtifact = true

        // Destructure original HTML attributes so we can re-assign them
        const { subject: emailSubject, to: emailTo } = node.properties

        node.properties.emailSubject = emailSubject as string
        node.properties.emailTo = emailTo as string
      }
    })
  }
}

// Rehype plugin to handle quick reply artifacts
export function rehypeQuickReplies() {
  return (tree: Node) => {
    visit(tree, 'element', (node: ElementNode) => {
      if (node.tagName === 'quick-reply') {
        // Ensure we have a properties object
        node.properties = node.properties || {}
        node.properties.isQuickReply = true
      }
    })
  }
}
*/
