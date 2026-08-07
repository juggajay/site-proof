import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';

import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/renderWithProviders';
import { DEVICES, installMatchMedia } from '@/test/stubs/matchMedia';
import { ApiError } from '@/lib/api';
import type { ClaimBandAmount, ClaimBandLine, ClaimDetail } from './types';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

import { ClaimDetailPage } from './ClaimDetailPage';

function amount(cents: number | null, percentage: number | null, reason = ''): ClaimBandAmount {
  return { cents, percentage, unavailableReason: cents === null ? reason : null };
}

function line(overrides: Partial<ClaimBandLine> = {}): ClaimBandLine {
  return {
    claimedLotId: 'cl-1',
    lotId: 'lot-1',
    lotNumber: 'LOT-001',
    description: 'Subgrade preparation',
    activityType: 'Earthworks',
    chainageStart: 120,
    chainageEnd: 340,
    previouslyClaimed: amount(840000, 20),
    thisClaim: amount(2730000, 65),
    claimedToDate: amount(3570000, 85),
    priorClaimCount: 1,
    derivation: { basis: 'percent_of_lot_budget', percentage: 65, lotBudgetCents: 4200000 },
    itp: { completed: 13, total: 20 },
    ...overrides,
  };
}

function claimDetail(overrides: Partial<ClaimDetail> = {}): ClaimDetail {
  const lines = overrides.bands?.lines ?? [line()];
  return {
    id: 'claim-1',
    claimNumber: 3,
    claimPeriodStart: '2026-06-01T00:00:00.000Z',
    claimPeriodEnd: '2026-06-30T00:00:00.000Z',
    status: 'submitted',
    certifiedAt: null,
    paidAt: null,
    submittedAt: '2026-07-01T00:00:00.000Z',
    variations: [],
    certification: null,
    ...overrides,
    bands: {
      lines,
      lineTotals: {
        previouslyClaimed: amount(840000, null),
        thisClaim: amount(2730000, null),
        claimedToDate: amount(3570000, null),
      },
      // Deliberately larger than the lot-line subtotal: a claim's recorded total
      // also carries variation value, and the page must not imply the lot lines
      // reconcile to it.
      claimLevel: { totalClaimedCents: 3280000, certifiedCents: null, paidCents: null },
      priorClaimCount: 1,
      historyStatuses: ['submitted', 'disputed', 'certified', 'partially_paid', 'paid'],
      ...overrides.bands,
    },
  };
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/claims/:claimId" element={<ClaimDetailPage />} />
    </Routes>,
    { initialEntries: ['/projects/project-1/claims/claim-1'] },
  );
}

describe('ClaimDetailPage', () => {
  beforeEach(() => {
    installMatchMedia(DEVICES.desktopWide);
    apiFetchMock.mockReset();
  });

  it('labels the three bands precisely — never a bare "To date"', async () => {
    apiFetchMock.mockResolvedValue({ claim: claimDetail() });
    renderPage();

    expect(await screen.findByText('Previously claimed')).toBeInTheDocument();
    expect(screen.getByText('This claim')).toBeInTheDocument();
    expect(screen.getByText('Claimed to date')).toBeInTheDocument();
    expect(screen.queryByText('To date')).not.toBeInTheDocument();
  });

  it('renders the server-computed band figures without re-summing them', async () => {
    apiFetchMock.mockResolvedValue({ claim: claimDetail() });
    renderPage();

    // Each figure appears on its line and again in the subtotal row — both come
    // from the server, so neither was added in the browser.
    expect((await screen.findAllByText('$8,400.00')).length).toBe(2);
    expect(screen.getAllByText('$27,300.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$35,700.00').length).toBe(2);
  });

  it('shows certification at claim level only, and invents no per-line figure', async () => {
    apiFetchMock.mockResolvedValue({ claim: claimDetail() });
    renderPage();

    expect(await screen.findByText('Certified — claim level')).toBeInTheDocument();
    expect(
      screen.getByText(/Certification is recorded against the whole claim, not per lot/),
    ).toBeInTheDocument();
    // No certified column exists on the lines table.
    expect(screen.queryByRole('columnheader', { name: /^Certified/ })).not.toBeInTheDocument();
  });

  it('states the two facts behind a line separately, not as one formula', async () => {
    apiFetchMock.mockResolvedValue({ claim: claimDetail() });
    renderPage();

    expect(await screen.findByText('65% of the $42,000.00 lot budget')).toBeInTheDocument();
    expect(screen.getByText('ITP 13/20')).toBeInTheDocument();
    // The ITP ratio must never be presented as producing the dollar figure.
    expect(screen.queryByText(/ITP 13\/20\)\s*=/)).not.toBeInTheDocument();
  });

  it('says the amount is as recorded when the lot budget no longer reproduces it', async () => {
    apiFetchMock.mockResolvedValue({
      claim: claimDetail({
        bands: {
          lines: [
            line({
              derivation: { basis: 'recorded_amount', percentage: 65, lotBudgetCents: 5000000 },
            }),
          ],
        } as ClaimDetail['bands'],
      }),
    });
    renderPage();

    expect(await screen.findByText('Amount as recorded on this claim')).toBeInTheDocument();
    expect(screen.queryByText(/lot budget$/)).not.toBeInTheDocument();
  });

  it('renders an em-dash with a reason for a legacy line that has no amount', async () => {
    const reason = 'This claim line was recorded without an amount.';
    apiFetchMock.mockResolvedValue({
      claim: claimDetail({
        bands: {
          lines: [
            line({
              previouslyClaimed: amount(0, 0),
              thisClaim: amount(null, null, reason),
              claimedToDate: amount(null, null, 'Cannot be derived.'),
              derivation: { basis: 'recorded_amount', percentage: null, lotBudgetCents: null },
            }),
          ],
          lineTotals: {
            previouslyClaimed: amount(0, null),
            thisClaim: amount(null, null, 'Cannot be derived.'),
            claimedToDate: amount(null, null, 'Cannot be derived.'),
          },
        } as ClaimDetail['bands'],
      }),
    });
    renderPage();

    // Two unavailable cells on the line plus two in the subtotal row, each an
    // em-dash carrying its reason — never a confident dollar figure.
    const dashes = await screen.findAllByLabelText(/without an amount|Cannot be derived/);
    expect(dashes).toHaveLength(4);
    for (const dash of dashes) {
      expect(dash).toHaveTextContent('—');
    }
    // "Previously claimed" is genuinely nil here, and a true zero still prints.
    expect(screen.getAllByText('$0.00')).toHaveLength(2);
  });

  it('renders a variation-only claim with no lot rows and no fake reconciliation', async () => {
    apiFetchMock.mockResolvedValue({
      claim: claimDetail({
        variations: [
          {
            id: 'var-1',
            variationNumber: 'VAR-0007',
            title: 'Client-directed drainage change',
            clientReference: 'SI-7',
            approvedAmount: 5500,
          },
        ],
        bands: {
          lines: [],
          lineTotals: {
            previouslyClaimed: amount(0, null),
            thisClaim: amount(0, null),
            claimedToDate: amount(0, null),
          },
          claimLevel: { totalClaimedCents: 550000, certifiedCents: null, paidCents: null },
          priorClaimCount: 0,
          historyStatuses: ['submitted'],
        },
      }),
    });
    renderPage();

    expect(await screen.findByText('No lot lines on this claim')).toBeInTheDocument();
    expect(screen.getByText(/carries approved variations only/)).toBeInTheDocument();
    expect(screen.getByText('VAR-0007')).toBeInTheDocument();
    expect(screen.getByText(/not part of the lot-line subtotal/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('states its derivation basis rather than implying an immutable ledger', async () => {
    apiFetchMock.mockResolvedValue({ claim: claimDetail() });
    renderPage();

    expect(await screen.findByText(/derived from 1 earlier claim/)).toBeInTheDocument();
    expect(screen.getByText(/drafts excluded/)).toBeInTheDocument();
    expect(screen.getByText(/recompute if the claim history changes/)).toBeInTheDocument();
  });

  it('shows one band at a time behind a segmented control on a phone', async () => {
    installMatchMedia(DEVICES.phonePortrait);
    apiFetchMock.mockResolvedValue({ claim: claimDetail() });
    renderPage();

    await screen.findByRole('tablist', { name: 'Claim band' });
    // Defaults to This claim; the other bands' figures are not on screen at all
    // (no sideways scroll to discover them).
    expect(screen.getAllByText('$27,300.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('$8,400.00')).not.toBeInTheDocument();
    expect(screen.queryByText('$35,700.00')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Previously claimed' }));

    await waitFor(() => expect(screen.getAllByText('$8,400.00').length).toBeGreaterThan(0));
    expect(screen.queryByText('$27,300.00')).not.toBeInTheDocument();
    expect(screen.queryByText('$35,700.00')).not.toBeInTheDocument();
  });

  it('shows the shared claims access-denied state when the role is not commercial', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    renderPage();

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    expect(
      screen.getByText('You do not have access to progress claims for this project.'),
    ).toBeInTheDocument();
  });
});
