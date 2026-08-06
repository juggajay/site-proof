/**
 * Wave G G5 — deciding one template-change proposal.
 *
 * The honesty this modal is built around: accepting does NOT make the change.
 * It opens a new revision that is an exact copy of the current template, and
 * the reviewer still has to edit it. Saying otherwise would leave someone
 * believing a checklist now demands something it does not. So the copy states
 * it plainly, and on success the page opens the template editor on the new
 * revision immediately — the edit is the second half of one action, not a
 * follow-up nobody remembers to do.
 *
 * The frozen evidence sits beside the form read-only. It is what the trend
 * looked like when the proposal was raised, not a live recount, and the
 * reviewer is judging that proposal against that evidence.
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import type { TemplateRevisionProposal } from '@/pages/ncr/analytics/ncrAnalyticsTypes';

import { formatProposalEvidence, isProposalStale, proposalPersonName } from '../templateProposals';

interface ReviewProposalModalProps {
  proposal: TemplateRevisionProposal;
  submitting: boolean;
  errorMessage: string | null;
  onAccept: (body: { revisionLabel: string; changeSummary: string }) => void;
  onReject: (decisionNote: string) => void;
  onClose: () => void;
}

export function ReviewProposalModal({
  proposal,
  submitting,
  errorMessage,
  onAccept,
  onReject,
  onClose,
}: ReviewProposalModalProps) {
  const [mode, setMode] = useState<'accept' | 'reject'>('accept');
  const [revisionLabel, setRevisionLabel] = useState('');
  // Prefilled with what the proposer asked for, because that is what the
  // reviewer is agreeing to. NOT prefilled with the evidence citation — the
  // server appends "(raised from N NCR(s)...)" itself, and duplicating it here
  // would print it twice on the revision record.
  const [changeSummary, setChangeSummary] = useState(proposal.proposedChange);
  const [decisionNote, setDecisionNote] = useState('');

  const stale = isProposalStale(proposal);
  const canAccept = revisionLabel.trim().length > 0 && changeSummary.trim().length > 0 && !stale;

  return (
    <Modal onClose={onClose} className="max-w-3xl">
      <ModalHeader>Review template change proposal</ModalHeader>
      <ModalBody>
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">
            {proposal.checklistItem?.description ?? proposal.template?.name ?? 'This template'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {proposal.template?.name ? `${proposal.template.name} · ` : ''}
            {formatProposalEvidence(proposal)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Raised by {proposalPersonName(proposal.proposedBy)} on{' '}
            {new Date(proposal.proposedAt).toLocaleDateString('en-AU')}
          </p>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 mt-3">
          <p className="text-xs font-medium text-muted-foreground">Proposed change</p>
          <p className="text-sm mt-1 whitespace-pre-wrap">{proposal.proposedChange}</p>
        </div>

        {stale ? (
          <p className="text-sm text-destructive mt-3" role="alert">
            This template has already been superseded, so a revision can no longer be opened from
            it. Re-raise the proposal against the current revision, or reject this one.
          </p>
        ) : null}

        <div className="flex gap-2 mt-4" role="group" aria-label="Decision">
          <Button
            type="button"
            variant={mode === 'accept' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('accept')}
            disabled={stale}
          >
            Accept
          </Button>
          <Button
            type="button"
            variant={mode === 'reject' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('reject')}
          >
            Reject
          </Button>
        </div>

        {mode === 'accept' ? (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              Accepting opens a <strong>new revision that is an exact copy</strong> of this template
              and supersedes the current one. It does not make the change — the template editor
              opens on the new revision next so you can make it. Lots already inspected keep the
              version they were inspected against.
            </p>

            <label className="block text-sm font-medium mt-4" htmlFor="revision-label">
              Revision label <span className="text-destructive">*</span>
            </label>
            <input
              id="revision-label"
              type="text"
              value={revisionLabel}
              onChange={(event) => setRevisionLabel(event.target.value)}
              maxLength={80}
              placeholder="B"
              className="mt-1 w-full max-w-xs px-3 py-2 border border-border bg-background text-foreground rounded-lg"
            />
            <p className="text-xs text-muted-foreground mt-1">
              A short token — it reads as &ldquo;Rev {revisionLabel.trim() || 'B'}&rdquo; wherever
              this revision is cited.
            </p>

            <label className="block text-sm font-medium mt-4" htmlFor="change-summary">
              Why this revision is being issued <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="change-summary"
              className="mt-1"
              rows={4}
              maxLength={5000}
              value={changeSummary}
              onChange={(event) => setChangeSummary(event.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Recorded on the revision. The failure counts above are appended automatically.
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <label className="block text-sm font-medium" htmlFor="decision-note">
              Why this proposal is being rejected <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="decision-note"
              className="mt-1"
              rows={4}
              maxLength={1000}
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
              placeholder="e.g. The failures trace to a batching issue, not the checklist requirement."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Kept with the proposal so the next person to see this trend knows it was considered.
            </p>
          </div>
        )}

        {errorMessage ? (
          <p className="text-destructive text-sm mt-3" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        {mode === 'accept' ? (
          <Button
            disabled={!canAccept || submitting}
            onClick={() =>
              onAccept({
                revisionLabel: revisionLabel.trim(),
                changeSummary: changeSummary.trim(),
              })
            }
          >
            {submitting ? 'Opening revision…' : 'Accept and open revision'}
          </Button>
        ) : (
          <Button
            variant="destructive"
            disabled={decisionNote.trim().length === 0 || submitting}
            onClick={() => onReject(decisionNote.trim())}
          >
            {submitting ? 'Recording…' : 'Reject proposal'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
