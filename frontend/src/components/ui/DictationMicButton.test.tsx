import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DictationMicButton } from './DictationMicButton';

const dictation = {
  supported: true,
  listening: false,
  start: vi.fn(),
  stop: vi.fn(),
  error: null as string | null,
};

vi.mock('@/hooks/useDictation', () => ({
  useDictation: ({ onTranscript }: { onTranscript: (t: string) => void }) => {
    dictation.start = vi.fn(() => onTranscript('poured footing'));
    return dictation;
  },
}));

afterEach(() => {
  dictation.supported = true;
  dictation.listening = false;
});

describe('DictationMicButton', () => {
  it('renders nothing when dictation is unsupported', () => {
    dictation.supported = false;
    const { container } = render(<DictationMicButton onTranscript={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('starts dictation and forwards the transcript on tap', () => {
    const onTranscript = vi.fn();
    render(<DictationMicButton onTranscript={onTranscript} />);

    const button = screen.getByRole('button', { name: 'Dictate' });
    fireEvent.click(button);
    expect(onTranscript).toHaveBeenCalledWith('poured footing');
  });

  it('shows the stop affordance while listening', () => {
    dictation.listening = true;
    render(<DictationMicButton onTranscript={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Stop dictating' })).toBeInTheDocument();
  });
});
