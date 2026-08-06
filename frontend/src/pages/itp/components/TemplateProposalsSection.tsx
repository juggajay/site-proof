/**
 * Wave G G5 — the review queue for NCR-driven template change proposals.
 *
 * Lives on the project ITP Templates page rather than the Setup Copilot page:
 * that page reviews a different system (AI setup proposals), and accepting one
 * of these produces a template revision the reviewer must edit here.
 *
 * Visibility: office roles only. The list quotes the failure trend behind a
 * proposal ("7 NCRs across 3 subcontractors"), which is deliberately not shown
 * to field roles — the same rule NCR Analytics follows. The backend gate is the
 * real one; the client gate just avoids mounting a query that would 403.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/ui/toaster';
import type { TemplateRevisionProposal } from '@/pages/ncr/analytics/ncrAnalyticsTypes';

import {
  PROPOSAL_PAGE_SIZE,
  acceptProposalRequest,
  formatProposalEvidence,
  isProposalStale,
  mapProposalDecisionError,
  proposalPersonName,
  rejectProposalRequest,
  shouldHideProposalsError,
  useTemplateProposalsQuery,
} from '../templateProposals';
import { ReviewProposalModal } from './ReviewProposalModal';

interface TemplateProposalsSectionProps {
  projectId: string;
  /** Office-role gate, derived by the page the same way its other gates are. */
  canReview: boolean;
  /**
   * Opens the shipped template editor on the revision an accept just created —
   * the second half of accepting, done in the same sitting.
   */
  onOpenRevision: (templateId: string) => void | Promise<void>;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('en-AU') : '—';
}

export function TemplateProposalsSection({
  projectId,
  canReview,
  onOpenRevision,
}: TemplateProposalsSectionProps) {
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState<TemplateRevisionProposal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [showDecisions, setShowDecisions] = useState(false);

  const openQuery = useTemplateProposalsQuery(projectId, 'open', canReview);
  const acceptedQuery = useTemplateProposalsQuery(projectId, 'accepted', canReview);
  const rejectedQuery = useTemplateProposalsQuery(projectId, 'rejected', canReview);

  // Every variant, so a decision cannot leave one list stale — including the
  // unscoped key the propose modal on NCR Analytics reads.
  const refreshAll = () =>
    queryClient.invalidateQueries({ queryKey: ['template-revision-proposals', projectId] });

  if (!canReview) return null;

  const queries = [openQuery, acceptedQuery, rejectedQuery];
  // 404 (loop off) and 403 (not an office role) collapse the section; anything
  // else is a real failure and is shown rather than swallowed.
  if (queries.some((query) => query.error && shouldHideProposalsError(query.error))) {
    return null;
  }

  const realError = queries.find((query) => query.error)?.error;
  if (realError) {
    return (
      <section
        className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
        role="alert"
      >
        <h2 className="font-semibold text-destructive">Could not load template change proposals</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Try again, or check that you still have access to this project.
        </p>
        <button
          type="button"
          onClick={() => void refreshAll()}
          className="mt-3 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          Try again
        </button>
      </section>
    );
  }

  if (queries.some((query) => query.isLoading)) return null;

  const open = openQuery.data?.proposals ?? [];
  const openTotal = openQuery.data?.total ?? open.length;
  const decided = [
    ...(acceptedQuery.data?.proposals ?? []),
    ...(rejectedQuery.data?.proposals ?? []),
  ];

  // Nothing raised and nothing decided — the loop is on but has produced no
  // work, so the page stays as it was.
  if (open.length === 0 && decided.length === 0) return null;

  const handleAccept = async (body: { revisionLabel: string; changeSummary: string }) => {
    if (!reviewing) return;
    setSubmitting(true);
    setDecisionError(null);
    try {
      const result = await acceptProposalRequest(reviewing.id, body);
      await refreshAll();
      setReviewing(null);
      toast({
        title: 'Revision opened',
        description: `${result.revision.name} is a copy of the current template — edit it to make the change.`,
        variant: 'success',
      });
      await onOpenRevision(result.revision.id);
    } catch (err) {
      const { message, staleList } = mapProposalDecisionError(err);
      setDecisionError(message);
      // Refresh the list behind the modal, but keep the modal OPEN — closing it
      // is what makes "someone else already decided this" invisible, and the
      // reviewer would be left thinking their decision landed.
      if (staleList) await refreshAll();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (decisionNote: string) => {
    if (!reviewing) return;
    setSubmitting(true);
    setDecisionError(null);
    try {
      await rejectProposalRequest(reviewing.id, decisionNote);
      await refreshAll();
      setReviewing(null);
      toast({ title: 'Proposal rejected', description: 'Your reason was recorded with it.' });
    } catch (err) {
      const { message, staleList } = mapProposalDecisionError(err);
      setDecisionError(message);
      // Refresh the list behind the modal, but keep the modal OPEN — closing it
      // is what makes "someone else already decided this" invisible, and the
      // reviewer would be left thinking their decision landed.
      if (staleList) await refreshAll();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg border p-4" aria-label="Template change proposals">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg font-semibold">Template change proposals</h2>
        {open.length > 0 && (
          <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">
            {openTotal}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Raised from repeated NCRs on NCR trends. Accepting one opens a new revision of the template
        for you to edit.
      </p>

      {open.length === 0 ? (
        <p className="text-sm text-muted-foreground">No proposals are waiting for a decision.</p>
      ) : (
        <ul className="divide-y">
          {open.map((proposal) => {
            const stale = isProposalStale(proposal);
            return (
              <li
                key={proposal.id}
                className="py-3 flex flex-wrap items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {proposal.checklistItem?.description ??
                        proposal.template?.name ??
                        'This template'}
                    </span>
                    {stale && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        Template already superseded
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {proposal.template?.name ? `${proposal.template.name} · ` : ''}
                    {formatProposalEvidence(proposal)}
                  </p>
                  <p className="text-sm mt-1">{proposal.proposedChange}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Raised by {proposalPersonName(proposal.proposedBy)} ·{' '}
                    {formatDate(proposal.proposedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDecisionError(null);
                    setReviewing(proposal);
                  }}
                  className="shrink-0 inline-flex items-center rounded border border-primary/40 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  Review
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {openTotal > open.length && (
        <p className="text-xs text-muted-foreground mt-2">
          Showing {open.length} of {openTotal}. The list is capped at {PROPOSAL_PAGE_SIZE}.
        </p>
      )}

      {decided.length > 0 && (
        <div className="mt-4 pt-3 border-t">
          <button
            type="button"
            onClick={() => setShowDecisions((value) => !value)}
            className="text-sm font-medium hover:underline"
            aria-expanded={showDecisions}
          >
            {showDecisions ? 'Hide' : 'Show'} decisions ({decided.length})
          </button>
          {showDecisions && (
            <ul className="mt-2 space-y-2">
              {decided.map((proposal) => (
                <li key={proposal.id} className="rounded border p-2 text-sm">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="font-medium capitalize">{proposal.status}</span>
                    <span className="text-xs text-muted-foreground">
                      {proposalPersonName(proposal.decidedBy)} · {formatDate(proposal.decidedAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">{proposal.proposedChange}</p>
                  {proposal.status === 'accepted' && proposal.resultingTemplate ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Became {proposal.resultingTemplate.name}
                    </p>
                  ) : null}
                  {proposal.status === 'rejected' && proposal.decisionNote ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reason: {proposal.decisionNote}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {reviewing && (
        <ReviewProposalModal
          proposal={reviewing}
          submitting={submitting}
          errorMessage={decisionError}
          onAccept={(body) => void handleAccept(body)}
          onReject={(note) => void handleReject(note)}
          onClose={() => {
            setReviewing(null);
            setDecisionError(null);
          }}
        />
      )}
    </section>
  );
}
