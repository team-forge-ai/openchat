import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface UseTranscriptionOptions {
  lang?: string
  interimResults?: boolean
  continuous?: boolean
}

interface UseTranscriptionResult {
  isSupported: boolean
  isListening: boolean
  transcript: string
  interimTranscript: string
  error: string | null
  start: (options?: UseTranscriptionOptions) => void
  stop: () => Promise<string>
  reset: () => void
}

// Minimal SpeechRecognition type surface to avoid relying on lib DOM definitions
interface SpeechRecognitionAlternativeLike {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionResultListLike {
  length: number
  [index: number]: SpeechRecognitionResultLike
}

interface SpeechRecognitionResultEventLike {
  resultIndex: number
  results: SpeechRecognitionResultListLike
}

interface SpeechRecognitionErrorEventLike {
  error?: string
  message?: string
}

type RecognitionEventMap = {
  start: Event
  end: Event
  result: SpeechRecognitionResultEventLike
  error: SpeechRecognitionErrorEventLike
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') {
    return null
  }
  const anyWindow = window as unknown as Record<string, unknown>
  return (
    (anyWindow.SpeechRecognition as SpeechRecognitionCtor | undefined) ||
    (anyWindow.webkitSpeechRecognition as SpeechRecognitionCtor | undefined) ||
    null
  )
}

/**
 * React hook for speech-to-text transcription using the Web Speech API.
 *
 * Provides state and controls for starting and stopping speech recognition,
 * as well as access to the current transcript, interim transcript, and error state.
 *
 * @returns {UseTranscriptionResult} An object containing:
 *   - isListening: boolean indicating if recognition is active
 *   - transcript: final transcript string
 *   - interimTranscript: current interim transcript string
 *   - error: error message if any
 *   - start: function to begin recognition
 *   - stop: function to stop recognition and resolve with the transcript
 *   - abort: function to abort recognition immediately
 */
export function useTranscription(): UseTranscriptionResult {
  const Recognition = useMemo(getSpeechRecognition, [])

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalTranscriptRef = useRef('')
  const stopResolverRef = useRef<((value: string) => void) | null>(null)
  const startHandlerRef = useRef<EventListener | null>(null)
  const resultHandlerRef = useRef<EventListener | null>(null)
  const errorHandlerRef = useRef<EventListener | null>(null)
  const endHandlerRef = useRef<EventListener | null>(null)

  const addRecognitionListener = useCallback(
    <K extends keyof RecognitionEventMap>(
      rec: SpeechRecognitionLike,
      type: K,
      listener: (ev: RecognitionEventMap[K]) => void,
    ): EventListener => {
      const handler: EventListener = ((e: Event) => {
        listener(e as unknown as RecognitionEventMap[K])
      }) as EventListener
      rec.addEventListener(type as string, handler)
      return handler
    },
    [],
  )

  const cleanupRecognition = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) {
      return
    }
    if (startHandlerRef.current) {
      rec.removeEventListener('start', startHandlerRef.current)
    }
    if (resultHandlerRef.current) {
      rec.removeEventListener('result', resultHandlerRef.current)
    }
    if (errorHandlerRef.current) {
      rec.removeEventListener('error', errorHandlerRef.current)
    }
    if (endHandlerRef.current) {
      rec.removeEventListener('end', endHandlerRef.current)
    }
    startHandlerRef.current = null
    resultHandlerRef.current = null
    errorHandlerRef.current = null
    endHandlerRef.current = null
    recognitionRef.current = null
  }, [])

  const start = useCallback(
    (options?: UseTranscriptionOptions) => {
      if (!Recognition || isListening) {
        return
      }

      setError(null)
      const rec = new Recognition()
      recognitionRef.current = rec

      rec.lang = options?.lang ?? 'en-US'
      rec.continuous = options?.continuous ?? true
      rec.interimResults = options?.interimResults ?? true
      finalTranscriptRef.current = ''
      setTranscript('')
      setInterimTranscript('')

      startHandlerRef.current = addRecognitionListener(rec, 'start', () => {
        setIsListening(true)
      })

      const onResult = (event: SpeechRecognitionResultEventLike) => {
        let finalDelta = ''
        let interimDelta = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const alt = result[0]
          if (result.isFinal) {
            finalDelta += alt.transcript
          } else {
            interimDelta += alt.transcript
          }
        }

        if (finalDelta) {
          finalTranscriptRef.current += finalDelta
          setTranscript(finalTranscriptRef.current)
          setInterimTranscript('')
        } else {
          setInterimTranscript(interimDelta)
        }
      }
      resultHandlerRef.current = addRecognitionListener(rec, 'result', onResult)

      const onError = (ev: SpeechRecognitionErrorEventLike) => {
        const message = ev.message || (ev.error ? String(ev.error) : null)
        setError(message ?? 'Transcription error')
      }
      errorHandlerRef.current = addRecognitionListener(rec, 'error', onError)

      const onEnd = () => {
        setIsListening(false)
        cleanupRecognition()
        const resolve = stopResolverRef.current
        stopResolverRef.current = null
        if (resolve) {
          resolve(finalTranscriptRef.current)
        }
      }
      endHandlerRef.current = addRecognitionListener(rec, 'end', onEnd)

      try {
        rec.start()
      } catch (_error) {
        setError('Failed to start transcription')
      }
    },
    [Recognition, cleanupRecognition, isListening, addRecognitionListener],
  )

  const stop = useCallback((): Promise<string> => {
    if (!recognitionRef.current) {
      return Promise.resolve(finalTranscriptRef.current)
    }

    return new Promise<string>((resolve) => {
      stopResolverRef.current = resolve
      try {
        recognitionRef.current?.stop()
      } catch {
        recognitionRef.current?.abort()
      }
    })
  }, [])

  const reset = useCallback(() => {
    finalTranscriptRef.current = ''
    setTranscript('')
    setInterimTranscript('')
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort()
      } catch {
        // ignore
      }
      cleanupRecognition()
    }
  }, [cleanupRecognition])

  return {
    isSupported: !!Recognition,
    isListening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  }
}
