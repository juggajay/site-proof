import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetClancyStore, sendClancy, useClancyStore } from './clancyChatState';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiFetch: apiFetchMock,
}));

beforeEach(() => {
  resetClancyStore();
  apiFetchMock.mockReset();
});

afterEach(() => {
  resetClancyStore();
});

describe('clancyChatState', () => {
  it('appends the user turn and Clancy reply, and posts the transcript', async () => {
    apiFetchMock.mockResolvedValue({ message: 'On it.', actions: [] });
    const { result } = renderHook(() => useClancyStore());

    await act(async () => {
      await sendClancy('What should I do first?', 'project-1');
    });

    expect(result.current.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(result.current.messages[1].content).toBe('On it.');
    expect(result.current.inFlight).toBe(false);

    const [, opts] = apiFetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.projectId).toBe('project-1');
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'What should I do first?' });
  });

  it('trims the transcript to the last 20 turns', async () => {
    apiFetchMock.mockResolvedValue({ message: 'ok' });
    const { result } = renderHook(() => useClancyStore());

    for (let i = 0; i < 12; i += 1) {
      await act(async () => {
        await sendClancy(`message ${i}`);
      });
    }

    expect(result.current.messages).toHaveLength(20);
    // Sends never exceed 20 turns either.
    const lastBody = JSON.parse(apiFetchMock.mock.calls.at(-1)![1].body);
    expect(lastBody.messages.length).toBeLessThanOrEqual(20);
  });

  it('locks out a second send while one is in flight', async () => {
    let resolve!: (v: unknown) => void;
    apiFetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useClancyStore());

    act(() => {
      void sendClancy('first');
    });
    await waitFor(() => expect(result.current.inFlight).toBe(true));

    act(() => {
      void sendClancy('second (ignored)');
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ message: 'done' });
    });
    expect(result.current.inFlight).toBe(false);
  });

  it('shows an honest error bubble with retry on a 503', async () => {
    const { ApiError } = await import('@/lib/api');
    apiFetchMock.mockRejectedValue(new ApiError(503, 'unavailable'));
    const { result } = renderHook(() => useClancyStore());

    await act(async () => {
      await sendClancy('help', 'p1');
    });

    const last = result.current.messages.at(-1)!;
    expect(last.role).toBe('assistant');
    expect(last.error).toBe(true);
    expect(last.retryOf).toBe('help');
    expect(last.content).toMatch(/reach my brain/i);
  });

  it('shows a gentle rate-limit message on a 429', async () => {
    const { ApiError } = await import('@/lib/api');
    apiFetchMock.mockRejectedValue(new ApiError(429, 'slow down'));
    const { result } = renderHook(() => useClancyStore());

    await act(async () => {
      await sendClancy('help');
    });

    expect(result.current.messages.at(-1)!.content).toMatch(/give me a second/i);
  });
});
