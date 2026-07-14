import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDictation } from '@/hooks/useDictation';

interface DictationMicButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

// Compact dictation mic that composes next to a note field. Renders nothing when
// the browser has no SpeechRecognition — progressive enhancement, no fallback UI.
export function DictationMicButton({ onTranscript, className }: DictationMicButtonProps) {
  const { supported, listening, start, stop } = useDictation({ onTranscript });

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={listening ? stop : start}
      aria-label={listening ? 'Stop dictating' : 'Dictate'}
      aria-pressed={listening}
      className={cn(
        'min-h-[44px] min-w-[44px]',
        listening && 'animate-pulse border-destructive text-destructive',
        className,
      )}
    >
      {listening ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
    </Button>
  );
}
