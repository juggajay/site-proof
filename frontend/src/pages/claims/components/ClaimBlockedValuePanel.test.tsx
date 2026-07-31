import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClaimBlockedValuePanel, CLAIM_READINESS_INDICATOR_LABEL } from './ClaimBlockedValuePanel';

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock('@/lib/api', () => ({
  apiFetch: apiFetchMock,
  ApiError: class ApiError extends Error {},
}));

const SUMMARY = {
  totalBudget: 140000,
  claimableValue: 62000,
  blockedValue: 70000,
  lotsInScope: 12,
  lotsBlocked: 5,
  lotsWithNullBudget: 2,
  groups: [
    { code: 'not_conformed', lotCount: 4, blockedValue: 70000 },
    { code: 'itp_incomplete', lotCount: 3, blockedValue: 45000 },
    { code: 'missing_budget', lotCount: 2, blockedValue: 0 },
  ],
};

const BLOCKED_LOTS = {
  reasonCode: 'not_conformed',
  nextCursor: null,
  items: [
    {
      lotId: 'lot-1',
      lotNumber: 'EW-L0001',
      activityType: 'Earthworks',
      budgetAmount: 40000,
      blockedValue: 40000,
      claimedPercentage: 0,
      remainingPercentage: 100,
      items: [
        {
          code: 'not_conformed',
          severity: 'blocker',
          area: 'claim',
          title: 'Not conformed',
          detail: 'Only conformed lots can be selected for a progress claim.',
          blocksAction: true,
        },
      ],
    },
  ],
};

function renderPanel(summary: unknown = SUMMARY) {
  apiFetchMock.mockImplementation((path: string) => {
    if (path.includes('/claim-readiness/blocked-lots')) return Promise.resolve(BLOCKED_LOTS);
    if (path.includes('/claim-readiness/summary')) return Promise.resolve(summary);
    throw new Error(`unexpected fetch: ${path}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ClaimBlockedValuePanel projectId="p1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe('ClaimBlockedValuePanel (Wave F F1)', () => {
  it('renders the three figures and the blocked-lot count', async () => {
    renderPanel();

    expect(await screen.findByText('$140,000')).toBeInTheDocument();
    // By position in the figure list: the blocked figure repeats as a group
    // value further down, so a bare text query would be ambiguous.
    expect(screen.getAllByRole('definition').map((node) => node.textContent)).toEqual([
      '$140,000',
      '$62,000',
      '$70,000',
    ]);
    expect(screen.getByText(/5 of 12 lots cannot be put on a claim right now/)).toBeInTheDocument();
  });

  // AT-F1-LABEL (spec §1.4). The panel renders CIVOS-derived dollar figures, so
  // the label ships in the same visual block or the panel does not ship.
  it('AT-F1-LABEL: carries the project-management indicator label', async () => {
    renderPanel();
    expect(await screen.findByText(CLAIM_READINESS_INDICATOR_LABEL)).toBeInTheDocument();
    expect(CLAIM_READINESS_INDICATOR_LABEL).toBe(
      'Project-management indicator — not an accounting balance or entitlement.',
    );
  });

  // The panel's group values legitimately exceed its own blocked total
  // (§1.2 `[FR-B2]`), so the disclosure is part of the contract, not decoration.
  it('discloses that a lot can sit in more than one group', async () => {
    renderPanel();
    expect(
      await screen.findByText(
        'A lot can be blocked by more than one thing, so these add up to more than the total.',
      ),
    ).toBeInTheDocument();

    const groupTotal = SUMMARY.groups.reduce((total, group) => total + group.blockedValue, 0);
    expect(groupTotal).toBeGreaterThan(SUMMARY.blockedValue);
  });

  it('states that null-budget lots are counted but carry no value', async () => {
    renderPanel();
    expect(await screen.findByText(/Lots with no budget set: 2/)).toBeInTheDocument();
  });

  it('labels reason codes in plain English, including the acronyms', async () => {
    renderPanel();
    expect(await screen.findByText('Not Conformed')).toBeInTheDocument();
    expect(screen.getByText('ITP Checklist Incomplete')).toBeInTheDocument();
    expect(screen.getByText('Missing Budget')).toBeInTheDocument();
  });

  it('drills a group down to its source lots on expand', async () => {
    const user = userEvent.setup();
    renderPanel();

    const group = await screen.findByRole('button', { name: /Not Conformed/ });
    expect(group).toHaveAttribute('aria-expanded', 'false');
    await user.click(group);

    expect(await screen.findByRole('link', { name: 'EW-L0001' })).toHaveAttribute(
      'href',
      '/projects/p1/lots/lot-1',
    );
    expect(
      screen.getByText(/Only conformed lots can be selected for a progress claim/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        apiFetchMock.mock.calls.some((call: unknown[]) =>
          String(call[0]).includes('reasonCode=not_conformed'),
        ),
      ).toBe(true),
    );
  });

  it('says so plainly when there are no lots to assess', async () => {
    renderPanel({ ...SUMMARY, lotsInScope: 0 });
    expect(await screen.findByText('No lots to assess yet.')).toBeInTheDocument();
  });
});
