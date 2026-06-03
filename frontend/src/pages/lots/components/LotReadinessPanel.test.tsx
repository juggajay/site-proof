import { type ComponentProps } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LotReadinessPanel } from './LotReadinessPanel';
import type { LotEvidenceReadiness } from '@/types/evidenceReadiness';

afterEach(() => {
  cleanup();
});

const readiness: LotEvidenceReadiness = {
  lotId: 'lot-1',
  lotNumber: 'LOT-001',
  status: 'in_progress',
  conformance: {
    state: 'blocked',
    blockers: [
      {
        code: 'itp-incomplete',
        severity: 'blocker',
        area: 'itp',
        title: 'ITP checklist incomplete',
        detail: '3 items remaining',
        blocksAction: true,
        actionLabel: 'Open ITP',
        actionHref: '?tab=itp',
      },
    ],
    warnings: [],
    support: [],
  },
  claim: {
    state: 'not_conformed',
    blockers: [
      {
        code: 'not-conformed',
        severity: 'blocker',
        area: 'claim',
        title: 'Lot not conformed',
        detail: 'Conform the lot before it can be claimed',
        blocksAction: true,
      },
    ],
    warnings: [],
    support: [],
    budgetAmount: null,
    claimedInId: null,
  },
  summary: { blockerCount: 2, warningCount: 0, supportCount: 0, actionBlockerCount: 2 },
};

function renderPanel(overrides: Partial<ComponentProps<typeof LotReadinessPanel>> = {}) {
  return render(
    <LotReadinessPanel
      readiness={readiness}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      onTabChange={vi.fn()}
      {...overrides}
    />,
  );
}

describe('LotReadinessPanel', () => {
  it('shows the commercial claim bucket and Evidence Readiness heading by default (managers)', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Evidence Readiness' })).toBeInTheDocument();
    // Commercial claim language is present for management/commercial roles.
    expect(screen.getByText('Claim: Not ready')).toBeInTheDocument();
    expect(screen.getByText('Lot not conformed')).toBeInTheDocument();
    // Conformance/field work is also present.
    expect(screen.getByText('ITP checklist incomplete')).toBeInTheDocument();
  });

  it('hides the claim bucket and uses field language for a foreman (fieldView)', () => {
    renderPanel({ fieldView: true });

    // Field-first heading instead of the commercial "Evidence Readiness" framing.
    expect(screen.getByRole('heading', { name: /What still needs doing/i })).toBeInTheDocument();
    expect(screen.queryByText('Evidence Readiness')).not.toBeInTheDocument();

    // No commercial claim / claim-readiness language for a field role.
    expect(screen.queryByText(/Claim/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Lot not conformed')).not.toBeInTheDocument();

    // Quality/conformance field work is preserved and still actionable.
    expect(screen.getByText('ITP checklist incomplete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open ITP' })).toBeInTheDocument();
  });
});
