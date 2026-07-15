import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { FileText, FileUp, Loader2 } from 'lucide-react';

import { apiFetch } from '@/lib/api';
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
import { queryKeys } from '@/lib/queryKeys';
import { BulkActivityRows, type ItpTemplateOption } from '@/components/lots/BulkActivityRows';
import {
  buildBulkLotPreview,
  controlLineChainageExtent,
  parseChainageInput,
  validateBulkLotRange,
  validateRangeAgainstControlLine,
  type BulkActivity,
} from '@/components/lots/bulkCreateLots';
import { useQueryClient } from '@tanstack/react-query';
import type { ControlLine } from '../settings/controlLinesData';
import {
  useDecideProposal,
  useExtractLotBreakdown,
  type CopilotProposal,
  type LotBreakdownCandidate,
  type ProposalSourceRef,
} from './copilotData';

const ACCEPT = '.pdf,.jpg,.jpeg,.png';
const MAX_FILE_MB = 10;
const DESCRIPTION_TEMPLATE = '{prefix}-{start}-{end}';

interface LotBreakdownReviewModalProps {
  projectId: string;
  controlLines: ControlLine[];
  /** A live 'proposed' proposal to review directly (skips the propose step). */
  existingProposal?: CopilotProposal | null;
  /** Fired once the proposal is successfully applied (drives the next-step hand-off). */
  onApplied?: () => void;
  onClose: () => void;
}

interface ReviewState {
  proposalId: string;
  controlLineId: string;
  startChainage: string;
  endChainage: string;
  interval: string;
  lotPrefix: string;
  offsetLeft: string;
  offsetRight: string;
  activities: BulkActivity[];
  warnings: string[];
  sourceRefs: ProposalSourceRef[];
}

function reviewFromCandidate(
  proposalId: string,
  candidate: LotBreakdownCandidate,
  warnings: string[],
  sourceRefs: ProposalSourceRef[],
): ReviewState {
  return {
    proposalId,
    controlLineId: candidate.controlLineId,
    startChainage: String(candidate.startChainage),
    endChainage: String(candidate.endChainage),
    interval: String(candidate.interval),
    lotPrefix: candidate.lotPrefix,
    offsetLeft: String(candidate.offsetLeft),
    offsetRight: String(candidate.offsetRight),
    activities: candidate.activities.map((a) => ({
      activityType: a.activityType,
      itpTemplateId: a.itpTemplateId ?? '',
    })),
    warnings,
    sourceRefs,
  };
}

// One labelled text field — the review grid is six of these.
function Field({
  label,
  value,
  onChange,
  numeric = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type="text"
        inputMode={numeric ? 'decimal' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
    </div>
  );
}

// The pre-extraction step: pick a control line and optionally attach a sheet.
function ProposePanel({
  controlLines,
  controlLineId,
  setControlLineId,
  file,
  setFile,
  fileInputRef,
  busy,
}: {
  controlLines: ControlLine[];
  controlLineId: string;
  setControlLineId: (id: string) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Control line</label>
        {controlLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No control lines yet — import one in the Control line stage first.
          </p>
        ) : (
          <NativeSelect value={controlLineId} onChange={(e) => setControlLineId(e.target.value)}>
            {controlLines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = e.dataTransfer.files?.[0];
          if (dropped && !busy) setFile(dropped);
        }}
        className="rounded-lg border border-dashed p-5 text-center"
      >
        <FileUp className="mx-auto h-7 w-7 text-muted-foreground/60" />
        <p className="mt-2 text-xs text-muted-foreground">
          Optional: drag a typical-sections / pavement sheet here, or
        </p>
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
            const chosen = e.target.files?.[0];
            if (chosen) setFile(chosen);
            e.target.value = '';
          }}
        />
        {file && (
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium">{file.name}</span> — up to {MAX_FILE_MB} MB
          </p>
        )}
      </div>
    </div>
  );
}

// The editable review: chainage/interval/offset grid + activity rows + notices.
function ReviewFields({
  review,
  patch,
  itpTemplates,
  intervalCount,
  errorText,
}: {
  review: ReviewState;
  patch: (p: Partial<ReviewState>) => void;
  itpTemplates: ItpTemplateOption[];
  intervalCount: number;
  errorText: string | null;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field
          label="Start chainage"
          value={review.startChainage}
          onChange={(v) => patch({ startChainage: v })}
        />
        <Field
          label="End chainage"
          value={review.endChainage}
          onChange={(v) => patch({ endChainage: v })}
        />
        <Field
          label="Interval (m)"
          value={review.interval}
          onChange={(v) => patch({ interval: v })}
        />
        <Field
          label="Lot prefix"
          value={review.lotPrefix}
          onChange={(v) => patch({ lotPrefix: v })}
          numeric={false}
        />
        <Field
          label="Offset left (m)"
          value={review.offsetLeft}
          onChange={(v) => patch({ offsetLeft: v })}
        />
        <Field
          label="Offset right (m)"
          value={review.offsetRight}
          onChange={(v) => patch({ offsetRight: v })}
        />
      </div>

      <BulkActivityRows
        activities={review.activities}
        onChange={(activities) => patch({ activities })}
        itpTemplates={itpTemplates}
        intervalCount={intervalCount}
      />

      {errorText && <p className="text-sm text-destructive">{errorText}</p>}

      {review.warnings.length > 0 && (
        <ul className="space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          {review.warnings.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      )}

      {review.sourceRefs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          {review.sourceRefs.map((ref, i) => (
            <span key={i}>{ref.fileName ?? ref.note ?? 'Source'}</span>
          ))}
        </div>
      )}
    </>
  );
}

// Load active ITP templates for the per-activity picker (optional sugar).
function useItpTemplateOptions(projectId: string): ItpTemplateOption[] {
  const [itpTemplates, setItpTemplates] = useState<ItpTemplateOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ templates: ItpTemplateOption[] }>(
      `/api/itp/templates?projectId=${encodeURIComponent(projectId)}&includeGlobal=true&activeOnly=true`,
    )
      .then((data) => {
        if (!cancelled) setItpTemplates((data.templates || []).filter((t) => t.isActive !== false));
      })
      .catch(() => {
        /* template list is optional */
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  return itpTemplates;
}

export function LotBreakdownReviewModal({
  projectId,
  controlLines,
  existingProposal,
  onApplied,
  onClose,
}: LotBreakdownReviewModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [controlLineId, setControlLineId] = useState(controlLines[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [review, setReview] = useState<ReviewState | null>(() =>
    existingProposal
      ? reviewFromCandidate(
          existingProposal.id,
          existingProposal.payload as LotBreakdownCandidate,
          Array.isArray(existingProposal.warnings) ? (existingProposal.warnings as string[]) : [],
          existingProposal.sourceRefs ?? [],
        )
      : null,
  );

  const extractMutation = useExtractLotBreakdown(projectId);
  const decideMutation = useDecideProposal(projectId);
  const queryClient = useQueryClient();
  const busy = extractMutation.isLoading || decideMutation.isLoading;
  const itpTemplates = useItpTemplateOptions(projectId);

  const patch = (p: Partial<ReviewState>) => setReview((prev) => (prev ? { ...prev, ...p } : prev));

  const handlePropose = async () => {
    if (!controlLineId) return;
    try {
      const result = await extractMutation.mutateAsync({ controlLineId, file });
      setReview(
        reviewFromCandidate(result.proposalId, result.candidate, result.warnings, [
          { note: 'From control line' },
          ...(file ? [{ fileName: file.name, note: 'Read for activities' }] : []),
        ]),
      );
    } catch (error) {
      logError('Failed to propose lot breakdown:', error);
      toast({
        title: 'Could not propose a breakdown',
        description: extractErrorMessage(error, 'Pick a control line and try again.'),
        variant: 'error',
      });
    }
  };

  // Live count + validation, mirroring the bulk wizard exactly.
  const selectedLine = useMemo(
    () => controlLines.find((l) => l.id === review?.controlLineId) ?? null,
    [controlLines, review?.controlLineId],
  );
  const start = parseChainageInput(review?.startChainage ?? '');
  const end = parseChainageInput(review?.endChainage ?? '');
  const interval = parseChainageInput(review?.interval ?? '');
  const activityCount = review?.activities.length ?? 0;
  const rangeValidation = validateBulkLotRange(start, end, interval, activityCount);
  const intervalCount =
    start !== null && end !== null && interval !== null && interval > 0 && end > start
      ? Math.ceil((end - start) / interval)
      : 0;

  const extentError = useMemo(() => {
    if (!review || !selectedLine || start === null || end === null) return null;
    const extent = controlLineChainageExtent(selectedLine.points);
    if (!extent) return `${selectedLine.name} has no usable chainage extent.`;
    return validateRangeAgainstControlLine(start, end, extent, selectedLine.name);
  }, [review, selectedLine, start, end]);

  const prefixValid = (review?.lotPrefix.trim().length ?? 0) > 0;
  const canApply =
    !!review &&
    rangeValidation.lotCount !== null &&
    rangeValidation.lotCount > 0 &&
    !rangeValidation.error &&
    !extentError &&
    prefixValid;

  const handleApply = async () => {
    if (!review || !canApply || start === null || end === null || interval === null) return;
    const { lots, error } = buildBulkLotPreview({
      start,
      end,
      interval,
      lotPrefix: review.lotPrefix.trim(),
      descriptionTemplate: DESCRIPTION_TEMPLATE,
      activities: review.activities,
      layer: '',
    });
    if (error) {
      toast({ title: 'Cannot build the lot list', description: error, variant: 'error' });
      return;
    }

    const offsetLeft = parseChainageInput(review.offsetLeft) ?? 0;
    const offsetRight = parseChainageInput(review.offsetRight) ?? 0;
    try {
      // buildBulkLotPreview (the wizard's generator) is the single source of truth
      // for naming/cross-product; the server re-validates these concrete lots with
      // the same schema POST /bulk uses before creating them.
      await decideMutation.mutateAsync({
        proposalId: review.proposalId,
        action: 'accept',
        editedPayload: {
          geometry: { controlLineId: review.controlLineId, offsetLeft, offsetRight },
          lots: lots.map((lot) => ({
            lotNumber: lot.lotNumber,
            description: lot.description,
            chainageStart: lot.chainageStart,
            chainageEnd: lot.chainageEnd,
            activityType: lot.activityType,
            lotType: 'chainage',
            ...(lot.itpTemplateId ? { itpTemplateId: lot.itpTemplateId } : {}),
          })),
        },
      });
      void queryClient.invalidateQueries(queryKeys.projectLotGeometries(projectId));
      toast({ title: 'Lots created', description: `${lots.length} lots added to the register.` });
      onApplied?.();
      onClose();
    } catch (error) {
      logError('Failed to create lots from breakdown:', error);
      toast({
        title: 'Could not create the lots',
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
      logError('Failed to dismiss breakdown:', error);
    } finally {
      onClose();
    }
  };

  const lotCountLabel = rangeValidation.lotCount ?? intervalCount * activityCount;

  return (
    <Modal
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <ModalHeader>Break the alignment into lots</ModalHeader>
      <ModalDescription>
        Pick a control line to generate thin lots along. Optionally attach a typical-sections or
        pavement sheet and AI will suggest the activities. Nothing is created until you apply.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-5">
          {!review && (
            <ProposePanel
              controlLines={controlLines}
              controlLineId={controlLineId}
              setControlLineId={setControlLineId}
              file={file}
              setFile={setFile}
              fileInputRef={fileInputRef}
              busy={busy}
            />
          )}

          {extractMutation.isLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {file ? 'Reading the sheet…' : 'Building a breakdown…'}
            </div>
          )}

          {review && (
            <ReviewFields
              review={review}
              patch={patch}
              itpTemplates={itpTemplates}
              intervalCount={intervalCount}
              errorText={rangeValidation.error ?? extentError}
            />
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
          <Button type="button" onClick={() => void handleApply()} disabled={busy || !canApply}>
            {decideMutation.isLoading ? 'Creating…' : `Create ${lotCountLabel} lots`}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void handlePropose()}
            disabled={busy || !controlLineId}
          >
            {extractMutation.isLoading ? 'Working…' : 'Propose lots'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
