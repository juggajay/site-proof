import { render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { HoldPoint } from '../types';
import { HoldPointsMobileList } from './HoldPointsMobileList';

// jsdom does not implement scrollIntoView (see src/test/README.md); the list
// calls it to bring the deep-linked card into view.
const scrollIntoView = vi.fn();
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
});

function buildHoldPoint(overrides: Partial<HoldPoint> = {}): HoldPoint {
  return {
    id: 'hp-1',
    lotId: 'lot-1',
    lotNumber: 'LOT-001',
    itpChecklistItemId: 'item-1',
    description: 'Subgrade inspection',
    pointType: 'hold',
    status: 'pending',
    notificationSentAt: null,
    scheduledDate: null,
    releasedAt: null,
    releasedByName: null,
    releaseNotes: null,
    sequenceNumber: 1,
    isCompleted: false,
    isVerified: false,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

const holdPoints = [
  buildHoldPoint(),
  buildHoldPoint({ id: 'hp-2', lotNumber: 'LOT-002', description: 'Pavement inspection' }),
];

function renderList(highlightedHpId: string | null) {
  return render(
    <HoldPointsMobileList
      holdPoints={holdPoints}
      filteredHoldPoints={holdPoints}
      loading={false}
      statusFilter="all"
      searchQuery=""
      highlightedHpId={highlightedHpId}
      copiedHpId={null}
      generatingPdf={null}
      chasingHpId={null}
      batchSelectableHoldPointIds={new Set()}
      selectedBatchHoldPointIds={new Set()}
      onCopyLink={vi.fn()}
      onRequestRelease={vi.fn()}
      onRecordRelease={vi.fn()}
      onChase={vi.fn()}
      onShowQrCode={vi.fn()}
      onGenerateEvidence={vi.fn()}
      onToggleBatchSelection={vi.fn()}
      onClearFilter={vi.fn()}
    />,
  );
}

describe('HoldPointsMobileList deep-link highlight', () => {
  it('highlights and scrolls to the deep-linked hold point', () => {
    scrollIntoView.mockClear();
    const { container } = renderList('hp-2');

    const highlighted = container.querySelectorAll('[data-deep-linked="true"]');
    expect(highlighted).toHaveLength(1);
    expect(within(highlighted[0] as HTMLElement).getByText('LOT-002')).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('renders without highlight or scrolling when there is no deep link', () => {
    scrollIntoView.mockClear();
    const { container } = renderList(null);

    expect(screen.getByText('LOT-001')).toBeInTheDocument();
    expect(container.querySelector('[data-deep-linked]')).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('renders refused and open-condition chips and blocks re-request while the NCR is open', () => {
    const lifecycleHoldPoints = [
      buildHoldPoint({
        id: 'refused',
        status: 'pending',
        latestRound: {
          outcome: 'rejected',
          decidedAt: '2026-06-02T00:00:00.000Z',
          decisionReason: 'Repair the failed area.',
          ncrId: 'ncr-42',
          ncrNumber: 'NCR-0042',
          ncrStatus: 'open',
          openConditionCount: 0,
        },
      }),
      buildHoldPoint({
        id: 'conditions',
        status: 'released',
        latestRound: {
          outcome: 'released_with_conditions',
          decidedAt: '2026-06-02T00:00:00.000Z',
          decisionReason: null,
          ncrId: null,
          ncrNumber: null,
          ncrStatus: null,
          openConditionCount: 2,
        },
      }),
    ];

    render(
      <HoldPointsMobileList
        holdPoints={lifecycleHoldPoints}
        filteredHoldPoints={lifecycleHoldPoints}
        loading={false}
        statusFilter="all"
        searchQuery=""
        highlightedHpId={null}
        copiedHpId={null}
        generatingPdf={null}
        chasingHpId={null}
        batchSelectableHoldPointIds={new Set()}
        selectedBatchHoldPointIds={new Set()}
        onCopyLink={vi.fn()}
        onRequestRelease={vi.fn()}
        onRecordRelease={vi.fn()}
        onChase={vi.fn()}
        onShowQrCode={vi.fn()}
        onGenerateEvidence={vi.fn()}
        onToggleBatchSelection={vi.fn()}
        onClearFilter={vi.fn()}
      />,
    );

    expect(screen.getByText('Release refused — NCR-0042 open')).toBeInTheDocument();
    expect(screen.getByText('Released — 2 conditions open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-request release' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Re-request release' })).toHaveAttribute(
      'title',
      'Close the linked NCR before re-requesting release.',
    );
  });
});
