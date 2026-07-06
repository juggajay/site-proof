import { type ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('shows management prep warnings with a filtered Hold Points CTA for managers', () => {
    const managementReadiness = {
      ...readiness,
      managementPrep: {
        state: 'warning',
        counts: {
          releaseGatedHoldPoints: 3,
          missingRequestEvidence: 2,
          missingRecipients: 1,
          fieldActionableItems: 2,
          managementOnlyItems: 3,
        },
        blockers: [],
        warnings: [
          {
            code: 'missing_request_evidence',
            severity: 'warning',
            area: 'hold_point',
            title: 'Request evidence missing',
            detail: '2 release-gated hold points have no request evidence attached yet.',
            blocksAction: false,
            count: 2,
            actionLabel: 'Open Hold Points',
            actionHref: '/projects/project-1/hold-points?lotId=lot-1',
          },
          {
            code: 'management_only_items',
            severity: 'warning',
            area: 'hold_point',
            title: 'Management-only items',
            detail: '3 hold points need management or superintendent release before handoff.',
            blocksAction: false,
            count: 3,
            actionLabel: 'Review hold points',
            actionHref: '/projects/project-1/hold-points?lotId=lot-1',
          },
        ],
        support: [
          {
            code: 'field_actionable_items',
            severity: 'support',
            area: 'itp',
            title: 'Field-actionable ITP items',
            detail: '2 checklist items can be worked by field teams.',
            blocksAction: false,
            count: 2,
          },
        ],
      },
    } as LotEvidenceReadiness;

    renderPanel({ readiness: managementReadiness });

    expect(screen.getByText('Management prep: Needs attention')).toBeInTheDocument();
    expect(screen.getByText('Request evidence missing')).toBeInTheDocument();
    expect(screen.getByText('Management-only items')).toBeInTheDocument();
    expect(screen.getByText('Field-actionable ITP items')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Hold Points' })).toHaveAttribute(
      'href',
      '/projects/project-1/hold-points?lotId=lot-1',
    );
  });

  const readinessWithOutstandingTests = {
    ...readiness,
    conformance: {
      ...readiness.conformance,
      blockers: [
        {
          code: 'no_passing_verified_test',
          severity: 'blocker',
          area: 'test',
          title: 'Required tests outstanding',
          detail: '1 required test outstanding',
          blocksAction: true,
          actionLabel: 'Review tests',
          outstandingTests: [
            {
              itemId: 'chk-1',
              description: 'Compaction density',
              testType: 'Compaction',
              state: 'no_result',
            },
          ],
        },
      ],
    },
  } as LotEvidenceReadiness;

  it('offers a per-requirement "Add" action next to each named test when onAddTestForItem is provided', () => {
    const onAddTestForItem = vi.fn();
    renderPanel({ readiness: readinessWithOutstandingTests, onAddTestForItem });

    // The test name is shown as a row, with a compact "Add" button beside it.
    expect(screen.getByText('Compaction density')).toBeInTheDocument();
    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);
    expect(onAddTestForItem).toHaveBeenCalledWith({
      id: 'chk-1',
      description: 'Compaction density',
      testType: 'Compaction',
    });
  });

  it('shows outstanding-test names but no "Add" action when onAddTestForItem is omitted (non-creator roles)', () => {
    renderPanel({ readiness: readinessWithOutstandingTests });
    // Non-creators still see which tests are outstanding (the prose no longer names them)...
    expect(screen.getByText('Compaction density')).toBeInTheDocument();
    // ...but get no Add affordance.
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  });

  it('collapses long outstanding-test lists behind a "Show all" toggle', () => {
    const manyTests = Array.from({ length: 5 }, (_, index) => ({
      itemId: `chk-${index}`,
      description: `Test ${index}`,
      testType: null,
      state: 'no_result' as const,
    }));
    const readinessWithManyTests = {
      ...readiness,
      conformance: {
        ...readiness.conformance,
        blockers: [
          {
            code: 'no_passing_verified_test',
            severity: 'blocker',
            area: 'test',
            title: 'Required tests outstanding',
            detail: '5 required tests outstanding (5 without results).',
            blocksAction: true,
            actionLabel: 'Review tests',
            outstandingTests: manyTests,
          },
        ],
      },
    } as LotEvidenceReadiness;

    renderPanel({ readiness: readinessWithManyTests });

    // Only the first three render until expanded.
    expect(screen.getByText('Test 0')).toBeInTheDocument();
    expect(screen.getByText('Test 2')).toBeInTheDocument();
    expect(screen.queryByText('Test 3')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all 5' }));
    expect(screen.getByText('Test 3')).toBeInTheDocument();
    expect(screen.getByText('Test 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByText('Test 3')).not.toBeInTheDocument();
  });
});
