/**
 * Benchmark T1 — the hold-point row states.
 *
 * The gap this closes: the row used to say only "released by X" or a generic
 * lock, so a foreman could not tell whether the office had already called the
 * superintendent, and had no way to ask from where they were standing.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getHoldPointRowState, ITPChecklistHoldPointState } from './ITPChecklistHoldPointState';
import type { ItpHoldPointState } from '../types';

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
  render(
    <ITPChecklistHoldPointState
      state={state}
      holdPoint={holdPoint}
      releaseAttribution={null}
      canRequestRelease={canRequestRelease}
      onRequestRelease={onRequestRelease}
      onShowQrCode={onShowQrCode}
    />,
  );
  return { onRequestRelease, onShowQrCode };
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
});
