// Feature #288: Voice-to-text hook using Web Speech API
import { useState, useEffect, useCallback, useRef } from 'react'

interface SpeechToTextOptions {
  continuous?: boolean
  interimResults?: boolean
  language?: string
  onResult?: (transcript: string, isFinal: boolean) => void
  onError?: (error: string) => void
}

interface SpeechToTextReturn {
  isListening: boolean
  isSupported: boolean
  transcript: string
  interimTranscript: string
  error: string | null
  startListening: () => void
  stopListening: () => void
  clearTranscript: () => void
}

// Web Speech API type definitions for browser compatibility
interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface ISpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => void) | null
  onerror: ((this: ISpeechRecognition, ev: ISpeechRecognitionErrorEvent) => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition
}

// Extend window with webkitSpeechRecognition for browser compatibility
declare global {
  interface Window {
    SpeechRecognition: ISpeechRecognitionConstructor
    webkitSpeechRecognition: ISpeechRecognitionConstructor
  }
}

export function useSpeechToText(options: SpeechToTextOptions = {}): SpeechToTextReturn {
  const {
    continuous = true,
    interimResults = true,
    language = 'en-AU',
    onResult,
    onError
  } = options

  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  // Check browser support on mount
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognitionAPI)
  }, [])

  // Initialize speech recognition
  const initRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition not supported in this browser')
      return null
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = language

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
      console.log('Voice recognition started')
    }

    recognition.onend = () => {
      setIsListening(false)
      console.log('Voice recognition ended')
    }

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript

        if (result.isFinal) {
          finalTranscript += text
          setTranscript(prev => prev + text)
          onResult?.(text, true)
        } else {
          interimText += text
        }
      }

      setInterimTranscript(interimText)
      if (interimText && !finalTranscript) {
        onResult?.(interimText, false)
      }
    }

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      let errorMessage = 'Speech recognition error'

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.'
          break
        case 'audio-capture':
          errorMessage = 'No microphone detected. Please check your microphone.'
          break
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access.'
          break
        case 'network':
          errorMessage = 'Network error. Please check your connection.'
          break
        case 'aborted':
          errorMessage = 'Speech recognition aborted.'
          break
        default:
          errorMessage = `Speech recognition error: ${event.error}`
      }

      setError(errorMessage)
      setIsListening(false)
      onError?.(errorMessage)
    }

    return recognition
  }, [continuous, interimResults, language, onResult, onError])

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) {
      const msg = 'Speech recognition not supported in this browser'
      setError(msg)
      onError?.(msg)
      return
    }

    // Stop existing recognition if any
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    const recognition = initRecognition()
    if (recognition) {
      recognitionRef.current = recognition
      try {
        recognition.start()
      } catch (err) {
        console.error('Failed to start recognition:', err)
        setError('Failed to start speech recognition')
      }
    }
  }, [isSupported, initRecognition, onError])

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    clearTranscript
  }
}
