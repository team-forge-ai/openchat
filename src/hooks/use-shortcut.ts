import { useEffect, useMemo, useRef } from 'react'

type ShortcutOptions = {
  enabled?: boolean
  preventDefault?: boolean
  target?: Window | Document | HTMLElement
}

function getIsMac(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform)
}

function normalizeCombo(combo: string): string[] {
  return combo
    .toLowerCase()
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean)
}

function matchEvent(e: KeyboardEvent, tokens: string[]): boolean {
  const isMac = getIsMac()

  let requiredMeta = false
  let requiredCtrl = false
  let requiredAlt = false
  let requiredShift = false
  let requiredKey: string | null = null

  for (const token of tokens) {
    switch (token) {
      case 'mod':
        if (isMac) {
          requiredMeta = true
        } else {
          requiredCtrl = true
        }
        break
      case 'meta':
      case 'cmd':
        requiredMeta = true
        break
      case 'control':
      case 'ctrl':
        requiredCtrl = true
        break
      case 'alt':
      case 'option':
        requiredAlt = true
        break
      case 'shift':
        requiredShift = true
        break
      default:
        requiredKey = token
        break
    }
  }

  if (requiredMeta !== !!e.metaKey) {
    return false
  }
  if (requiredCtrl !== !!e.ctrlKey) {
    return false
  }
  if (requiredAlt !== !!e.altKey) {
    return false
  }
  if (requiredShift !== !!e.shiftKey) {
    return false
  }

  if (!requiredKey) {
    return true
  }

  // Normalize event.key to lower-case for letters; leave special keys as-is comparisons
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  return key === requiredKey
}

/**
 * useShortcut
 *
 * React hook for binding a keyboard shortcut to a handler function.
 *
 * @param combo - The keyboard shortcut combination (e.g., 'mod+n', 'ctrl+shift+s').
 * @param handler - The function to call when the shortcut is triggered.
 * @param options - Optional configuration:
 *   - enabled: Whether the shortcut is active (default: true).
 *   - preventDefault: Whether to call e.preventDefault() on match (default: true).
 *   - target: The event target to listen on (default: window).
 *
 * Example:
 *   useShortcut('mod+n', (e) => { ... })
 */
export function useShortcut(
  combo: string,
  handler: (event: KeyboardEvent) => void | Promise<void>,
  options: ShortcutOptions = {},
): void {
  const { enabled = true, preventDefault = true, target } = options

  const tokens = useMemo(() => normalizeCombo(combo), [combo])

  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const node: Window | Document | HTMLElement = target || window

    const onKeyDown = (e: KeyboardEvent) => {
      if (!matchEvent(e, tokens)) {
        return
      }
      if (preventDefault) {
        e.preventDefault()
      }
      void handlerRef.current(e)
    }

    node.addEventListener('keydown', onKeyDown as EventListener)
    return () => node.removeEventListener('keydown', onKeyDown as EventListener)
  }, [enabled, preventDefault, target, tokens])
}
