import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import type { Lot } from '../lotsPageTypes';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/errorHandling', () => ({ handleApiError: vi.fn() }));

import { apiFetch } from '@/lib/api';
import { useLotsActions } from './useLotsActions';

const apiFetchMock = vi.mocked(apiFetch);

const lotFixture: Lot = {
  id: 'lot-1',
  lotNumber: 'L-001',
  description: null,
  status: 'not_started',
  chainageStart: null,
  chainageEnd: null,
  offset: null,
  layer: null,
  areaZone: null,
  assignedSubcontractorId: null,
};

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('useLotsActions', () => {
  it('includes ITP permissions in the bulk assignment request body', async () => {
    apiFetchMock.mockResolvedValue({ message: 'assigned' });

    const { result } = renderHook(
      () =>
        useLotsActions({
          lots: [lotFixture],
          setLots: vi.fn(),
          displayedLots: [lotFixture],
          fetchLots: vi.fn(),
          fetchSubcontractors: vi.fn(),
          subcontractors: [{ id: 'sub-1', companyName: 'Concrete Crew' }],
        }),
      { wrapper },
    );

    act(() => {
      result.current.handleSelectLot('lot-1');
    });

    await act(async () => {
      await result.current.handleBulkAssignSubcontractor('sub-1', {
        canCompleteITP: true,
        itpRequiresVerification: false,
      });
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/lots/bulk-assign-subcontractor', {
      method: 'POST',
      body: JSON.stringify({
        lotIds: ['lot-1'],
        subcontractorId: 'sub-1',
        canCompleteITP: true,
        itpRequiresVerification: false,
      }),
    });
  });
});
