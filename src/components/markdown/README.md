# Markdown Components

This directory contains all the components and utilities for rendering markdown content with custom extensions.

## Structure

- **markdown.tsx** - Main Markdown component that combines all the pieces
- **components.tsx** - Component mappings for ReactMarkdown (code, images, email artifacts, quick replies, etc.)
- **email-artifact.tsx** - Custom component for rendering email previews with mailto functionality
- **quick-reply.tsx** - Custom component for rendering clickable reply buttons
- **markdown-image.tsx** - Enhanced image component with modal preview and download capabilities
- **rehype-plugins.ts** - Custom rehype plugins for processing markdown AST
- **types.ts** - TypeScript type definitions
- **utils.ts** - Utility functions (e.g., extracting code language)
- **markdown.css** - Styles for markdown rendering including syntax highlighting themes
- **index.ts** - Public exports

## Usage

```
import { Markdown } from '@/components/markdown'

// Basic usage
<Markdown className="my-custom-class">{markdownContent}</Markdown>

// With quick reply support
<Markdown
  className="my-custom-class"
  onSendMessage={(text) => sendMessage({ text, assets: [] })}
>
  {markdownContent}
</Markdown>
```

## Custom Elements

### Email Artifacts

The markdown renderer supports custom email artifact elements:

```markdown
<email-artifact subject="Meeting Tomorrow" to="alex@example.com,team@example.com">
Dear Team,

I hope this email finds you well. I wanted to remind everyone about our meeting tomorrow at 2 PM.

Best regards,
John
</email-artifact>
```

This renders as a styled email preview card with a button that opens the user's email client.

### Quick Reply Artifacts

The markdown renderer supports quick reply elements that render as clickable buttons:

```markdown
Should I proceed with this plan?

<quick-reply>Yes, proceed with the plan</quick-reply>
<quick-reply>No, let me think about it</quick-reply>
<quick-reply>Can you provide more details?</quick-reply>
```

When clicked, these buttons automatically send their content as a new message in the conversation. The `onSendMessage` prop must be provided to the Markdown component for this functionality to work.

## Adding New Custom Elements

1. Create a new component in this directory
2. Add the rehype plugin in `rehype-plugins.ts` if needed
3. Add the component mapping in `components.tsx`
4. Update the types in `types.ts` if needed

## Plugins

- **remarkMath** - Math equation support
- **remarkGfm** - GitHub Flavored Markdown
- **rehypeKatex** - KaTeX math rendering
- **rehypeMarkCodeBlocks** - Distinguishes inline vs block code
- **rehypeEmailArtifacts** - Processes email artifact elements
- **rehypeQuickReplies** - Processes quick reply elements
