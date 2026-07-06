import { createElement, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn(), devLog: vi.fn(), devWarn: vi.fn() }));

import { apiFetch, ApiError } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { useLotSubcontractorAssignments } from './useLotSubcontractorAssignments';
import type { Lot } from '../types';

const apiFetchMock = vi.mocked(apiFetch);
const toastMock = vi.mocked(toast);
type HookParams = Parameters<typeof useLotSubcontractorAssignments>[0];

const lotFixture: Lot = {
  id: 'lot-1',
  lotNumber: 'L-001',
  description: null,
  status: 'open',
  activityType: null,
  chainageStart: null,
  chainageEnd: null,
  offset: null,
  layer: null,
  areaZone: null,
  createdAt: '2026-06-12T00:00:00.000Z',
  updatedAt: '2026-06-12T00:00:00.000Z',
  conformedAt: null,
  conformedBy: null,
  assignedSubcontractorId: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function renderAssignmentsHook(overrides: Partial<HookParams> = {}) {
  return renderHook(
    () =>
      useLotSubcontractorAssignments({
        projectId: 'project-1',
        lotId: 'lot-1',
        lot: lotFixture,
        isSubcontractor: false,
        setLot: vi.fn() as Dispatch<SetStateAction<Lot | null>>,
        ...overrides,
      }),
    { wrapper: createWrapper() },
  );
}

function waitForQueryEffects() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useLotSubcontractorAssignments', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch manager-only lot assignments for non-managing lot viewers', async () => {
    apiFetchMock.mockResolvedValue([]);

    renderAssignmentsHook();

    await waitForQueryEffects();
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/lots/lot-1/subcontractors');
  });

  it('fetches lot assignments when assignment management is enabled', async () => {
    apiFetchMock.mockResolvedValue([]);

    renderAssignmentsHook({ canManageAssignments: true });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/lots/lot-1/subcontractors');
    });
  });

  it('keeps subcontractor users on their own assignment endpoint only', async () => {
    apiFetchMock.mockResolvedValue(null);

    renderAssignmentsHook({ isSubcontractor: true });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/lots/lot-1/subcontractors/mine');
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/lots/lot-1/subcontractors');
  });

  it('surfaces a parsed API error message (not the raw blob) when a remove fails', async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError(500, JSON.stringify({ error: { message: 'Subcontractor has open dockets' } })),
    );

    const { result } = renderAssignmentsHook();
    result.current.removeAssignment('assignment-1');

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Subcontractor has open dockets',
          variant: 'error',
        }),
      );
    });
  });
});
