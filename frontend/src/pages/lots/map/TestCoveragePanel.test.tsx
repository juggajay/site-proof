import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TestCoveragePanel } from './TestCoveragePanel';
import type { TestCoverageLot } from './testCoverageData';

// Wave C3 Phase A, AT-86 `[C3S-B7]`. `unknown` is neither "fine" nor
// "under-tested" — it means CIVOS has no rule, and the panel must say WHY.

const SHORT: TestCoverageLot = {
  lotId: 'lot-short',
  state: 'insufficient',
  lotNumber: 'LOT-002',
  ruleset: { id: 'vicroads-204.v2', status: 'confirmed' },
  rules: [
    {
      testType: 'compaction',
      state: 'insufficient',
      requiredCount: 6,
      passingCount: 1,
      pendingCount: 0,
      failedCount: 0,
      citation: {
        authority: 'DTP (VicRoads)',
        document: 'Section 204 – Earthworks',
        clause: '204.13(a)',
      },
    },
  ],
};

const UNKNOWN: TestCoverageLot = {
  lotId: 'lot-unknown',
  state: 'unknown',
  lotNumber: 'LOT-003',
  ruleset: null,
  rules: [],
  unknownCauses: ['no_ruleset_for_project'],
};

function renderPanel(over: Partial<Parameters<typeof TestCoveragePanel>[0]> = {}) {
  return render(
    <TestCoveragePanel
      lots={[{ lotId: 'lot-ok', state: 'satisfied' }, SHORT, UNKNOWN]}
      lotsWithoutGeometry={4}
      isLoading={false}
      error={null}
      isMobile={false}
      updatedAt={Date.parse('2026-07-28T04:32:00.000Z')}
      isFetching={false}
      onOpenLot={vi.fn()}
      onClear={vi.fn()}
      onRefresh={vi.fn()}
      {...over}
    />,
  );
}

describe('TestCoveragePanel', () => {
  it('lists only the lots with something to say, with the real numbers', () => {
    renderPanel();

    const short = screen.getByTestId('test-coverage-lot-lot-short');
    expect(within(short).getByText('LOT-002')).toBeInTheDocument();
    expect(within(short).getByText(/1 of 6 compaction verified/)).toBeInTheDocument();
    expect(within(short).getByText(/204\.13\(a\)/)).toBeInTheDocument();

    // A satisfied lot has already said everything it has to say, in its colour.
    expect(screen.queryByTestId('test-coverage-lot-lot-ok')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-coverage-tally')).toHaveTextContent(
      '1 satisfied · 2 to review',
    );
  });

  it('AT-86 an unknown lot carries its CAUSE and is not a shortfall', () => {
    renderPanel();
    const unknown = screen.getByTestId('test-coverage-lot-lot-unknown');
    expect(
      within(unknown).getByText('No test-frequency pack for this authority'),
    ).toBeInTheDocument();
    // Never phrased as a shortfall — CIVOS did not check, it did not accuse.
    expect(within(unknown).queryByText(/verified/)).not.toBeInTheDocument();
  });

  it('counts the lots that are not on the map instead of drawing them', () => {
    renderPanel();
    expect(screen.getByTestId('test-coverage-unmapped')).toHaveTextContent('4 lots not on the map');
  });

  it('stamps how old the verdict is [C3R-A9]', () => {
    renderPanel();
    expect(screen.getByTestId('test-coverage-stamp')).toHaveTextContent(/as at \d{1,2}:\d{2}/);
    // Nothing resolved yet -> no stamp at all, rather than a lie about "now".
    renderPanel({ updatedAt: 0 });
    expect(screen.getAllByTestId('test-coverage-stamp')).toHaveLength(1);
  });

  it('an error names the overlay as the missing thing, not the lots', () => {
    renderPanel({ error: new Error('boom'), lots: [] });
    expect(screen.getByTestId('test-coverage-error')).toHaveTextContent(
      /the map is showing lot status/i,
    );
    expect(screen.queryByTestId('test-coverage-tally')).not.toBeInTheDocument();
  });
});
