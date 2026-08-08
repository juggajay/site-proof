import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { fetchAllLotPages } from '@/lib/lots';
import { queryKeys } from '@/lib/queryKeys';
import { fetchDesignModels } from '@/lib/models/designModelsApi';
import {
  useDecideProposal,
  useExtractModelLotLinking,
  type CopilotProposal,
  type ModelLotLinkingCandidate,
  type ProposalSourceRef,
} from './copilotData';
import {
  buildLinkingEditedPayload,
  linkedCountWithDecisions,
  unlinkedSampleValues,
  type AmbiguousDecisions,
} from './modelLinkingReview';

interface ModelLotLinkingReviewModalProps {
  projectId: string;
  /** A live 'proposed' proposal to review directly (skips the propose step). */
  existingProposal?: CopilotProposal | null;
  /** Preselect this version in the propose step (deep link from the models page). */
  initialVersionId?: string;
  /** Fired once the proposal is successfully applied (drives the next-step hand-off). */
  onApplied?: () => void;
  onClose: () => void;
}

interface ReviewState {
  proposalId: string;
  candidate: ModelLotLinkingCandidate;
  sourceRefs: ProposalSourceRef[];
}

const UNLINKED_SAMPLE_MAX = 8;

function reviewFromProposal(proposal: CopilotProposal): ReviewState {
  return {
    proposalId: proposal.id,
    candidate: proposal.payload as ModelLotLinkingCandidate,
    sourceRefs: proposal.sourceRefs ?? [],
  };
}

export function ModelLotLinkingReviewModal({
  projectId,
  existingProposal,
  initialVersionId,
  onApplied,
  onClose,
}: ModelLotLinkingReviewModalProps) {
  const [versionId, setVersionId] = useState(initialVersionId ?? '');
  const [review, setReview] = useState<ReviewState | null>(() =>
    existingProposal ? reviewFromProposal(existingProposal) : null,
  );
  const [decisions, setDecisions] = useState<AmbiguousDecisions>({});

  const extractMutation = useExtractModelLotLinking(projectId);
  const decideMutation = useDecideProposal(projectId);
  const busy = extractMutation.isLoading || decideMutation.isLoading;

  // The propose step's pickable set: each model's latest READY version.
  const modelsQuery = useQuery({
    queryKey: queryKeys.designModels(projectId),
    queryFn: () => fetchDesignModels(projectId),
    enabled: !review,
  });
  const readyVersions = (modelsQuery.data ?? [])
    .filter((model) => model.latestVersion?.status === 'ready')
    .map((model) => ({
      versionId: model.latestVersion!.id,
      label: `${model.name} — v${model.latestVersion!.versionNumber}`,
    }));
  const selectedVersionId =
    versionId || (readyVersions.length === 1 ? readyVersions[0].versionId : '');

  // Candidate lots are shown by their lot number, not their id. Only fetched
  // while a review with ambiguous rows is open; bounded by the project register.
  const ambiguousCount = review?.candidate.ambiguous.length ?? 0;
  const lotsQuery = useQuery({
    queryKey: queryKeys.modelLinkingLotOptions(projectId),
    queryFn: () =>
      fetchAllLotPages<{ id: string; lotNumber: string; description?: string | null }>(
        `/api/lots?projectId=${encodeURIComponent(projectId)}&sortBy=lotNumber&sortOrder=asc`,
      ),
    enabled: ambiguousCount > 0,
    staleTime: 60_000,
  });
  const lotNumberById = new Map((lotsQuery.data ?? []).map((lot) => [lot.id, lot.lotNumber]));
  const lotLabel = (lotId: string) => lotNumberById.get(lotId) ?? `Lot ${lotId.slice(0, 8)}…`;

  const handlePropose = async () => {
    if (!selectedVersionId) return;
    try {
      const result = await extractMutation.mutateAsync(selectedVersionId);
      setDecisions({});
      setReview({
        proposalId: result.proposalId,
        candidate: result.candidate,
        sourceRefs: [],
      });
    } catch (error) {
      logError('Failed to propose model lot links:', error);
      toast({
        title: 'Could not propose lot links',
        description: extractErrorMessage(error, 'Pick a ready model version and try again.'),
        variant: 'error',
      });
    }
  };

  const handleApply = async () => {
    if (!review) return;
    const editedPayload = buildLinkingEditedPayload(review.candidate, decisions);
    try {
      await decideMutation.mutateAsync({
        proposalId: review.proposalId,
        action: 'accept',
        editedPayload,
      });
      toast({
        title: 'Model linked to lots',
        description: `${editedPayload.links.length} element links approved.`,
      });
      onApplied?.();
      onClose();
    } catch (error) {
      logError('Failed to apply model lot links:', error);
      toast({
        title: 'Could not apply the links',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  const handleDismiss = async () => {
    if (!review) {
      onClose();
      return;
    }
    try {
      await decideMutation.mutateAsync({ proposalId: review.proposalId, action: 'reject' });
      toast({ title: 'Suggestion dismissed' });
    } catch (error) {
      logError('Failed to dismiss model lot links:', error);
    } finally {
      onClose();
    }
  };

  const candidate = review?.candidate;
  const applyCount = candidate ? linkedCountWithDecisions(candidate, decisions) : 0;
  const undecidedCount = candidate
    ? candidate.ambiguous.filter((element) => (decisions[element.elementId] ?? '') === '').length
    : 0;

  return (
    <Modal
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <ModalHeader>Link model elements to lots</ModalHeader>
      <ModalDescription>
        Elements are matched to lots by the lot number on each element. Matches are proposed for
        review — nothing is linked until you apply, and your decisions carry forward to the next
        model version.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-5">
          {!review && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="linking-version">
                Model version
              </label>
              {modelsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading models…</p>
              ) : readyVersions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No ready model versions yet — upload a design model and wait for conversion to
                  finish.
                </p>
              ) : (
                <NativeSelect
                  id="linking-version"
                  value={selectedVersionId}
                  onChange={(e) => setVersionId(e.target.value)}
                >
                  {readyVersions.length > 1 && <option value="">Choose a model…</option>}
                  {readyVersions.map((option) => (
                    <option key={option.versionId} value={option.versionId}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </div>
          )}

          {extractMutation.isLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Matching elements to lots…
            </div>
          )}

          {candidate && (
            <>
              <div className="rounded-md bg-muted/50 p-3 text-sm" data-testid="linking-summary">
                <span className="font-medium">
                  {candidate.counts.linked} of {candidate.counts.elements} elements matched
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  · {candidate.counts.ambiguous} need a decision · {candidate.counts.unlinked}{' '}
                  unmatched
                  {candidate.counts.carriedForward > 0 &&
                    ` · ${candidate.counts.carriedForward} manual links carried forward`}
                </span>
              </div>

              {candidate.orphanedManual.length > 0 && (
                <p className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
                  {candidate.orphanedManual.length} manual link
                  {candidate.orphanedManual.length === 1 ? '' : 's'} from the previous version could
                  not carry forward — those elements no longer exist in this version.
                </p>
              )}

              {candidate.ambiguous.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold">
                    Needs a decision ({candidate.ambiguous.length})
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    These lot numbers match more than one lot. Pick the right lot, or leave the
                    element unlinked.
                  </p>
                  <ul className="mt-2 space-y-2">
                    {candidate.ambiguous.map((element) => (
                      <li
                        key={element.elementId}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1"
                        data-testid="linking-ambiguous-row"
                      >
                        <span className="min-w-24 font-mono text-xs">
                          {element.lotNumberValue ?? element.ifcGuid}
                        </span>
                        <NativeSelect
                          aria-label={`Lot for ${element.lotNumberValue ?? element.ifcGuid}`}
                          className="max-w-56 flex-1"
                          value={decisions[element.elementId] ?? ''}
                          onChange={(e) =>
                            setDecisions((prev) => ({
                              ...prev,
                              [element.elementId]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Leave unlinked</option>
                          {element.candidateLotIds.map((lotId) => (
                            <option key={lotId} value={lotId}>
                              {lotLabel(lotId)}
                            </option>
                          ))}
                        </NativeSelect>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {candidate.counts.unlinked > 0 && (
                <p className="text-xs text-muted-foreground">
                  {candidate.counts.unlinked} element{candidate.counts.unlinked === 1 ? '' : 's'}{' '}
                  had no matching lot number and will stay unlinked
                  {unlinkedSampleValues(candidate, UNLINKED_SAMPLE_MAX).length > 0 && (
                    <> (e.g. {unlinkedSampleValues(candidate, UNLINKED_SAMPLE_MAX).join(', ')})</>
                  )}
                  . Unlinked elements render neutral in 4D playback.
                </p>
              )}

              {review && review.sourceRefs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  {review.sourceRefs.map((ref, i) => (
                    <span key={i}>{ref.note ?? ref.fileName ?? 'Source'}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleDismiss()}
          disabled={busy}
        >
          {review ? 'Dismiss' : 'Cancel'}
        </Button>
        {review ? (
          <Button
            type="button"
            onClick={() => void handleApply()}
            disabled={busy}
            data-testid="linking-apply"
          >
            {decideMutation.isLoading
              ? 'Applying…'
              : `Apply ${applyCount} link${applyCount === 1 ? '' : 's'}${
                  undecidedCount > 0 ? ` (${undecidedCount} left unlinked)` : ''
                }`}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void handlePropose()}
            disabled={busy || !selectedVersionId}
          >
            {extractMutation.isLoading ? 'Working…' : 'Propose links'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
