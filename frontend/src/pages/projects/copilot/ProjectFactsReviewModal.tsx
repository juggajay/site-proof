import { useRef, useState } from 'react';
import { FileText, FileUp, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  useDecideProposal,
  useExtractProjectFacts,
  type CopilotProposal,
  type ProjectFactsCandidate,
  type ProposalSourceRef,
} from './copilotData';

const ACCEPT = '.pdf,.jpg,.jpeg,.png';
const MAX_FILE_MB = 10;

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] as const;

/** Current project values shown alongside each AI-read fact. */
export interface ProjectFactsCurrent {
  projectName: string | null;
  projectNumber: string | null;
  clientName: string | null;
  state: string | null;
}

interface ProjectFactsReviewModalProps {
  projectId: string;
  current: ProjectFactsCurrent;
  /** A live 'proposed' proposal to review directly (skips the upload step). */
  existingProposal?: CopilotProposal | null;
  /** Fired once the proposal is successfully applied (drives the next-step hand-off). */
  onApplied?: () => void;
  onClose: () => void;
}

interface ReviewState {
  proposalId: string;
  candidate: ProjectFactsCandidate;
  warnings: string[];
  sourceRefs: ProposalSourceRef[];
}

const FIELD_ROWS = [
  { key: 'projectName', label: 'Project name' },
  { key: 'projectNumber', label: 'Project number' },
  { key: 'clientName', label: 'Client' },
  { key: 'state', label: 'State' },
] as const;

type FieldKey = (typeof FIELD_ROWS)[number]['key'];

function candidateFromProposal(proposal: CopilotProposal): ReviewState {
  const payload = (proposal.payload ?? {}) as Partial<ProjectFactsCandidate>;
  return {
    proposalId: proposal.id,
    candidate: {
      projectName: payload.projectName ?? null,
      projectNumber: payload.projectNumber ?? null,
      clientName: payload.clientName ?? null,
      state: payload.state ?? null,
      specificationSet: payload.specificationSet ?? '',
    },
    warnings: Array.isArray(proposal.warnings) ? (proposal.warnings as string[]) : [],
    sourceRefs: proposal.sourceRefs ?? [],
  };
}

function initialEdits(candidate: ProjectFactsCandidate): Record<FieldKey, string> {
  return {
    projectName: candidate.projectName ?? '',
    projectNumber: candidate.projectNumber ?? '',
    clientName: candidate.clientName ?? '',
    state: candidate.state ?? '',
  };
}

export function ProjectFactsReviewModal({
  projectId,
  current,
  existingProposal,
  onApplied,
  onClose,
}: ProjectFactsReviewModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewState | null>(() =>
    existingProposal ? candidateFromProposal(existingProposal) : null,
  );
  const [edits, setEdits] = useState<Record<FieldKey, string>>(() =>
    existingProposal
      ? initialEdits(candidateFromProposal(existingProposal).candidate)
      : { projectName: '', projectNumber: '', clientName: '', state: '' },
  );

  const extractMutation = useExtractProjectFacts(projectId);
  const decideMutation = useDecideProposal(projectId);
  const busy = extractMutation.isLoading || decideMutation.isLoading;

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const result = await extractMutation.mutateAsync(file);
      const state: ReviewState = {
        proposalId: result.proposalId,
        candidate: result.candidate,
        warnings: result.warnings,
        sourceRefs: [{ fileName: file.name }],
      };
      setReview(state);
      setEdits(initialEdits(result.candidate));
    } catch (error) {
      logError('Failed to read project facts:', error);
      toast({
        title: 'Could not read that drawing',
        description: extractErrorMessage(error, 'Try another file or enter the facts manually.'),
        variant: 'error',
      });
    }
  };

  const buildEditedPayload = (candidate: ProjectFactsCandidate) => {
    const next = {
      projectName: edits.projectName.trim() || null,
      projectNumber: edits.projectNumber.trim() || null,
      clientName: edits.clientName.trim() || null,
      state: edits.state.trim() || null,
    };
    const unchanged =
      next.projectName === candidate.projectName &&
      next.projectNumber === candidate.projectNumber &&
      next.clientName === candidate.clientName &&
      next.state === candidate.state;
    // Verbatim accept applies the stored candidate (incl. its derived spec set);
    // an edit omits specificationSet so the server re-derives it from the state.
    return unchanged ? undefined : next;
  };

  const handleApply = async () => {
    if (!review) return;
    try {
      await decideMutation.mutateAsync({
        proposalId: review.proposalId,
        action: 'accept',
        editedPayload: buildEditedPayload(review.candidate),
      });
      toast({ title: 'Project facts applied', description: 'The project has been updated.' });
      onApplied?.();
      onClose();
    } catch (error) {
      logError('Failed to apply project facts:', error);
      toast({
        title: 'Could not apply the changes',
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
      logError('Failed to dismiss project facts:', error);
    } finally {
      onClose();
    }
  };

  const nothingToApply =
    review !== null &&
    !edits.projectName.trim() &&
    !edits.projectNumber.trim() &&
    !edits.clientName.trim() &&
    !edits.state.trim();

  return (
    <Modal
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <ModalHeader>Read project facts from a drawing</ModalHeader>
      <ModalDescription>
        Upload a drawing cover sheet (PDF or photo). The title block is read by AI, so check each
        value against the drawing before applying. Files up to {MAX_FILE_MB} MB.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-5">
          {!review && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file && !busy) void handleFile(file);
              }}
              className="rounded-lg border border-dashed p-6 text-center"
            >
              <FileUp className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-2 text-sm text-muted-foreground">Drag a PDF or photo here, or</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = '';
                }}
              />
              {fileName && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {extractMutation.isLoading ? 'Reading ' : ''}
                  <span className="font-medium">{fileName}</span>
                </p>
              )}
            </div>
          )}

          {extractMutation.isLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the title block…
            </div>
          )}

          {review && (
            <>
              <div className="space-y-4">
                {FIELD_ROWS.map((row) => {
                  const aiValue = review.candidate[row.key];
                  const currentValue = current[row.key];
                  return (
                    <div key={row.key}>
                      <Label htmlFor={`fact-${row.key}`} className="mb-1">
                        {row.label}
                      </Label>
                      <p className="mb-1 text-xs text-muted-foreground">
                        Current: <span className="font-medium">{currentValue || '—'}</span>
                        {aiValue && aiValue !== currentValue && (
                          <>
                            {'  ·  '}Read from drawing:{' '}
                            <span className="font-medium text-foreground">{aiValue}</span>
                          </>
                        )}
                      </p>
                      {row.key === 'state' ? (
                        <NativeSelect
                          id={`fact-${row.key}`}
                          value={edits.state}
                          onChange={(e) => setEdits((s) => ({ ...s, state: e.target.value }))}
                        >
                          <option value="">Not set</option>
                          {AU_STATES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Input
                          id={`fact-${row.key}`}
                          type="text"
                          value={edits[row.key]}
                          onChange={(e) => setEdits((s) => ({ ...s, [row.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                The ITP template library is set from the state
                {review.candidate.specificationSet
                  ? ` (currently ${review.candidate.specificationSet}).`
                  : '.'}
              </p>

              {review.warnings.length > 0 && (
                <div
                  role="status"
                  className="rounded-md bg-warning/10 p-3 text-xs text-warning"
                  data-testid="project-facts-warnings"
                >
                  <ul className="list-disc space-y-1 pl-4">
                    {review.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {review.sourceRefs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  {review.sourceRefs.map((ref, i) => (
                    <span key={i}>
                      {ref.fileName ?? 'Uploaded file'}
                      {typeof ref.page === 'number' ? `, page ${ref.page}` : ''}
                      {ref.note ? ` — ${ref.note}` : ''}
                    </span>
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
        {review && (
          <Button
            type="button"
            onClick={() => void handleApply()}
            disabled={busy || nothingToApply}
          >
            {decideMutation.isLoading ? 'Applying…' : 'Apply'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
