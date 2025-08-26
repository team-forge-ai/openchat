import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility to merge Tailwind class names with conflict resolution.
 *
 * @param inputs Class name fragments.
 * @returns A space-joined class string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a sentence to English title case while preserving acronyms and
 * internal capitalization (e.g., iOS, OpenAI). Hyphenated words are handled
 * and common small words remain lowercase unless first/last.
 *
 * @param input The string to convert.
 * @returns The title-cased string.
 */
export function toTitleCase(input: string): string {
  if (!input) {
    return ''
  }

  const SMALL_WORDS = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'for',
    'nor',
    'as',
    'at',
    'by',
    'in',
    'of',
    'on',
    'per',
    'to',
    'vs',
    'via',
    'with',
    'without',
    'from',
  ])

  const isAcronym = (word: string): boolean => /^[\dA-Z]+$/.test(word)
  const hasInternalCaps = (word: string): boolean => {
    // Preserve tokens that already contain internal capitalization (e.g., iOS, OpenAI)
    return word !== word.toLowerCase() && word !== word.toUpperCase()
  }
  const capitalize = (word: string): string =>
    word.charAt(0).toUpperCase() + word.slice(1)

  const processHyphenated = (word: string, forceCap: boolean): string => {
    return word
      .split('-')
      .map((part, idx) => {
        if (hasInternalCaps(part) || isAcronym(part)) {
          return part
        }
        const lower = part.toLowerCase()
        const shouldCap = forceCap || idx === 0 || !SMALL_WORDS.has(lower)
        return shouldCap ? capitalize(lower) : lower
      })
      .join('-')
  }

  const tokens = input.split(/\s+/)
  return tokens
    .map((token, index) => {
      if (hasInternalCaps(token) || isAcronym(token)) {
        return token
      }
      const lower = token.toLowerCase()
      const isEdge = index === 0 || index === tokens.length - 1
      if (lower.includes('-')) {
        return processHyphenated(token, isEdge)
      }
      if (!isEdge && SMALL_WORDS.has(lower)) {
        return lower
      }
      return capitalize(lower)
    })
    .join(' ')
}
