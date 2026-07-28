import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ProjectCloseoutReadiness,
  groupBlockedLotsByReason,
  type CloseoutReadinessResponse,
  type HandoverReadinessVerdict,
} from './ProjectCloseoutReadiness';

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock('@/lib/api', () => ({
  apiFetch: apiFetchMock,
  ApiError: class ApiError extends Error {},
}));

function renderPanel(body: CloseoutReadinessResponse) {
  apiFetchMock.mockResolvedValue(body);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProjectCloseoutReadiness projectId="p1" projectRouteBase="/projects/p1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const lot = (id: string, reasonCodes: HandoverReadinessVerdict['reasonCodes']) =>
  ({
    subjectType: 'lot',
    subjectId: id,
    ready: reasonCodes.length === 0,
    reasonCodes,
  }) satisfies HandoverReadinessVerdict;

const rollup = (reasonCodes: HandoverReadinessVerdict['reasonCodes']) =>
  ({
    subjectType: 'project',
    subjectId: 'p1',
    ready: reasonCodes.length === 0,
    reasonCodes,
  }) satisfies HandoverReadinessVerdict;

afterEach(() => {
  apiFetchMock.mockReset();
});

describe('groupBlockedLotsByReason', () => {
  it('counts lots per code, ignores the project rollup, and orders by count', () => {
    expect(
      groupBlockedLotsByReason([
        lot('a', ['open_ncrs', 'not_conformed']),
        lot('b', ['not_conformed']),
        lot('c', []),
        rollup(['open_ncrs', 'not_conformed']),
      ]),
    ).toEqual([
      { code: 'not_conformed', label: 'Not conformed', count: 2 },
      { code: 'open_ncrs', label: 'Open NCRs', count: 1 },
    ]);
  });

  it('shows an unregistered code humanised rather than dropping it [DH-B1]', () => {
    // A backend that ships a tenth code before this mirror is updated. Built
    // through the widened wire shape rather than a cast, because the wire
    // genuinely can carry a code this build has never heard of.
    expect(
      groupBlockedLotsByReason([{ subjectType: 'lot', reasonCodes: ['some_future_code'] }]),
    ).toEqual([{ code: 'some_future_code', label: 'Some future code', count: 1 }]);
  });
});

describe('ProjectCloseoutReadiness', () => {
  it('groups blocked lots by reason and states the quality-only scope', async () => {
    renderPanel({
      verdicts: [
        lot('a', ['open_ncrs', 'not_conformed']),
        lot('b', ['not_conformed']),
        lot('c', []),
        { subjectType: 'project', subjectId: 'p1', ready: false, reasonCodes: ['open_ncrs'] },
      ],
      unplacedLots: 0,
      unclassifiedLots: 0,
    });

    expect(await screen.findByText('Quality Closeout Readiness')).toBeInTheDocument();
    // Two of the three lots are blocked; the third is ready.
    expect(screen.getByText('blocked of 3 lots')).toBeInTheDocument();
    expect(screen.getByText('blocked of 3 lots').previousElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Not conformed')).toBeInTheDocument();
    expect(screen.getByText('Open NCRs')).toBeInTheDocument();
    // The honesty line `[DR-A1]`: no handover claim on this surface.
    expect(
      screen.getByText(/does not assess commercial or record completeness/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/handover/i)).not.toBeInTheDocument();
  });

  it('says every lot is ready rather than showing an empty group list', async () => {
    renderPanel({
      verdicts: [
        lot('a', []),
        lot('b', []),
        { subjectType: 'project', subjectId: 'p1', ready: true, reasonCodes: [] },
      ],
      unplacedLots: 0,
      unclassifiedLots: 0,
    });

    await waitFor(() =>
      expect(screen.getByText('All 2 lots are quality-closeout ready')).toBeInTheDocument(),
    );
  });

  it('names an empty project instead of claiming it is ready', async () => {
    renderPanel({
      verdicts: [{ subjectType: 'project', subjectId: 'p1', ready: true, reasonCodes: [] }],
      unplacedLots: 0,
      unclassifiedLots: 0,
    });

    await waitFor(() => expect(screen.getByText('No lots to assess yet')).toBeInTheDocument());
  });
});
