/**
 * Wave G G5 — the proposal review surface on the ITP Templates page.
 *
 * The cases that matter are the ones where being wrong is invisible: a section
 * that shows an error to a foreman who cannot act on it, an accept that leaves
 * the reviewer on a page with an unchanged copy of the template, and an error
 * code read from the wrong field so every failure falls through to generic copy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/renderWithProviders';
import { ApiError } from '@/lib/api';
import type { TemplateRevisionProposal } from '@/pages/ncr/analytics/ncrAnalyticsTypes';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiGet: apiGetMock, apiPost: apiPostMock };
});

vi.mock('@/components/ui/toaster', () => ({ toast: toastMock }));

import { TemplateProposalsSection } from './components/TemplateProposalsSection';
import {
  mapProposalDecisionError,
  proposalErrorCode,
  formatProposalEvidence,
} from './templateProposals';
import { queryKeys } from '@/lib/queryKeys';

function apiError(status: number, body: unknown) {
  return new ApiError(status, JSON.stringify(body));
}

function badRequest(code: string) {
  // The real wire shape: AppError.badRequest puts the discriminating code in
  // `details`, and the top-level code is always VALIDATION_ERROR.
  return apiError(400, {
    error: { message: 'Refused', code: 'VALIDATION_ERROR', details: { code } },
  });
}

const OPEN_PROPOSAL: TemplateRevisionProposal = {
  id: 'p1',
  projectId: 'proj-1',
  templateId: 't1',
  checklistItemId: 'ci-1',
  ncrCount: 7,
  subcontractorCount: 3,
  activitySlug: 'earthworks_bulk',
  proposedChange: 'Require a density reading per 300mm layer.',
  status: 'open',
  proposedAt: '2026-07-01T00:00:00.000Z',
  decidedAt: null,
  decisionNote: null,
  template: { id: 't1', name: 'Earthworks ITP', supersededById: null },
  checklistItem: { id: 'ci-1', description: 'Compaction density per layer' },
  resultingTemplate: null,
  proposedBy: { id: 'u1', fullName: 'Dana Reyes', email: 'dana@example.com' },
  decidedBy: null,
};

/** Routes each status-scoped request to its own payload. */
function mockLists(options: {
  open?: TemplateRevisionProposal[];
  openTotal?: number;
  accepted?: TemplateRevisionProposal[];
  rejected?: TemplateRevisionProposal[];
  error?: unknown;
}) {
  apiGetMock.mockImplementation((path: string) => {
    if (options.error) return Promise.reject(options.error);
    if (path.includes('status=open')) {
      const proposals = options.open ?? [];
      return Promise.resolve({ proposals, total: options.openTotal ?? proposals.length });
    }
    if (path.includes('status=accepted')) {
      const proposals = options.accepted ?? [];
      return Promise.resolve({ proposals, total: proposals.length });
    }
    const proposals = options.rejected ?? [];
    return Promise.resolve({ proposals, total: proposals.length });
  });
}

function renderSection(props: Partial<React.ComponentProps<typeof TemplateProposalsSection>> = {}) {
  return renderWithProviders(
    <TemplateProposalsSection
      projectId="proj-1"
      canReview
      onOpenRevision={props.onOpenRevision ?? vi.fn()}
      {...props}
    />,
  );
}

describe('TemplateProposalsSection', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    toastMock.mockReset();
  });

  it('renders nothing when the learning loop is disabled (404)', async () => {
    mockLists({ error: apiError(404, { error: { message: 'Route not found' } }) });
    const { container } = renderSection();

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByText(/could not load/i)).not.toBeInTheDocument();
  });

  it('renders nothing for a viewer without the office role, and never queries', () => {
    mockLists({ open: [OPEN_PROPOSAL] });
    const { container } = renderSection({ canReview: false });

    expect(container).toBeEmptyDOMElement();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it('shows an inline error for a real failure rather than hiding it', async () => {
    mockLists({ error: apiError(500, { error: { message: 'boom' } }) });
    renderSection();

    expect(await screen.findByText(/could not load template change proposals/i)).toBeVisible();
  });

  it('renders an open proposal with its frozen evidence', async () => {
    mockLists({ open: [OPEN_PROPOSAL] });
    renderSection();

    expect(await screen.findByText('Compaction density per layer')).toBeVisible();
    expect(
      screen.getByText(/Earthworks ITP · 7 NCRs across 3 subcontractors — earthworks_bulk/),
    ).toBeVisible();
    expect(screen.getByText(/Raised by Dana Reyes/)).toBeVisible();
  });

  it('marks a superseded target stale and refuses to accept it', async () => {
    mockLists({
      open: [
        { ...OPEN_PROPOSAL, template: { id: 't1', name: 'Earthworks ITP', supersededById: 't2' } },
      ],
    });
    renderSection();

    expect(await screen.findByText(/template already superseded/i)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    // The accept path is closed: neither the mode switch nor the submit can be
    // used, however much the label and summary are filled in.
    expect(await screen.findByRole('button', { name: 'Accept' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/revision label/i), { target: { value: 'B' } });
    expect(screen.getByRole('button', { name: /accept and open revision/i })).toBeDisabled();
    // Rejecting it stays available — that is the way out of a stale proposal.
    expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled();
  });

  it('says how many of the capped list it is showing', async () => {
    mockLists({ open: [OPEN_PROPOSAL], openTotal: 63 });
    renderSection();

    expect(await screen.findByText(/Showing 1 of 63/)).toBeVisible();
  });

  it('posts the accept body and opens the editor on the new revision', async () => {
    mockLists({ open: [OPEN_PROPOSAL] });
    apiPostMock.mockResolvedValue({
      revision: { id: 't2', name: 'Earthworks ITP (B)' },
      proposal: { ...OPEN_PROPOSAL, status: 'accepted' },
    });
    const onOpenRevision = vi.fn();
    renderSection({ onOpenRevision });

    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));

    // The summary is prefilled with the proposal, NOT with the evidence line the
    // server appends itself.
    const summary = screen.getByLabelText(/why this revision is being issued/i);
    expect(summary).toHaveValue('Require a density reading per 300mm layer.');
    expect(summary).not.toHaveValue(expect.stringContaining('raised from'));

    fireEvent.change(screen.getByLabelText(/revision label/i), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: /accept and open revision/i }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith('/api/ncr-learning/proposals/p1/accept', {
        revisionLabel: 'B',
        changeSummary: 'Require a density reading per 300mm layer.',
      }),
    );
    // The accept→edit gap closed in one session: the reviewer lands in the
    // editor on the copy they now have to change.
    await waitFor(() => expect(onOpenRevision).toHaveBeenCalledWith('t2'));
  });

  it('requires a revision label before accepting', async () => {
    mockLists({ open: [OPEN_PROPOSAL] });
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    expect(screen.getByRole('button', { name: /accept and open revision/i })).toBeDisabled();
  });

  it('posts the reject body', async () => {
    mockLists({ open: [OPEN_PROPOSAL] });
    apiPostMock.mockResolvedValue({ proposal: { ...OPEN_PROPOSAL, status: 'rejected' } });
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.change(screen.getByLabelText(/why this proposal is being rejected/i), {
      target: { value: 'Batching issue, not the checklist.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /reject proposal/i }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith('/api/ncr-learning/proposals/p1/reject', {
        decisionNote: 'Batching issue, not the checklist.',
      }),
    );
  });

  it('tells the reviewer someone else decided it, never the raw server message', async () => {
    mockLists({ open: [OPEN_PROPOSAL] });
    apiPostMock.mockRejectedValue(badRequest('PROPOSAL_ALREADY_DECIDED'));
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    fireEvent.change(screen.getByLabelText(/revision label/i), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: /accept and open revision/i }));

    expect(await screen.findByText(/someone else already decided this proposal/i)).toBeVisible();
    expect(screen.queryByText('Refused')).toBeNull();
  });

  it('lists decisions under a heading that does not overclaim', async () => {
    mockLists({
      open: [],
      accepted: [
        {
          ...OPEN_PROPOSAL,
          id: 'p2',
          status: 'accepted',
          decidedAt: '2026-07-05T00:00:00.000Z',
          decidedBy: { id: 'u2', fullName: 'Sam Ng', email: 'sam@example.com' },
          resultingTemplate: { id: 't2', name: 'Earthworks ITP (B)' },
        },
      ],
      rejected: [
        {
          ...OPEN_PROPOSAL,
          id: 'p3',
          status: 'rejected',
          decidedAt: '2026-07-06T00:00:00.000Z',
          decisionNote: 'Batching issue.',
          decidedBy: { id: 'u2', fullName: 'Sam Ng', email: 'sam@example.com' },
        },
      ],
    });
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /show decisions \(2\)/i }));

    expect(await screen.findByText('Became Earthworks ITP (B)')).toBeVisible();
    expect(screen.getByText(/Reason: Batching issue\./)).toBeVisible();
    // These records are not deletion-proof; the copy must not imply otherwise.
    expect(screen.queryByText(/audit trail/i)).toBeNull();
  });

  it('stays hidden when the loop is on but nothing has been raised', async () => {
    mockLists({ open: [], accepted: [], rejected: [] });
    const { container } = renderSection();

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('proposal error mapping', () => {
  it('reads the code from details, where AppError actually puts it', () => {
    expect(proposalErrorCode(badRequest('TEMPLATE_ALREADY_SUPERSEDED'))).toBe(
      'TEMPLATE_ALREADY_SUPERSEDED',
    );
    // The top-level code is VALIDATION_ERROR for every 400 — reading it would
    // make every mapping fall through to generic copy.
    expect(proposalErrorCode(apiError(400, { error: { code: 'VALIDATION_ERROR' } }))).toBeNull();
    expect(proposalErrorCode(new Error('network'))).toBeNull();
  });

  it('maps each server code to copy carrying a next step', () => {
    expect(mapProposalDecisionError(badRequest('PROPOSAL_ALREADY_DECIDED'))).toEqual({
      message: expect.stringMatching(/someone else already decided/i),
      staleList: true,
    });
    expect(mapProposalDecisionError(badRequest('TEMPLATE_ALREADY_SUPERSEDED')).staleList).toBe(
      true,
    );
    expect(mapProposalDecisionError(badRequest('GLOBAL_TEMPLATE_NOT_ISSUABLE')).message).toMatch(
      /clone it into the project first/i,
    );
    // The seeder invocation is an operator concern, not this reviewer's.
    expect(
      mapProposalDecisionError(badRequest('GLOBAL_TEMPLATE_NOT_ISSUABLE')).message,
    ).not.toMatch(/--execute/);
    expect(mapProposalDecisionError(apiError(404, {})).message).toMatch(
      /learning loop was disabled/i,
    );
    expect(mapProposalDecisionError(apiError(500, {})).message).toMatch(/please try again/i);
  });

  it('pluralises the frozen evidence line and drops an unclassified activity', () => {
    expect(formatProposalEvidence(OPEN_PROPOSAL)).toBe(
      '7 NCRs across 3 subcontractors — earthworks_bulk',
    );
    expect(
      formatProposalEvidence({
        ...OPEN_PROPOSAL,
        ncrCount: 1,
        subcontractorCount: 1,
        activitySlug: null,
      }),
    ).toBe('1 NCR across 1 subcontractor');
  });
});

describe('templateRevisionProposals query key', () => {
  it('scopes by status so the open and decided lists cannot collide', () => {
    expect(queryKeys.templateRevisionProposals('proj-1', 'open')).not.toEqual(
      queryKeys.templateRevisionProposals('proj-1', 'accepted'),
    );
    // The unscoped call the propose modal makes stays distinct from any single
    // status, and every variant shares one prefix so a decision invalidates all.
    expect(queryKeys.templateRevisionProposals('proj-1')).toEqual([
      'template-revision-proposals',
      'proj-1',
      'all',
    ]);
    for (const status of ['open', 'accepted', 'rejected', undefined] as const) {
      expect(queryKeys.templateRevisionProposals('proj-1', status).slice(0, 2)).toEqual([
        'template-revision-proposals',
        'proj-1',
      ]);
    }
  });
});
