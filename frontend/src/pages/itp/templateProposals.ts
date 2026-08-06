/**
 * Wave G G5 — data + pure helpers for the template-change proposal review
 * surface on the project ITP Templates page.
 *
 * The NCR Analytics page is where a reviewer RAISES a proposal; this module
 * backs where one is DECIDED. Deciding lives with the templates because
 * accepting opens a new template revision the reviewer must then edit — the
 * page they need to be on next is this one.
 *
 * `/api/ncr-learning` does not exist while NCR_LEARNING_LOOP_ENABLED is unset,
 * so a 404 means "the loop is off" and the whole surface hides. That is the
 * same self-gating G1's revision timeline uses; there is no frontend flag
 * mirror to drift out of sync.
 */
import { useQuery } from '@tanstack/react-query';

import { ApiError, apiGet, apiPost } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { TemplateRevisionProposal } from '@/pages/ncr/analytics/ncrAnalyticsTypes';

export type ProposalStatus = 'open' | 'accepted' | 'rejected';

export interface TemplateProposalsResponse {
  proposals: TemplateRevisionProposal[];
  /** Unbounded count for the same filter; the list itself is capped at 50. */
  total: number;
}

export interface AcceptProposalResponse {
  revision: { id: string; name: string };
  proposal: TemplateRevisionProposal;
}

export const PROPOSAL_PAGE_SIZE = 50;

export function fetchTemplateProposals(projectId: string, status?: ProposalStatus) {
  const query = new URLSearchParams({ projectId });
  if (status) query.set('status', status);
  return apiGet<TemplateProposalsResponse>(`/api/ncr-learning/proposals?${query.toString()}`);
}

export function acceptProposalRequest(
  proposalId: string,
  body: { revisionLabel: string; changeSummary: string },
) {
  return apiPost<AcceptProposalResponse>(
    `/api/ncr-learning/proposals/${encodeURIComponent(proposalId)}/accept`,
    body,
  );
}

export function rejectProposalRequest(proposalId: string, decisionNote: string) {
  return apiPost<{ proposal: TemplateRevisionProposal }>(
    `/api/ncr-learning/proposals/${encodeURIComponent(proposalId)}/reject`,
    { decisionNote },
  );
}

export function useTemplateProposalsQuery(
  projectId: string | undefined,
  status: ProposalStatus | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.templateRevisionProposals(projectId ?? '', status),
    queryFn: () => fetchTemplateProposals(projectId as string, status),
    enabled: Boolean(projectId) && enabled,
    // 404 = loop disabled, 403 = not an office role. Neither improves on retry.
    retry: false,
  });
}

/** True when the error means the learning loop is switched off in this environment. */
export function isLoopDisabledError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * True when the section should render nothing at all rather than an error.
 *
 * 404 is "the loop is off" and 403 is "not an office role" — neither is a fault
 * the viewer can act on, and the ITP Templates page is legitimately reachable by
 * roles that get both. Any OTHER failure is a real one and must be shown.
 */
export function shouldHideProposalsError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 403);
}

/**
 * The server's discriminating error code.
 *
 * NOT `error.code` — `AppError.badRequest(message, { code })` puts the code in
 * `details`, and the top-level `code` is always VALIDATION_ERROR for a 400. A
 * mapper reading the wrong field silently falls through to generic copy for
 * every case, so the lookup lives here once.
 */
export function proposalErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const wrapped = error.data?.error;
  if (!wrapped || typeof wrapped === 'string') return null;
  const code = wrapped.details?.code;
  return typeof code === 'string' ? code : null;
}

/** Whether the list must be refetched because the server's state moved on. */
export interface ProposalErrorCopy {
  message: string;
  staleList: boolean;
}

/**
 * Server error → what the reviewer is told. Never the raw server message: these
 * strings carry a next action, and the accept-time messages mention the ITP
 * seeder, which is an operator concern and not this reviewer's.
 */
export function mapProposalDecisionError(error: unknown): ProposalErrorCopy {
  const code = proposalErrorCode(error);

  if (code === 'PROPOSAL_ALREADY_DECIDED') {
    return {
      message: 'Someone else already decided this proposal. The list has been refreshed.',
      staleList: true,
    };
  }

  if (code === 'TEMPLATE_ALREADY_SUPERSEDED') {
    return {
      message:
        'That template already has a newer revision, so this proposal can no longer be applied to it. Re-raise it against the current revision.',
      staleList: true,
    };
  }

  if (code === 'GLOBAL_TEMPLATE_NOT_ISSUABLE') {
    return {
      message:
        'This is a library template — clone it into the project first, then propose against the copy.',
      staleList: false,
    };
  }

  if (error instanceof ApiError && error.status === 404) {
    return {
      message: 'The learning loop was disabled — refresh the page.',
      staleList: false,
    };
  }

  if (error instanceof ApiError && error.status === 403) {
    return {
      message: 'You no longer have permission to decide template proposals on this project.',
      staleList: false,
    };
  }

  return { message: 'Could not record the decision. Please try again.', staleList: false };
}

/** Display-ready evidence line, e.g. "7 NCRs across 3 subcontractors — earthworks_bulk". */
export function formatProposalEvidence(proposal: TemplateRevisionProposal): string {
  const ncrs = `${proposal.ncrCount} NCR${proposal.ncrCount === 1 ? '' : 's'}`;
  const subs = `${proposal.subcontractorCount} subcontractor${
    proposal.subcontractorCount === 1 ? '' : 's'
  }`;
  const base = `${ncrs} across ${subs}`;
  return proposal.activitySlug ? `${base} — ${proposal.activitySlug}` : base;
}

/** Best available name for whoever raised or decided a proposal. */
export function proposalPersonName(
  person: { fullName: string | null; email: string } | null,
): string {
  return person?.fullName || person?.email || 'Unknown';
}

/**
 * A proposal whose target template already has a successor cannot be accepted:
 * the revision it would open would branch off a superseded parent.
 */
export function isProposalStale(proposal: TemplateRevisionProposal): boolean {
  return Boolean(proposal.template?.supersededById);
}
