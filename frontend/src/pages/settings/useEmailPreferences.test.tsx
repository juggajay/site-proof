import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '@/test/renderWithProviders';

// Mock only the network boundary; the pure helpers (defaults, toggle/timing
// shaping, normalization) stay real so the hook is exercised end to end.
vi.mock('./emailPreferencesData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./emailPreferencesData')>();
  return {
    ...actual,
    fetchEmailPreferences: vi.fn(),
    saveEmailPreferences: vi.fn(),
    sendTestEmail: vi.fn(),
  };
});

import {
  DEFAULT_EMAIL_PREFERENCES,
  fetchEmailPreferences,
  normalizeEmailPreferences,
  saveEmailPreferences,
  sendTestEmail,
  type EmailPreferences,
} from './emailPreferencesData';
import { useEmailPreferences } from './useEmailPreferences';

const fetchMock = vi.mocked(fetchEmailPreferences);
const saveMock = vi.mocked(saveEmailPreferences);
const sendTestMock = vi.mocked(sendTestEmail);

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderEmailPreferences() {
  const queryClient = createTestQueryClient();
  return renderHook(() => useEmailPreferences(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe('useEmailPreferences', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(normalizeEmailPreferences({}));
    saveMock.mockResolvedValue(normalizeEmailPreferences({}));
    sendTestMock.mockResolvedValue({ sentTo: 'noreply@example.com' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads and exposes normalized preferences on mount', async () => {
    fetchMock.mockResolvedValue(normalizeEmailPreferences({ enabled: false }));

    const { result } = renderEmailPreferences();

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.loadFailed).toBe(false);
    expect(result.current.preferences.enabled).toBe(false);
    expect(result.current.preferences.mentions).toBe(true);
  });

  it('surfaces a load failure with an error message and keeps the defaults', async () => {
    fetchMock.mockRejectedValue(new Error('Email preferences service unavailable'));

    const { result } = renderEmailPreferences();

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.message).toEqual({
      type: 'error',
      text: 'Email preferences service unavailable',
    });
    expect(result.current.preferences).toEqual(DEFAULT_EMAIL_PREFERENCES);
  });

  it('optimistically applies a toggle, persists it, and confirms success', async () => {
    const save = deferred<EmailPreferences>();
    saveMock.mockReturnValue(save.promise);

    const { result } = renderEmailPreferences();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.togglePreference('enabled');
    });

    // Optimistic update is visible while the save is still in flight.
    expect(result.current.preferences.enabled).toBe(false);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));

    await act(async () => {
      save.resolve(normalizeEmailPreferences({ enabled: false }));
    });

    expect(result.current.message).toEqual({ type: 'success', text: 'Email preferences saved' });
    expect(result.current.preferences.enabled).toBe(false);
  });

  it('rolls back to the previous preferences when a save fails', async () => {
    const save = deferred<EmailPreferences>();
    saveMock.mockReturnValue(save.promise);

    const { result } = renderEmailPreferences();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.preferences.enabled).toBe(true);

    await act(async () => {
      result.current.togglePreference('enabled');
    });
    // Optimistically flipped off before the server responds.
    expect(result.current.preferences.enabled).toBe(false);

    await act(async () => {
      // A message-less rejection exercises the hook's fallback copy.
      save.reject(new Error());
    });

    expect(result.current.message?.type).toBe('error');
    expect(result.current.message?.text).toBe(
      'Failed to save email preferences - changes reverted',
    );
    // Optimistic change reverted to the pre-save value.
    expect(result.current.preferences.enabled).toBe(true);
  });

  it('ignores a second synchronous change while a save is already in flight', async () => {
    // A pending (never-settling) save keeps the in-flight guard engaged.
    saveMock.mockReturnValue(deferred<EmailPreferences>().promise);

    const { result } = renderEmailPreferences();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.togglePreference('enabled');
      result.current.togglePreference('mentions');
    });

    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('reports the recipient after sending a test email', async () => {
    sendTestMock.mockResolvedValue({ sentTo: 'foreman@example.com' });

    const { result } = renderEmailPreferences();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.sendTestEmail();
    });

    expect(result.current.message).toEqual({
      type: 'success',
      text: 'Test email sent to foreman@example.com',
    });
    expect(sendTestMock).toHaveBeenCalledTimes(1);
  });
});
