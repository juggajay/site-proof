import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDictation } from './useDictation';

const toastMock = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: (opts: unknown) => toastMock(opts),
}));

// Minimal Web Speech API stand-in — captures each instance so a test can drive
// its onstart/onresult/onerror handlers the way the real engine would.
const instances: MockRecognition[] = [];
class MockRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  onstart: ((e: Event) => void) | null = null;
  onend: ((e: Event) => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  start = vi.fn(() => this.onstart?.(new Event('start')));
  stop = vi.fn(() => this.onend?.(new Event('end')));
  abort = vi.fn();
  constructor() {
    instances.push(this);
  }
}

function finalResult(transcript: string) {
  return {
    resultIndex: 0,
    results: { length: 1, 0: { isFinal: true, 0: { transcript } } },
  };
}

afterEach(() => {
  instances.length = 0;
  toastMock.mockClear();
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

describe('useDictation', () => {
  it('reports unsupported when the browser has no SpeechRecognition', () => {
    const { result } = renderHook(() => useDictation({ onTranscript: vi.fn() }));
    expect(result.current.supported).toBe(false);
  });

  it('emits the final transcript and tracks listening state', () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = MockRecognition;
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useDictation({ onTranscript }));

    expect(result.current.supported).toBe(true);

    act(() => result.current.start());
    expect(result.current.listening).toBe(true);

    act(() => instances[0].onresult?.(finalResult('graded to level  ')));
    expect(onTranscript).toHaveBeenCalledWith('graded to level');

    act(() => instances[0].onend?.(new Event('end')));
    expect(result.current.listening).toBe(false);
  });

  it('toasts once when microphone permission is denied', () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = MockRecognition;
    const { result } = renderHook(() => useDictation({ onTranscript: vi.fn() }));

    act(() => result.current.start());
    act(() => instances[0].onerror?.({ error: 'not-allowed', message: '' }));

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Microphone unavailable — check permissions' }),
    );
  });
});
