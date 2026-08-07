/**
 * Benchmark T1 — the hold-point row states.
 *
 * The gap this closes: the row used to say only "released by X" or a generic
 * lock, so a foreman could not tell whether the office had already called the
 * superintendent, and had no way to ask from where they were standing.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { getHoldPointRowState, ITPChecklistHoldPointState } from './ITPChecklistHoldPointState';
import type { ItpHoldPointState } from '../types';

const authState = vi.hoisted(() => ({ actualRole: 'quality_manager' as string | null }));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ actualRole: authState.actualRole }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

function makeHoldPoint(overrides: Partial<ItpHoldPointState> = {}): ItpHoldPointState {
  return {
    id: 'hp-1',
    itpChecklistItemId: 'item-1',
    status: 'pending',
    scheduledDate: null,
    scheduledTime: null,
    notificationSentAt: null,
    notificationSentTo: null,
    releasedByName: null,
    releasedByOrg: null,
    releaseMethod: null,
    releasedAt: null,
    releaseNotes: null,
    ...overrides,
  };
}

function renderState(
  holdPoint: ItpHoldPointState | undefined,
  {
    canRequestRelease = true,
    hasReleaseAttribution = false,
    onRequestRelease = vi.fn(),
    onShowQrCode = vi.fn(),
  } = {},
) {
  const state = getHoldPointRowState(holdPoint, hasReleaseAttribution);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ITPChecklistHoldPointState
        state={state}
        holdPoint={holdPoint}
        releaseAttribution={null}
        canRequestRelease={canRequestRelease}
        onRequestRelease={onRequestRelease}
        onShowQrCode={onShowQrCode}
        projectId="project-1"
        lotId="lot-1"
        itemId="item-1"
      />
    </QueryClientProvider>,
  );
  return { onRequestRelease, onShowQrCode, queryClient };
}

function conditionDetail(
  conditions: Array<{
    id: string;
    sequence: number;
    text: string;
    recordedSatisfiedAt: string | null;
    recordedSatisfiedByName: string | null;
    satisfactionNote: string | null;
    satisfactionEvidenceDocumentId: string | null;
  }>,
) {
  return {
    holdPoint: {
      ...makeHoldPoint({
        status: 'released',
        latestRound: {
          outcome: 'released_with_conditions',
          decidedAt: '2026-09-03T00:00:00.000Z',
          decisionReason: null,
          ncrId: null,
          ncrNumber: null,
          ncrStatus: null,
          openConditionCount: conditions.filter((condition) => !condition.recordedSatisfiedAt)
            .length,
          conditions,
        },
      }),
      lotId: 'lot-1',
      lotNumber: 'LOT-001',
      description: 'Proof roll hold point',
      pointType: 'hold_point',
      sequenceNumber: 4,
      isCompleted: true,
      isVerified: false,
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    prerequisites: [],
    incompletePrerequisites: [],
    canRequestRelease: false,
  };
}

describe('getHoldPointRowState', () => {
  it('reads the four states off the hold point', () => {
    expect(getHoldPointRowState(undefined, false)).toBe('not_requested');
    expect(getHoldPointRowState(makeHoldPoint({ status: 'pending' }), false)).toBe('not_requested');
    expect(getHoldPointRowState(makeHoldPoint({ status: 'notified' }), false)).toBe('requested');
    expect(getHoldPointRowState(makeHoldPoint({ status: 'released' }), false)).toBe('released');
    expect(
      getHoldPointRowState(
        makeHoldPoint({
          status: 'pending',
          latestRound: {
            outcome: 'rejected',
            decidedAt: '2026-09-03T00:00:00.000Z',
            decisionReason: 'Proof roll failed under the authority review.',
            ncrId: 'ncr-1',
            ncrNumber: 'NCR-0042',
            ncrStatus: 'open',
            openConditionCount: 0,
          },
        }),
        false,
      ),
    ).toBe('refused');
    expect(
      getHoldPointRowState(
        makeHoldPoint({
          status: 'released',
          latestRound: {
            outcome: 'released_with_conditions',
            decidedAt: '2026-09-03T00:00:00.000Z',
            decisionReason: null,
            ncrId: null,
            ncrNumber: null,
            ncrStatus: null,
            openConditionCount: 2,
          },
        }),
        false,
      ),
    ).toBe('conditions_open');
  });

  it('still reads released from the completion when no hold point is served', () => {
    // The subcontractor portal view gets release attribution but no hold-point
    // payload; it must keep behaving exactly as it did before T1.
    expect(getHoldPointRowState(undefined, true)).toBe('released');
  });
});

describe('ITPChecklistHoldPointState', () => {
  beforeEach(() => {
    authState.actualRole = 'quality_manager';
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/holdpoints/lot/lot-1/item/item-1') return conditionDetail([]);
      if (path === '/api/documents/project-1?limit=100') return { documents: [] };
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('offers the request action on a hold point nobody has asked about', async () => {
    const { onRequestRelease } = renderState(undefined);

    expect(screen.getByText(/must be released by the authority/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /request release/i }));
    expect(onRequestRelease).toHaveBeenCalledTimes(1);
  });

  it('hides the request action from a role that cannot request one', () => {
    renderState(undefined, { canRequestRelease: false });

    expect(screen.queryByRole('button', { name: /request release/i })).not.toBeInTheDocument();
  });

  it('names the recipient and the due date once a release has been requested', () => {
    renderState(
      makeHoldPoint({
        status: 'notified',
        notificationSentTo: 'super@example.com',
        scheduledDate: '2026-09-04T00:00:00.000Z',
        scheduledTime: '09:30',
      }),
    );

    const pending = screen.getByText(/Release requested/);
    expect(pending).toHaveTextContent('super@example.com');
    expect(pending).toHaveTextContent('4/09/2026');
    expect(pending).toHaveTextContent('09:30');
  });

  it('summarises a multi-recipient request instead of listing every address', () => {
    renderState(
      makeHoldPoint({
        status: 'notified',
        notificationSentTo: 'super@example.com, client@example.com, cc@example.com',
      }),
    );

    expect(screen.getByText(/Release requested/)).toHaveTextContent(
      'super@example.com and 2 others',
    );
  });

  it('offers the QR code only once a release is out', async () => {
    const { onShowQrCode } = renderState(makeHoldPoint({ status: 'notified' }));

    await userEvent.click(screen.getByRole('button', { name: /release by qr code/i }));
    expect(onShowQrCode).toHaveBeenCalledTimes(1);
  });

  it('does not offer a QR code before anyone has been asked', () => {
    renderState(makeHoldPoint({ status: 'pending' }));

    expect(screen.queryByRole('button', { name: /qr code/i })).not.toBeInTheDocument();
  });

  it('reads out the release attribution', () => {
    renderState(
      makeHoldPoint({
        status: 'released',
        releasedByName: 'Amos Soo',
        releasedByOrg: 'Client Company',
        releaseMethod: 'secure_link',
        releasedAt: '2026-09-04T02:00:00.000Z',
      }),
    );

    const attribution = screen.getByText(/Released by Amos Soo/);
    expect(attribution).toHaveTextContent('Client Company');
    expect(attribution).toHaveTextContent('via secure link');
  });

  it('renders a refused state and disables re-request while its NCR is open', () => {
    renderState(
      makeHoldPoint({
        latestRound: {
          outcome: 'rejected',
          decidedAt: '2026-09-03T00:00:00.000Z',
          decisionReason: 'The proof roll remains non-compliant.',
          ncrId: 'ncr-1',
          ncrNumber: 'NCR-0042',
          ncrStatus: 'open',
          openConditionCount: 0,
        },
      }),
    );

    expect(screen.getByText('Release refused — NCR-0042 open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-request release' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Re-request release' })).toHaveAttribute(
      'title',
      'Close the linked NCR before re-requesting release.',
    );
  });

  it('renders open release conditions distinctly', () => {
    renderState(
      makeHoldPoint({
        status: 'released',
        latestRound: {
          outcome: 'released_with_conditions',
          decidedAt: '2026-09-03T00:00:00.000Z',
          decisionReason: null,
          ncrId: null,
          ncrNumber: null,
          ncrStatus: null,
          openConditionCount: 3,
        },
      }),
    );

    expect(screen.getByText('Released — 3 conditions open')).toBeInTheDocument();
    expect(screen.getByText(/Permission to proceed has been granted/i)).toBeInTheDocument();
  });

  it('loads and renders open and satisfied condition rows from the detail contract', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/documents/project-1?limit=100') return { documents: [] };
      if (path === '/api/holdpoints/lot/lot-1/item/item-1') {
        return conditionDetail([
          {
            id: 'condition-open',
            sequence: 1,
            text: 'Protect the exposed edge.',
            recordedSatisfiedAt: null,
            recordedSatisfiedByName: null,
            satisfactionNote: null,
            satisfactionEvidenceDocumentId: null,
          },
          {
            id: 'condition-satisfied',
            sequence: 2,
            text: 'Upload the final survey.',
            recordedSatisfiedAt: '2026-09-05T03:00:00.000Z',
            recordedSatisfiedByName: 'Alex Quality',
            satisfactionNote: 'Survey uploaded.',
            satisfactionEvidenceDocumentId: 'document-1',
          },
        ]);
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderState(
      makeHoldPoint({
        status: 'released',
        latestRound: {
          outcome: 'released_with_conditions',
          decidedAt: '2026-09-03T00:00:00.000Z',
          decisionReason: null,
          ncrId: null,
          ncrNumber: null,
          ncrStatus: null,
          openConditionCount: 1,
        },
      }),
    );

    expect(await screen.findByText('1. Protect the exposed edge.')).toBeInTheDocument();
    expect(screen.getByText('2. Upload the final survey.')).toBeInTheDocument();
    expect(screen.getByText(/Recorded satisfied by Alex Quality/)).toHaveTextContent('5/09/2026');
    expect(screen.getByText('Survey uploaded.')).toBeInTheDocument();
  });

  it('posts satisfaction and immediately renders the satisfied state', async () => {
    const openCondition = {
      id: 'condition-open',
      sequence: 1,
      text: 'Protect the exposed edge.',
      recordedSatisfiedAt: null,
      recordedSatisfiedByName: null,
      satisfactionNote: null,
      satisfactionEvidenceDocumentId: null,
    };
    apiFetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/holdpoints/lot/lot-1/item/item-1') {
        return conditionDetail([openCondition]);
      }
      if (path === '/api/documents/project-1?limit=100') {
        return { documents: [{ id: 'document-1', filename: 'edge-photo.jpg' }] };
      }
      if (
        path === '/api/holdpoints/hp-1/conditions/condition-open/record-satisfaction' &&
        options?.method === 'POST'
      ) {
        return {
          condition: {
            ...openCondition,
            recordedSatisfiedAt: '2026-09-06T01:00:00.000Z',
            recordedSatisfiedByName: 'Alex Quality',
            satisfactionNote: 'Barrier installed.',
            satisfactionEvidenceDocumentId: 'document-1',
          },
          remainingOpenConditionCount: 0,
          itpCompletionVerified: true,
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderState(
      makeHoldPoint({
        status: 'released',
        latestRound: {
          outcome: 'released_with_conditions',
          decidedAt: '2026-09-03T00:00:00.000Z',
          decisionReason: null,
          ncrId: null,
          ncrNumber: null,
          ncrStatus: null,
          openConditionCount: 1,
        },
      }),
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Record satisfaction' }));
    await user.type(screen.getByLabelText('Satisfaction note (optional)'), 'Barrier installed.');
    await screen.findByRole('option', { name: 'edge-photo.jpg' });
    await user.selectOptions(screen.getByLabelText('Evidence document (optional)'), 'document-1');
    await user.click(screen.getByRole('button', { name: 'Record satisfaction' }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/holdpoints/hp-1/conditions/condition-open/record-satisfaction',
        {
          method: 'POST',
          body: JSON.stringify({
            note: 'Barrier installed.',
            evidenceDocumentId: 'document-1',
          }),
        },
      ),
    );
    expect(await screen.findByText(/Recorded satisfied by Alex Quality/)).toHaveTextContent(
      '6/09/2026',
    );
    expect(screen.getByText('Barrier installed.')).toBeInTheDocument();
  });

  it('does not offer satisfaction actions to company admins outside the three project roles', async () => {
    authState.actualRole = 'admin';
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/holdpoints/lot/lot-1/item/item-1') {
        return conditionDetail([
          {
            id: 'condition-open',
            sequence: 1,
            text: 'Protect the exposed edge.',
            recordedSatisfiedAt: null,
            recordedSatisfiedByName: null,
            satisfactionNote: null,
            satisfactionEvidenceDocumentId: null,
          },
        ]);
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderState(
      makeHoldPoint({
        status: 'released',
        latestRound: {
          outcome: 'released_with_conditions',
          decidedAt: '2026-09-03T00:00:00.000Z',
          decisionReason: null,
          ncrId: null,
          ncrNumber: null,
          ncrStatus: null,
          openConditionCount: 1,
        },
      }),
    );

    expect(await screen.findByText('Not yet recorded satisfied.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record satisfaction' })).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/documents/project-1?limit=100');
  });
});
