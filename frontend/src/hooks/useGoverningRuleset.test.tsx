import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/queryKeys';
import { useGoverningRuleset } from './useGoverningRuleset';

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ apiFetch: apiFetchMock }));

const RULESET = {
  id: 'tfnsw-q6.v1',
  state: 'NSW',
  specSet: 'tfnsw',
  scaleKeys: ['lot'],
  defaultScale: 'lot',
  status: 'confirmed' as const,
  authority: 'TfNSW',
  document: 'Q6',
  edition: '2024',
  rules: [],
};

function respond(project: unknown) {
  apiFetchMock.mockImplementation((path: string) =>
    path === '/api/test-sufficiency/rulesets'
      ? Promise.resolve({ rulesets: [RULESET] })
      : Promise.resolve({ project }),
  );
}

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useGoverningRuleset', () => {
  beforeEach(() => apiFetchMock.mockReset());

  it('resolves the ruleset governing the project authority', async () => {
    respond({ state: 'nsw', specificationSet: 'rms' }); // rms folds to tfnsw
    const { result } = renderHook(() => useGoverningRuleset('project-1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.governingRuleset).toEqual(RULESET));
    expect(result.current.rulesetLoadFailed).toBe(false);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1');
  });

  it('returns no ruleset for a project whose authority has no shipped pack', async () => {
    respond({ state: 'qld', specificationSet: 'tmr' });
    const { result } = renderHook(() => useGoverningRuleset('project-1'), { wrapper: wrapper() });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.governingRuleset).toBeNull();
    expect(result.current.rulesetLoadFailed).toBe(false);
  });

  it('reports a failed load rather than a missing pack, and retries both reads', async () => {
    apiFetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    const { result } = renderHook(() => useGoverningRuleset('project-1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.rulesetLoadFailed).toBe(true));
    expect(result.current.governingRuleset).toBeNull();

    // Retry re-issues both reads, so a transient failure recovers.
    respond({ state: 'nsw', specificationSet: 'tfnsw' });
    result.current.retryRulesetLoad();
    await waitFor(() => expect(result.current.governingRuleset).toEqual(RULESET));
    expect(result.current.rulesetLoadFailed).toBe(false);
  });

  it('skips the project read until a project id exists', () => {
    respond({ state: 'nsw', specificationSet: 'tfnsw' });
    renderHook(() => useGoverningRuleset(undefined), { wrapper: wrapper() });

    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/projects/undefined');
  });

  it('caches the project under the shared unwrapped-project key', async () => {
    respond({ state: 'nsw', specificationSet: 'tfnsw' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useGoverningRuleset('project-1'), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.governingRuleset).toEqual(RULESET));
    expect(client.getQueryData(queryKeys.project('project-1'))).toEqual({
      state: 'nsw',
      specificationSet: 'tfnsw',
    });
  });
});
