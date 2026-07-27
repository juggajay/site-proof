import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, FileUp, Loader2 } from 'lucide-react';

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
import { activitiesByFamily } from '@/lib/activityTaxonomy';
import { useDecideProposal } from './copilotData';
import { ImportPanel } from './ImportPanel';
import {
  reconciliationCsvPath,
  useCancelImport,
  useImportBatch,
  useImportDryRun,
  useImportProfiles,
  useSendImportToReview,
  useUploadImport,
  type DryRunResult,
  type DryRunRow,
  type ImportBatchSummary,
  type ImportKind,
  type ParsedSheet,
  type Resolutions,
} from './importData';

const ACCEPT = '.xlsx';
const MAX_FILE_MB = 25;

/** The only copy that differs between one migration and another. */
const KIND_COPY: Record<
  ImportKind,
  { title: string; blurb: string; defaultProfile: string; noun: string; nounPlural: string }
> = {
  itp_template: {
    title: 'Import ITPs from a spreadsheet',
    blurb: 'Every ITP is shown beside the sheet it came from',
    defaultProfile: 'generic_au_itp_excel',
    noun: 'ITP',
    nounPlural: 'ITPs',
  },
  lot_register: {
    title: 'Import lots from a register',
    blurb: 'Every lot is shown beside the register it came from',
    defaultProfile: 'generic_au_lot_register_excel',
    noun: 'lot',
    nounPlural: 'lots',
  },
};

interface ImportReviewModalProps {
  projectId: string;
  kind: ImportKind;
  /** Resume an open batch instead of starting from the upload step. */
  batchId?: string | null;
  /** Earlier batches of this kind, offered on the upload step so a contractor
   *  can resume or roll one back. Omitted where a rail already lists them. */
  batches?: ImportBatchSummary[];
  onRollback?: (proposalId: string) => void;
  onApplied?: () => void;
  onClose: () => void;
}

const OUTCOME_LABEL: Record<DryRunRow['outcome'], string> = {
  create: 'Will import',
  update: 'Will update',
  skip: 'Skipped',
  needs_review: 'Needs a look',
  blocked: 'Must be fixed',
};

const OUTCOME_CHIP: Record<DryRunRow['outcome'], string> = {
  create: 'bg-success/10 text-success',
  update: 'bg-primary/10 text-primary',
  skip: 'bg-muted text-muted-foreground',
  needs_review: 'bg-warning/10 text-warning',
  blocked: 'bg-destructive/10 text-destructive',
};

const REASON_TEXT: Record<string, string> = {
  duplicate: 'Already in this project',
  slug_collision: 'Another row in this file has the same identity',
  unmapped_column: 'A column this import needs is not mapped',
  ambiguous_activity: 'The activity is only recognised at family level',
  unresolvable_activity: 'The activity is not recognised — pick one or skip it',
  over_length: 'A cell is longer than this field allows',
  state_spec_conflict: 'Declares a different specification set to this project',
  milestone_point_type: 'A milestone row needs a point type before it can import',
  invalid_value: 'A cell cannot be read as the value it needs to be',
  unsupported_attribute: 'A value is outside this project specification',
  template_not_found: 'The named ITP is not in this project',
  low_confidence: 'Read with low confidence',
  empty: 'Nothing to import from this row',
};

function rowDetail(row: DryRunRow): string {
  // The server's own wording, where a reason code alone cannot say enough.
  if (row.detail) return row.detail;
  if (row.overLength) {
    return `${row.overLength.field} is ${row.overLength.length} characters (max ${row.overLength.max}). Shorten it in the spreadsheet, or skip the row.`;
  }
  if (row.collidesWith?.length) {
    return `Also at ${row.collidesWith.map((ref) => `${ref.sheet} row ${ref.rowIndex}`).join(', ')}.`;
  }
  if (row.reason === 'state_spec_conflict') {
    return `This ITP declares ${row.declaredStateSpec}; this project uses a different specification set.`;
  }
  return REASON_TEXT[row.reason ?? ''] ?? '';
}

function CountsBar({ counts }: { counts: DryRunResult['counts'] }) {
  const parts = [
    { label: 'import', value: counts.willCreate },
    { label: 'skip', value: counts.willSkip },
    { label: 'need a look', value: counts.needsReview },
    { label: 'must be fixed', value: counts.blocked },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
      {parts.map((part) => (
        <span key={part.label}>
          <span className="font-semibold">{part.value}</span>{' '}
          <span className="text-muted-foreground">{part.label}</span>
        </span>
      ))}
    </div>
  );
}

/** Left pane: the source spreadsheet, rendered as its parsed grid. */
function SourcePane({
  sheets,
  activeSheet,
}: {
  sheets: ParsedSheet[];
  activeSheet: string | null;
}) {
  const sheet = sheets.find((candidate) => candidate.name === activeSheet) ?? sheets[0];
  if (!sheet) {
    return <p className="text-sm text-muted-foreground">Source file no longer available.</p>;
  }

  return (
    <div className="min-w-0">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <FileSpreadsheet className="h-3.5 w-3.5" />
        {sheet.name}
      </p>
      <div className="max-h-[22rem] overflow-auto rounded-lg border">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {sheet.headers.map((header, i) => (
                <th key={i} className="border-b px-2 py-1.5 text-left font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-muted/20">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border-b px-2 py-1 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Right pane: one card per proposed ITP, exceptions drilled into. */
function ProposalRow({
  row,
  resolution,
  onResolve,
  onSelect,
  busy,
}: {
  row: DryRunRow;
  resolution: Resolutions[string] | undefined;
  onResolve: (patch: Resolutions[string]) => void;
  onSelect: () => void;
  busy: boolean;
}) {
  const families = useMemo(() => activitiesByFamily(), []);
  const detail = rowDetail(row);

  return (
    <li className="rounded-lg border p-3">
      <button type="button" onClick={onSelect} className="w-full text-left">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.label}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME_CHIP[row.outcome]}`}
          >
            {OUTCOME_LABEL[row.outcome]}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {row.rowRef.sheet} · row {row.rowRef.rowIndex}
          {row.checklistItemCount ? ` · ${row.checklistItemCount} checklist rows` : ''}
        </span>
      </button>

      {detail && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {detail}
        </p>
      )}

      {row.unit !== 'checklist_row' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {row.reason === 'unresolvable_activity' && (
            <NativeSelect
              aria-label={`Activity for ${row.label}`}
              disabled={busy}
              value={resolution?.activitySlug ?? ''}
              onChange={(event) => onResolve({ activitySlug: event.target.value || undefined })}
              className="h-8 max-w-[16rem] text-xs"
            >
              <option value="">Pick an activity…</option>
              {families.map((family) => (
                <optgroup key={family.slug} label={family.displayName}>
                  {family.activities.map((activity) => (
                    <option key={activity.slug} value={activity.slug}>
                      {activity.displayName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
          )}

          {row.reason === 'state_spec_conflict' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onResolve({ affirmSpec: !resolution?.affirmSpec })}
            >
              {resolution?.affirmSpec ? 'Affirmed' : `Affirm ${row.declaredStateSpec} anyway`}
            </Button>
          )}

          {row.outcome !== 'skip' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onResolve({ skip: !resolution?.skip })}
            >
              {resolution?.skip ? 'Skipped — undo' : 'Leave this one out'}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * The Wave-B import review surface: the source spreadsheet beside the proposed
 * records, dry-run counts before any commit, exceptions resolved in place, then
 * one reviewed batch applied through the existing proposal decision endpoint.
 *
 * One surface for every import kind — the ledger shape is the same, and only the
 * copy in `KIND_COPY` differs.
 */
export function ImportReviewModal({
  projectId,
  kind,
  batchId: initialBatchId,
  batches,
  onRollback,
  onApplied,
  onClose,
}: ImportReviewModalProps) {
  const copy = KIND_COPY[kind];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [batchId, setBatchId] = useState<string | null>(initialBatchId ?? null);
  const [profileId, setProfileId] = useState(copy.defaultProfile);
  const [resolutions, setResolutions] = useState<Resolutions>({});
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);

  const batchQuery = useImportBatch(projectId, batchId ?? undefined);
  const profilesQuery = useImportProfiles(projectId, kind);
  const uploadMutation = useUploadImport(projectId, kind);
  const dryRunMutation = useImportDryRun(projectId, kind);
  const reviewMutation = useSendImportToReview(projectId, kind);
  const cancelMutation = useCancelImport(projectId, kind);
  const decideMutation = useDecideProposal(projectId);

  const busy =
    uploadMutation.isLoading ||
    dryRunMutation.isLoading ||
    reviewMutation.isLoading ||
    decideMutation.isLoading;

  const sheets = batchQuery.data?.grid?.sheets ?? [];
  const effectiveDryRun = dryRun ?? batchQuery.data?.dryRun ?? null;
  const blockedCount = effectiveDryRun?.counts.blocked ?? 0;

  const runDryRun = async (id: string, next: Resolutions) => {
    try {
      const result = await dryRunMutation.mutateAsync({
        batchId: id,
        profileId,
        resolutions: next,
      });
      setDryRun(result.dryRun);
    } catch (error) {
      logError('Import dry run failed:', error);
      toast({
        title: 'Could not check that spreadsheet',
        description: extractErrorMessage(error, 'Try a different column mapping.'),
        variant: 'error',
      });
    }
  };

  const handleFile = async (file: File) => {
    try {
      const result = await uploadMutation.mutateAsync(file);
      setBatchId(result.batch.id);
      setActiveSheet(result.sheets[0]?.name ?? null);
      const suggested = result.suggestedProfile?.key ?? copy.defaultProfile;
      setProfileId(suggested);
      const dry = await dryRunMutation.mutateAsync({
        batchId: result.batch.id,
        profileId: suggested,
      });
      setDryRun(dry.dryRun);
    } catch (error) {
      logError('Import upload failed:', error);
      toast({
        title: 'Could not read that spreadsheet',
        description: extractErrorMessage(error, 'Check the file and try again.'),
        variant: 'error',
      });
    }
  };

  const handleResolve = (key: string, patch: Resolutions[string]) => {
    const next = { ...resolutions, [key]: { ...resolutions[key], ...patch } };
    setResolutions(next);
    if (batchId) void runDryRun(batchId, next);
  };

  const handleApply = async () => {
    if (!batchId) return;
    try {
      const review = await reviewMutation.mutateAsync({ batchId, resolutions });
      setProposalId(review.proposalId);
      await decideMutation.mutateAsync({ proposalId: review.proposalId, action: 'accept' });
      toast({
        title: `${copy.nounPlural[0].toUpperCase()}${copy.nounPlural.slice(1)} imported`,
        description: `${review.itemCount} ${review.itemCount === 1 ? copy.noun : copy.nounPlural} added to this project.`,
      });
      onApplied?.();
      onClose();
    } catch (error) {
      logError('Import apply failed:', error);
      toast({
        title: `Could not import those ${copy.nounPlural}`,
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  const handleDismiss = async () => {
    if (batchId && !proposalId) {
      try {
        await cancelMutation.mutateAsync(batchId);
      } catch (error) {
        logError('Could not cancel the import:', error);
      }
    }
    onClose();
  };

  const profileOptions = [
    ...(profilesQuery.data?.builtIn ?? []).map((profile) => ({
      value: profile.key,
      label: profile.name,
    })),
    ...(profilesQuery.data?.saved ?? []).map((profile) => ({
      value: profile.id,
      label: profile.name,
    })),
  ];

  return (
    <Modal
      className="sm:max-w-5xl"
      onClose={() => {
        if (!busy) void handleDismiss();
      }}
    >
      <ModalHeader>{copy.title}</ModalHeader>
      <ModalDescription>
        {copy.blurb}, with the counts before anything is written. Excel files up to {MAX_FILE_MB}{' '}
        MB.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-4">
          {!batchId && batches !== undefined && batches.length > 0 && (
            <ImportPanel
              batches={batches}
              onResume={(id) => setBatchId(id)}
              onRollback={(id) => onRollback?.(id)}
              rollbackBusy={busy}
              title="Earlier imports"
              description="Pick up where you left off, or undo one you have already applied."
            />
          )}

          {!batchId && (
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file && !busy) void handleFile(file);
              }}
              className="rounded-lg border border-dashed p-6 text-center"
            >
              <FileUp className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-2 text-sm text-muted-foreground">Drag an .xlsx file here, or</p>
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
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  event.target.value = '';
                }}
              />
            </div>
          )}

          {busy && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the spreadsheet…
            </div>
          )}

          {batchId && effectiveDryRun && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="import-profile"
                >
                  Column mapping
                </label>
                <NativeSelect
                  id="import-profile"
                  className="h-8 max-w-[18rem] text-xs"
                  disabled={busy}
                  value={profileId}
                  onChange={(event) => {
                    setProfileId(event.target.value);
                    void runDryRun(batchId, resolutions);
                  }}
                >
                  {profileOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>

                {sheets.length > 1 && (
                  <NativeSelect
                    aria-label="Source sheet"
                    className="h-8 max-w-[14rem] text-xs"
                    value={activeSheet ?? sheets[0]?.name ?? ''}
                    onChange={(event) => setActiveSheet(event.target.value)}
                  >
                    {sheets.map((sheet) => (
                      <option key={sheet.name} value={sheet.name}>
                        {sheet.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </div>

              {effectiveDryRun.unmappedHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Not mapped:{' '}
                  {effectiveDryRun.unmappedHeaders.flatMap((entry) => entry.headers).join(', ')}
                </p>
              )}

              <CountsBar counts={effectiveDryRun.counts} />

              <div className="grid gap-4 md:grid-cols-2">
                <SourcePane sheets={sheets} activeSheet={activeSheet} />

                <ul className="max-h-[22rem] space-y-2 overflow-auto">
                  {effectiveDryRun.rows.map((row) => (
                    <ProposalRow
                      key={row.key}
                      row={row}
                      resolution={resolutions[row.key]}
                      busy={busy}
                      onSelect={() => setActiveSheet(row.rowRef.sheet)}
                      onResolve={(patch) => handleResolve(row.key, patch)}
                    />
                  ))}
                </ul>
              </div>

              {blockedCount > 0 && (
                <p className="text-sm text-destructive">
                  {blockedCount} row{blockedCount === 1 ? '' : 's'} must be resolved or skipped
                  before this import can be applied.
                </p>
              )}

              <a
                href={reconciliationCsvPath(projectId, batchId)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                Download the reconciliation report
              </a>
            </>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void handleDismiss()}
        >
          {batchId ? 'Discard this import' : 'Cancel'}
        </Button>
        {batchId && effectiveDryRun && (
          <Button
            type="button"
            disabled={busy || !effectiveDryRun.canApply}
            onClick={() => void handleApply()}
          >
            {decideMutation.isLoading
              ? 'Importing…'
              : `Import ${effectiveDryRun.counts.willCreate + effectiveDryRun.counts.needsReview} ${
                  effectiveDryRun.counts.willCreate + effectiveDryRun.counts.needsReview === 1
                    ? copy.noun
                    : copy.nounPlural
                }`}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
