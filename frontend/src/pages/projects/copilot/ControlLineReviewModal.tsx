import { useRef, useState } from 'react';
import { FileText, FileUp, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
  COORDINATE_SYSTEM_OPTIONS,
  DEFAULT_COORDINATE_SYSTEM,
} from '@/lib/spatial/coordinateSystems';
import { AlignmentReviewList, type AlignmentReviewRow } from '../settings/AlignmentReviewList';
import type { SetoutExtractionCandidate } from '../settings/controlLinesData';
import {
  useDecideProposal,
  useExtractControlLine,
  type CopilotProposal,
  type ProposalSourceRef,
} from './copilotData';

const ACCEPT = '.pdf,.jpg,.jpeg,.png';
const MAX_FILE_MB = 10;

const SUPPORTED_CRS = new Set(COORDINATE_SYSTEM_OPTIONS.map((o) => o.value));

interface ControlLineReviewModalProps {
  projectId: string;
  /** Zone to fall back to when the AI cannot read one (usually the project's). */
  defaultCoordinateSystem?: string;
  /** A live 'proposed' proposal to review directly (skips the upload step). */
  existingProposal?: CopilotProposal | null;
  /** Fired once the proposal is successfully applied (drives the next-step hand-off). */
  onApplied?: () => void;
  onClose: () => void;
}

interface ReviewState {
  proposalId: string;
  rows: AlignmentReviewRow[];
  documentWarnings: string[];
  sourceRefs: ProposalSourceRef[];
}

// "MC01 setout.pdf" → "MC01 setout"; a sensible default control-line name stem.
function fileStem(name: string): string {
  return name.replace(/\.[^./\\]+$/, '').trim();
}

// Build editable review rows from an extracted candidate — same name/zone
// defaulting as the settings SetoutImportModal so the two flows feel identical.
function rowsFromCandidate(
  candidate: SetoutExtractionCandidate,
  stem: string,
  defaultCoordinateSystem: string | undefined,
): AlignmentReviewRow[] {
  const multi = candidate.alignments.length > 1;
  return candidate.alignments.map((alignment, i) => ({
    name: alignment.name?.trim() || (multi ? `${stem} – ${i + 1}` : stem),
    // The AI's zone wins only if it maps to a zone we support; otherwise keep the
    // project's existing zone so the user starts from a sane default.
    coordinateSystem:
      alignment.coordinateSystem && SUPPORTED_CRS.has(alignment.coordinateSystem)
        ? alignment.coordinateSystem
        : (defaultCoordinateSystem ?? DEFAULT_COORDINATE_SYSTEM),
    points: alignment.points,
    warnings: alignment.warnings,
    page: alignment.page ?? null,
    checked: true,
    status: 'idle',
  }));
}

function reviewFromProposal(
  proposal: CopilotProposal,
  defaultCoordinateSystem: string | undefined,
): ReviewState {
  const payload = (proposal.payload ?? {
    alignments: [],
    warnings: [],
  }) as SetoutExtractionCandidate;
  const stem = fileStem(proposal.sourceRefs?.[0]?.fileName ?? 'Control line');
  return {
    proposalId: proposal.id,
    rows: rowsFromCandidate(payload, stem, defaultCoordinateSystem),
    documentWarnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    sourceRefs: proposal.sourceRefs ?? [],
  };
}

export function ControlLineReviewModal({
  projectId,
  defaultCoordinateSystem,
  existingProposal,
  onApplied,
  onClose,
}: ControlLineReviewModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewState | null>(() =>
    existingProposal ? reviewFromProposal(existingProposal, defaultCoordinateSystem) : null,
  );

  const extractMutation = useExtractControlLine(projectId);
  const decideMutation = useDecideProposal(projectId);
  const busy = extractMutation.isLoading || decideMutation.isLoading;

  const updateRow = (index: number, patch: Partial<AlignmentReviewRow>) =>
    setReview((prev) =>
      prev
        ? { ...prev, rows: prev.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)) }
        : prev,
    );

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setReview(null);
    try {
      const result = await extractMutation.mutateAsync(file);
      setReview({
        proposalId: result.proposalId,
        rows: rowsFromCandidate(result.candidate, fileStem(file.name), defaultCoordinateSystem),
        documentWarnings: result.candidate.warnings,
        sourceRefs: [{ fileName: file.name, note: 'Read from setout sheet' }],
      });
    } catch (error) {
      logError('Failed to read setout sheet:', error);
      toast({
        title: 'Could not read that setout sheet',
        description: extractErrorMessage(error, 'Try another file or enter the points manually.'),
        variant: 'error',
      });
    }
  };

  const checkedRows = review?.rows.filter((row) => row.checked) ?? [];
  const canSave = checkedRows.length > 0 && checkedRows.every((row) => row.name.trim() !== '');

  const handleApply = async () => {
    if (!review || !canSave) return;
    try {
      // The review always carries edits (names are UI-defaulted from the AI's or
      // the file stem), so always send an editedPayload rather than a verbatim
      // accept. Unchecked rows go through with selected:false; the apply handler
      // creates only the selected ones.
      await decideMutation.mutateAsync({
        proposalId: review.proposalId,
        action: 'accept',
        editedPayload: {
          alignments: review.rows.map((row) => ({
            name: row.name.trim(),
            coordinateSystem: row.coordinateSystem,
            points: row.points,
            selected: row.checked,
          })),
        },
      });
      const single = checkedRows.length === 1;
      toast({
        title: single ? 'Control line created' : 'Control lines created',
        description: single
          ? `${checkedRows[0].name.trim()} has been added.`
          : `${checkedRows.length} control lines added.`,
      });
      onApplied?.();
      onClose();
    } catch (error) {
      logError('Failed to apply control lines:', error);
      toast({
        title: 'Could not create the control lines',
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
      logError('Failed to dismiss control lines:', error);
    } finally {
      onClose();
    }
  };

  const isMulti = (review?.rows.length ?? 0) > 1;
  const saveLabel = decideMutation.isLoading
    ? 'Saving…'
    : isMulti
      ? `Save ${checkedRows.length} control line${checkedRows.length === 1 ? '' : 's'}`
      : 'Save control line';

  return (
    <Modal
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <ModalHeader>Read control line from a setout sheet</ModalHeader>
      <ModalDescription>
        Upload a Geometric Setout Details sheet (PDF or photo). The coordinate table is read by AI,
        so check the points against the drawing before applying. Files up to {MAX_FILE_MB} MB.
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
              Reading the setout sheet…
            </div>
          )}

          {review && (
            <>
              <AlignmentReviewList
                rows={review.rows}
                documentWarnings={review.documentWarnings}
                onUpdateRow={updateRow}
                busy={busy}
                testIdPrefix="control-line"
              />

              {review.sourceRefs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  {review.sourceRefs.map((ref, i) => (
                    <span key={i}>
                      {ref.fileName ?? 'Uploaded file'}
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
          <Button type="button" onClick={() => void handleApply()} disabled={busy || !canSave}>
            {saveLabel}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
