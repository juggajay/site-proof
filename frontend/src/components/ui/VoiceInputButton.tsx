// Feature #288: Voice input button component
import { useState, useCallback } from 'react'
import { useSpeechToText } from '../../lib/useSpeechToText'
import { Mic, MicOff, Square, AlertCircle } from 'lucide-react'

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  className?: string
  buttonClassName?: string
  appendMode?: boolean // If true, appends to existing text; if false, replaces
}

export function VoiceInputButton({
  onTranscript,
  disabled = false,
  className = '',
  buttonClassName = '',
  appendMode = true
}: VoiceInputButtonProps) {
  const [pendingText, setPendingText] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    clearTranscript
  } = useSpeechToText({
    continuous: true,
    interimResults: true,
    language: 'en-AU',
    onResult: (text, isFinal) => {
      if (isFinal) {
        setPendingText(prev => prev + text + ' ')
      }
    }
  })

  const handleToggle = useCallback(() => {
    if (isListening) {
      stopListening()
      setShowPreview(true)
    } else {
      setPendingText('')
      clearTranscript()
      setShowPreview(false)
      startListening()
    }
  }, [isListening, startListening, stopListening, clearTranscript])

  const handleAccept = useCallback(() => {
    const finalText = pendingText.trim()
    if (finalText) {
      onTranscript(finalText)
    }
    setPendingText('')
    clearTranscript()
    setShowPreview(false)
  }, [pendingText, onTranscript, clearTranscript])

  const handleCancel = useCallback(() => {
    setPendingText('')
    clearTranscript()
    setShowPreview(false)
  }, [clearTranscript])

  if (!isSupported) {
    return (
      <div className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
        <AlertCircle className="w-3 h-3" />
        <span>Voice not supported</span>
      </div>
    )
  }

  const displayText = pendingText + (interimTranscript ? interimTranscript : '')

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={`
            inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium
            transition-all duration-200
            ${isListening
              ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${buttonClassName}
          `}
          title={isListening ? 'Stop recording' : 'Start voice input'}
        >
          {isListening ? (
            <>
              <Square className="w-4 h-4" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>Voice</span>
            </>
          )}
        </button>

        {isListening && (
          <span className="text-xs text-red-500 animate-pulse">
            ● Recording...
          </span>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Live transcription preview */}
      {(isListening || showPreview) && displayText && (
        <div className="mt-2 p-3 bg-muted/50 border rounded-md">
          <div className="text-xs text-muted-foreground mb-1">
            {isListening ? 'Transcribing...' : 'Review transcription:'}
          </div>
          <p className="text-sm">
            {displayText}
            {isListening && <span className="animate-pulse">|</span>}
          </p>
        </div>
      )}

      {/* Accept/Cancel buttons after stopping */}
      {showPreview && displayText && !isListening && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleAccept}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
          >
            Accept & Insert
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
