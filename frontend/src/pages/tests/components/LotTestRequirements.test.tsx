/**
 * The three claims the requirement summary makes, and the one it must never
 * make: raised is not passing, unknown is not zero, and a satisfied rule never
 * covers for an empty one.
 */

import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { LotTestRequirements } from './LotTestRequirements';
import type { LotTestRequirements as LotTestRequirementsData } from '../lotTestRequirements';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  apiFetch.mockReset();
});

const RULESET = {
  id: 'vicroads-204.v2',
  status: 'confirmed',
  revalidationLapsed: false,
  scaleLabel: null,
};

const CITATION = {
  authority: 'DTP (VicRoads)',
  document: 'Section 204 — Earthworks',
  clause: '204.13(a)',
  edition: 'v8.0, November 2025',
  confirmed: true,
};

function rule(overrides: Partial<LotTestRequirementsData['rules'][number]> = {}) {
  return {
    ruleId: 'vicroads-204.v2/compaction-density',
    testType: 'compaction',
    state: 'insufficient' as const,
    requiredCount: 6,
    passingCount: 0,
    pendingCount: 0,
    failedCount: 0,
    outstandingCount: 6,
    unknownCauses: [],
    citation: CITATION,
    ...overrides,
  };
}

function summary(overrides: Partial<LotTestRequirementsData> = {}): LotTestRequirementsData {
  return {
    lotId: 'lot-1',
    state: 'insufficient',
    mode: 'warn',
    ruleset: RULESET,
    rules: [rule()],
    unknownCauses: [],
    ...overrides,
  };
}

function renderSummary(data: LotTestRequirementsData, canRaise = false) {
  apiFetch.mockResolvedValue(data);
  return renderWithProviders(
    <LotTestRequirements lotId="lot-1" projectId="proj-1" canRaise={canRaise} />,
  );
}

describe('the fraction counts only verified passing tests', () => {
  it('shows raised-awaiting-results separately, never as progress toward passing', async () => {
    renderSummary(
      summary({
        rules: [rule({ passingCount: 0, pendingCount: 6, outstandingCount: 0 })],
      }),
    );

    // Six raised is NOT six passing.
    expect(await screen.findByText('0 of 6 passing')).toBeInTheDocument();
    expect(screen.getByText(/6 raised, awaiting results/)).toBeInTheDocument();
    expect(screen.queryByText('6 of 6 passing')).not.toBeInTheDocument();
  });

  it('names failures separately and leaves their slots outstanding', async () => {
    renderSummary(
      summary({
        rules: [rule({ passingCount: 2, pendingCount: 1, failedCount: 3, outstandingCount: 3 })],
      }),
    );

    expect(await screen.findByText('2 of 6 passing')).toBeInTheDocument();
    expect(screen.getByText(/3 failed/)).toBeInTheDocument();
    expect(screen.getByText(/3 still to raise/)).toBeInTheDocument();
  });
});

describe('unknown is unknown', () => {
  it('renders the reason and the fix, never "0 of 0"', async () => {
    renderSummary(
      summary({
        state: 'unknown',
        rules: [
          rule({
            state: 'unknown',
            requiredCount: null,
            outstandingCount: 0,
            unknownCauses: ['quantity_missing'],
            citation: null,
          }),
        ],
      }),
    );

    expect(await screen.findByText(/requirement not yet checkable/)).toBeInTheDocument();
    expect(screen.getByText(/record this lot’s quantity/)).toBeInTheDocument();
    expect(screen.queryByText(/0 of 0/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Raise/ })).not.toBeInTheDocument();
  });

  it('names the authority’s own word for the scale when one is missing', async () => {
    renderSummary(
      summary({
        state: 'unknown',
        ruleset: { ...RULESET, id: 'tfnsw-q6.v1', scaleLabel: 'specified relative compaction' },
        rules: [],
        unknownCauses: ['scale_not_selected'],
      }),
    );

    expect(
      await screen.findByText(/record this lot’s specified relative compaction/),
    ).toBeInTheDocument();
  });
});

describe('per rule, never blended', () => {
  it('keeps a satisfied rule and an empty rule as two separate lines', async () => {
    renderSummary(
      summary({
        rules: [
          rule({ state: 'satisfied', passingCount: 6, outstandingCount: 0 }),
          rule({
            ruleId: 'vicroads-204.v2/moisture',
            testType: 'moisture content',
            requiredCount: 3,
            passingCount: 0,
            outstandingCount: 3,
          }),
        ],
      }),
    );

    expect(await screen.findByText('6 of 6 passing')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 passing')).toBeInTheDocument();
    expect(screen.getAllByTestId('rule-line')).toHaveLength(2);
  });
});

describe('the working is shown', () => {
  it('cites the authority, edition and clause behind the number', async () => {
    renderSummary(summary());

    expect(
      await screen.findByText('6 required — DTP (VicRoads) v8.0, November 2025 cl. 204.13(a)'),
    ).toBeInTheDocument();
  });

  it('discloses an unconfirmed edition rather than citing it as authoritative', async () => {
    renderSummary(
      summary({
        ruleset: { ...RULESET, status: 'draft' },
        rules: [rule({ citation: { ...CITATION, confirmed: false } })],
      }),
    );

    expect(await screen.findByText('unconfirmed ruleset')).toBeInTheDocument();
    expect(
      screen.getByText(/has not been confirmed against the published document/),
    ).toBeInTheDocument();
  });
});

describe('raise', () => {
  it('posts the rule (never a count) and refreshes the summary', async () => {
    const data = summary();
    apiFetch.mockImplementation((path: string) =>
      path.startsWith('/api/test-results/batch-raise')
        ? Promise.resolve({ lotId: 'lot-1', created: [], totalCreated: 6 })
        : Promise.resolve(data),
    );

    renderWithProviders(<LotTestRequirements lotId="lot-1" projectId="proj-1" canRaise />);

    fireEvent.click(await screen.findByRole('button', { name: 'Raise 6 tests' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/api/test-results/batch-raise', {
        method: 'POST',
        body: JSON.stringify({
          lotId: 'lot-1',
          requests: [{ ruleId: 'vicroads-204.v2/compaction-density' }],
        }),
      }),
    );
  });

  it('offers no raise action to a read-only surface', async () => {
    renderSummary(summary());

    expect(await screen.findByText('0 of 6 passing')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Raise/ })).not.toBeInTheDocument();
  });
});

describe('it says nothing when it has nothing to say', () => {
  it('renders nothing where no authority pack governs the project', async () => {
    const { container } = renderSummary(summary({ ruleset: null, rules: [] }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="lot-test-requirements"]')).toBeNull();
  });

  it('renders nothing when the project switched the check off', async () => {
    const { container } = renderSummary(summary({ mode: 'off' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="lot-test-requirements"]')).toBeNull();
  });

  it('renders nothing when the read is refused (subcontractor-scoped session)', async () => {
    apiFetch.mockRejectedValue(new Error('Forbidden'));

    const { container } = renderWithProviders(
      <LotTestRequirements lotId="lot-1" projectId="proj-1" />,
    );

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="lot-test-requirements"]')).toBeNull();
  });
});
