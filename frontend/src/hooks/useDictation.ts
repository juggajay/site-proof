import { useCallback } from 'react';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { toast } from '@/components/ui/toaster';

interface UseDictationOptions {
  onTranscript: (text: string) => void;
}

interface UseDictationReturn {
  supported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
  error: string | null;
}

// Single-utterance dictation for note fields: one tap = one phrase
// (continuous:false, final results only), en-AU, permission failures surfaced as
// a toast. Delegates the SpeechRecognition plumbing/types to useSpeechToText
// rather than re-declaring the Web Speech API.
export function useDictation({ onTranscript }: UseDictationOptions): UseDictationReturn {
  const handleError = useCallback((_message: string, code?: string) => {
    if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
      toast({ title: 'Microphone unavailable — check permissions', variant: 'error' });
    }
  }, []);

  const { isSupported, isListening, error, startListening, stopListening } = useSpeechToText({
    continuous: false,
    interimResults: false,
    language: 'en-AU',
    onResult: (text, isFinal) => {
      if (!isFinal) return;
      const trimmed = text.trim();
      if (trimmed) onTranscript(trimmed);
    },
    onError: handleError,
  });

  return {
    supported: isSupported,
    listening: isListening,
    start: startListening,
    stop: stopListening,
    error,
  };
}
