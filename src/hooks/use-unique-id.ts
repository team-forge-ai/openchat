import { useRef } from 'react'

/**
 * React hook that returns a function to generate unique, incrementing numeric IDs.
 * Each hook instance maintains its own counter, starting from 1.
 *
 * @returns {() => number} Function that returns a new unique ID on each call.
 *
 * @example
 * const getId = useUniqueId();
 * const id1 = getId(); // 1
 * const id2 = getId(); // 2
 */
export function useUniqueId(): () => number {
  const uniqueId = useRef(0)
  return () => {
    uniqueId.current++
    return uniqueId.current
  }
}
