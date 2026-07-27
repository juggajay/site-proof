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
  useCorporateMasters,
  useImportBatch,
  useImportDryRun,
  useImportFromMaster,
  useImportProfiles,
  useSendImportToReview,
  useUploadImport,
  type CorporateMaster,
  type DryRunResult,
  type DryRunRow,
  type ImportBatchSummary,
  type ImportKind,
  type ParsedSheet,
  type Resolutions,
  type UploadImportResult,
} from './importData';

const ACCEPT = '.xlsx,.pdf,.docx';
const MAX_FILE_MB = 25;

/** Not a real profile: the columns read straight off the uploaded file. It is
 *  the ONLY mapping a PDF can have (its columns are read, not printed), and the
 *  right starting point for a spreadsheet or Word table whose layout matches no
 *  profile. */
const DERIVED_PROFILE = '__derived__';

/** The only copy that differs between one migration and another. */
const KIND_COPY: Record<
  ImportKind,
  { title: string; blurb: string; defaultProfile: string; noun: string; nounPlural: string }
> = {
  itp_template: {
    title: 'Import ITPs from a file',
    blurb: 'Every ITP is shown beside what it was read from',
    defaultProfile: 'generic_au_itp_excel',
    noun: 'ITP',
    nounPlural: 'ITPs',
  },
  lot_register: {
    title: 'Import lots from a register',
    blurb: 'Every lot is shown beside what it was read from',
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

const DIFF_LABEL: Record<'added' | 'removed' | 'changed', string> = {
  added: 'New',
  removed: 'Not in this version',
  changed: 'Changed',
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

/** §4.5: the project's copy is controlled. Say what differs; never overwrite. */
function diffSummary(diff: NonNullable<DryRunRow['diff']>): string {
  const parts = [
    [diff.added, 'new'],
    [diff.changed, 'changed'],
    [diff.removed, 'not in this version'],
  ]
    .filter(([count]) => count)
    .map(([count, label]) => `${count} ${label}`);
  return `This project already has this ITP, and its copy differs — ${parts.join(', ')}. It is left as it is; update it by hand if you want these changes.`;
}

function rowDetail(row: DryRunRow): string {
  // The server's own wording, where a reason code alone cannot say enough.
  if (row.detail) return row.detail;
  if (row.diff) return diffSummary(row.diff);
  if (row.overLength) {
    return `${row.overLength.field} is ${row.overLength.length} characters (max ${row.overLength.max}). Shorten it at the source, or skip the row.`;
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

/** Left pane: the source, rendered as the grid it was read into. */
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

/**
 * B3 §4.5 — ITP sets already applied on another project, offered as corporate
 * masters. Picking one opens it here as a CONTROLLED COPY: the same dry run,
 * the same review, the same rollback, and a visible difference against anything
 * this project already has.
 */
function CorporateMasterPanel({
  masters,
  busy,
  onUse,
}: {
  masters: CorporateMaster[];
  busy: boolean;
  onUse: (masterId: string) => void;
}) {
  return (
    <section aria-label="Corporate masters" className="rounded-lg border bg-card">
      <div className="border-b p-4">
        <h3 className="text-sm font-medium">Bring in a corporate master</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          An ITP set you already imported on another project. This project gets its own controlled
          copy — nothing here is overwritten.
        </p>
      </div>
      <ul className="divide-y">
        {masters.map((master) => (
          <li key={master.id} className="flex items-center gap-2 p-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {master.sourceFileName ?? 'ITP set'}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {master.projectName} · {master.templateCount}{' '}
                {master.templateCount === 1 ? 'ITP' : 'ITPs'}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onUse(master.id)}
            >
              Use this master
            </Button>
          </li>
        ))}
      </ul>
    </section>
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

      {row.diff && row.diff.items.length > 0 && (
        <ul className="mt-2 space-y-1 border-l pl-3 text-xs text-muted-foreground">
          {row.diff.items.map((item, index) => (
            <li key={`${item.change}-${index}`} className="truncate">
              <span className="font-medium">{DIFF_LABEL[item.change]}:</span> {item.description}
            </li>
          ))}
        </ul>
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
 * The Wave-B import review surface: the source grid beside the proposed
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
  // A resumed batch already has a mapping stored with its dry run, so it starts
  // on that rather than on a profile the reviewer never picked.
  const [profileId, setProfileId] = useState(
    initialBatchId ? DERIVED_PROFILE : copy.defaultProfile,
  );
  const [uploadFieldMap, setUploadFieldMap] = useState<unknown[] | null>(null);
  const [resolutions, setResolutions] = useState<Resolutions>({});
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);

  const batchQuery = useImportBatch(projectId, batchId ?? undefined);
  const profilesQuery = useImportProfiles(projectId, kind);
  const mastersQuery = useCorporateMasters(projectId, kind);
  const uploadMutation = useUploadImport(projectId, kind);
  const masterMutation = useImportFromMaster(projectId, kind);
  const dryRunMutation = useImportDryRun(projectId, kind);
  const reviewMutation = useSendImportToReview(projectId, kind);
  const cancelMutation = useCancelImport(projectId, kind);
  const decideMutation = useDecideProposal(projectId);

  const busy =
    uploadMutation.isLoading ||
    masterMutation.isLoading ||
    dryRunMutation.isLoading ||
    reviewMutation.isLoading ||
    decideMutation.isLoading;

  const sheets = batchQuery.data?.grid?.sheets ?? [];
  const effectiveDryRun = dryRun ?? batchQuery.data?.dryRun ?? null;
  const blockedCount = effectiveDryRun?.counts.blocked ?? 0;
  // What would actually be written: rows that will be created, plus the
  // family-fold rows that still create. A `needs_review` row flagged as a
  // duplicate, a twin or an unresolved milestone creates nothing, so counting
  // every needs_review row would promise the reviewer records they will not get.
  const willImportCount =
    (effectiveDryRun?.counts.willCreate ?? 0) + (effectiveDryRun?.counts.ambiguous ?? 0);
  const derivedFieldMap = uploadFieldMap ?? effectiveDryRun?.fieldMap ?? null;

  /** What the next dry run maps with: an explicit map, or a named profile. */
  const mappingArgs = () =>
    profileId === DERIVED_PROFILE && derivedFieldMap
      ? { fieldMap: derivedFieldMap }
      : { profileId: profileId === DERIVED_PROFILE ? copy.defaultProfile : profileId };

  const runDryRun = async (id: string, next: Resolutions) => {
    try {
      const result = await dryRunMutation.mutateAsync({
        batchId: id,
        ...mappingArgs(),
        resolutions: next,
      });
      setDryRun(result.dryRun);
    } catch (error) {
      logError('Import dry run failed:', error);
      toast({
        title: 'Could not check that file',
        description: extractErrorMessage(error, 'Try a different column mapping.'),
        variant: 'error',
      });
    }
  };

  /** A freshly opened batch — from an uploaded file or a corporate master —
   *  mapped and dry-run, so the reviewer lands on the counts either way. */
  const openBatch = async (open: () => Promise<UploadImportResult>, failureTitle: string) => {
    try {
      const result = await open();
      setBatchId(result.batch.id);
      setActiveSheet(result.sheets[0]?.name ?? null);
      // No profile fits (always the case for a PDF, and for an unrecognised
      // sheet or Word table layout): map with the columns read off the file
      // rather than falling back to a profile whose columns are not in it.
      const suggested = result.suggestedProfile?.key ?? DERIVED_PROFILE;
      setProfileId(suggested);
      setUploadFieldMap(result.suggestedFieldMap ?? null);
      const dry = await dryRunMutation.mutateAsync({
        batchId: result.batch.id,
        ...(suggested === DERIVED_PROFILE
          ? { fieldMap: result.suggestedFieldMap }
          : { profileId: suggested }),
      });
      setDryRun(dry.dryRun);
    } catch (error) {
      logError('Import open failed:', error);
      toast({
        title: failureTitle,
        description: extractErrorMessage(error, 'Check the file and try again.'),
        variant: 'error',
      });
    }
  };

  const handleFile = (file: File) =>
    openBatch(() => uploadMutation.mutateAsync(file), 'Could not read that file');

  const handleMaster = (masterId: string) =>
    openBatch(
      () => masterMutation.mutateAsync(masterId),
      'Could not bring in that corporate master',
    );

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
    ...(derivedFieldMap ? [{ value: DERIVED_PROFILE, label: 'Columns read from the file' }] : []),
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
        {copy.blurb}, with the counts before anything is written. Excel, PDF or Word, up to{' '}
        {MAX_FILE_MB} MB.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-4">
          {!batchId && batches !== undefined && batches.length > 0 && (
            <ImportPanel
              batches={batches}
              onResume={(id) => {
                setBatchId(id);
                setProfileId(DERIVED_PROFILE);
              }}
              onRollback={(id) => onRollback?.(id)}
              rollbackBusy={busy}
              title="Earlier imports"
              description="Pick up where you left off, or undo one you have already applied."
            />
          )}

          {!batchId && (mastersQuery.data?.length ?? 0) > 0 && (
            <CorporateMasterPanel
              masters={mastersQuery.data ?? []}
              busy={busy}
              onUse={(masterId) => void handleMaster(masterId)}
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
              <p className="mt-2 text-sm text-muted-foreground">
                Drag an .xlsx, .pdf or .docx file here, or
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
              Reading the file…
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
              : `Import ${willImportCount} ${willImportCount === 1 ? copy.noun : copy.nounPlural}`}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
