import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiStatus } from './useAiStatus';

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ apiFetch: apiFetchMock }));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useAiStatus', () => {
  beforeEach(() => apiFetchMock.mockReset());

  it('defaults to configured while loading, then reflects the server response', async () => {
    apiFetchMock.mockResolvedValue({ aiConfigured: false });
    const { result } = renderHook(() => useAiStatus(), { wrapper: wrapper() });

    // Query has no data yet on first render: treat AI as configured so the button
    // does not flicker disabled in the common configured case.
    expect(result.current.aiConfigured).toBe(true);

    await waitFor(() => expect(result.current.aiConfigured).toBe(false));
    expect(apiFetchMock).toHaveBeenCalledWith('/api/ai/status');
  });
});
