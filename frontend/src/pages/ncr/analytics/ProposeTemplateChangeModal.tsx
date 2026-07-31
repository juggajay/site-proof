/**
 * Wave G G5 — the reviewer's half of the loop
 * (`docs/plans/wave-g-execution-spec-2026-07-31.md` §5.3, AT-G30).
 *
 * A recurring failure is data; what to do about it is a judgement, and this is
 * where a human writes it. Two things this modal deliberately does NOT do:
 *
 *  - It does not send the failure counts. The server recomputes the evidence
 *    from the project's own NCRs and freezes it on the record, so a proposal
 *    cannot claim a trend that was not there.
 *  - It does not edit the template. Accepting a proposal opens a NEW revision
 *    and supersedes the old one; the reviewer then edits the new revision
 *    through the shipped template routes. A lot conformed last month keeps
 *    saying what it was inspected against.
 *
 * Self-gating: `/api/ncr-learning` 404s while NCR_LEARNING_LOOP_ENABLED is
 * unset, and the modal says so rather than failing at submit time — the same
 * pattern G1's revision timeline uses, so there is no frontend flag mirror.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, apiGet, apiPost } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';

import type { RecurringChecklistItem, TemplateRevisionProposal } from './ncrAnalyticsTypes';

interface ProposeTemplateChangeModalProps {
  projectId: string;
  item: RecurringChecklistItem;
  onClose: () => void;
}

function proposalMatchesItem(proposal: TemplateRevisionProposal, item: RecurringChecklistItem) {
  return Boolean(
    proposal.checklistItemId && item.checklistItemIds.includes(proposal.checklistItemId),
  );
}

export function ProposeTemplateChangeModal({
  projectId,
  item,
  onClose,
}: ProposeTemplateChangeModalProps) {
  const queryClient = useQueryClient();
  const [proposedChange, setProposedChange] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const queryKey = queryKeys.templateRevisionProposals(projectId);

  const proposalsQuery = useQuery({
    queryKey,
    queryFn: () =>
      apiGet<{ proposals: TemplateRevisionProposal[] }>(
        `/api/ncr-learning/proposals?projectId=${encodeURIComponent(projectId)}`,
      ),
    retry: false,
  });

  const loopDisabled =
    proposalsQuery.error instanceof ApiError && proposalsQuery.error.status === 404;

  const createProposal = useMutation({
    mutationFn: () =>
      apiPost<{ proposal: TemplateRevisionProposal }>('/api/ncr-learning/proposals', {
        projectId,
        // The project-local id, not the resolved root: the root may live in the
        // global library, and a proposal is always raised against a record this
        // project can actually revise.
        checklistItemId: item.checklistItemIds[0] ?? item.rootChecklistItemId,
        proposedChange,
      }),
    onSuccess: () => {
      setSubmitError(null);
      setProposedChange('');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      setSubmitError(
        error instanceof ApiError
          ? 'Could not record the proposal. Check you still manage templates on this project.'
          : 'Could not record the proposal.',
      );
    },
  });

  const existing = (proposalsQuery.data?.proposals ?? []).filter((proposal) =>
    proposalMatchesItem(proposal, item),
  );

  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <ModalHeader>Propose a template change</ModalHeader>
      <ModalBody>
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">{item.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {item.templateName ? `${item.templateName} · ` : ''}
            failed {item.ncrCount} times across {item.subcontractorCount} subcontractor
            {item.subcontractorCount === 1 ? '' : 's'}
          </p>
        </div>

        {loopDisabled ? (
          <p className="text-sm text-muted-foreground mt-4">
            Template-revision proposals are not enabled in this environment.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mt-4">
              Accepting a proposal opens a <strong>new revision</strong> of the template. It never
              edits the current one, so lots already inspected keep the version they were inspected
              against.
            </p>

            <label className="block text-sm font-medium mt-4" htmlFor="proposed-change">
              What should change?
            </label>
            <Textarea
              id="proposed-change"
              className="mt-1"
              rows={4}
              value={proposedChange}
              onChange={(event) => setProposedChange(event.target.value)}
              placeholder="e.g. Require a nuclear density gauge reading per 300mm layer, not per lot."
            />

            {submitError ? <p className="text-destructive text-sm mt-2">{submitError}</p> : null}

            {existing.length > 0 ? (
              <div className="mt-4">
                <p className="text-sm font-medium">Already proposed for this item</p>
                <ul className="mt-2 space-y-2">
                  {existing.map((proposal) => (
                    <li key={proposal.id} className="rounded-lg border p-2 text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="capitalize">{proposal.status}</span>
                        <span className="text-xs text-muted-foreground">
                          {proposal.ncrCount} NCRs at the time
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1">{proposal.proposedChange}</p>
                      {proposal.resultingTemplate ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Became {proposal.resultingTemplate.name}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        {!loopDisabled && (
          <Button
            disabled={proposedChange.trim().length === 0 || createProposal.isPending}
            onClick={() => createProposal.mutate()}
          >
            {createProposal.isPending ? 'Recording…' : 'Record proposal'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
