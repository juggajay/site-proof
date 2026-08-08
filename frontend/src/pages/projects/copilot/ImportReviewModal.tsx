import { useRef, useState } from 'react';
import { AlertTriangle, Download, FileUp, Loader2 } from 'lucide-react';

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
import { useDecideProposal } from './copilotData';
import { ImportPanel } from './ImportPanel';
import { CorporateMasterPanel, CountsBar, ProposalRow, SourcePane } from './ImportReviewPanes';
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
  type DryRunResult,
  type DryRunRow,
  type ImportBatchSummary,
  type ImportKind,
  type Resolutions,
  type UploadImportResult,
} from './importData';
import { learnActivityAcrossRows } from './importBulkLearn';

// M10: `.csv` is back. SiteProof's own lot-register export is CSV-only, so
// leaving it out meant the app could not re-import a register it had written.
const ACCEPT = '.xlsx,.csv,.pdf,.docx';
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
  // Something about the READ that no single row can say — a PDF whose page
  // coverage the model never confirmed, merges too large to check.
  const readNotice = batchQuery.data?.grid?.notice ?? null;
  const effectiveDryRun = dryRun ?? batchQuery.data?.dryRun ?? null;
  const blockedCount = effectiveDryRun?.counts.blocked ?? 0;
  // M10: the server's own count of what Apply will write, derived from the
  // payload. It used to be re-derived here from the outcomes, which left every
  // `template_not_found` row out of the number while still creating its lot.
  const willImportCount = effectiveDryRun?.counts.willImport ?? 0;
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
    let next = { ...resolutions, [key]: { ...resolutions[key], ...patch } };
    if (patch.activitySlug !== undefined) {
      next = learnActivityAcrossRows(next, effectiveDryRun?.rows ?? [], key, patch.activitySlug);
    }
    setResolutions(next);
    if (batchId) void runDryRun(batchId, next);
  };

  /**
   * M10: leave one checklist row out of its template. `skipRows` is keyed on
   * the TEMPLATE and lists source row indexes, which is why the row's own card
   * needs the parent key the server now sends — the message on a blocked row
   * has always told the reviewer to skip it, with nothing to click.
   */
  const rowSkipped = (row: DryRunRow) =>
    Boolean(row.parentKey && resolutions[row.parentKey]?.skipRows?.includes(row.rowRef.rowIndex));

  const handleSkipRow = (parentKey: string, rowIndex: number) => {
    const current = resolutions[parentKey]?.skipRows ?? [];
    handleResolve(parentKey, {
      skipRows: current.includes(rowIndex)
        ? current.filter((index) => index !== rowIndex)
        : [...current, rowIndex],
    });
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
        {copy.blurb}, with the counts before anything is written. Excel, CSV, PDF or Word, up to{' '}
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
                Drag an .xlsx, .csv, .pdf or .docx file here, or
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

              {/* M10: a read that could not account for the whole source says
                  so here, above the counts — the counts describe what was
                  read, and this says how much that was. */}
              {readNotice && (
                <p className="flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {readNotice}
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
                      rowSkipped={rowSkipped(row)}
                      onSkipRow={
                        row.parentKey
                          ? () => handleSkipRow(row.parentKey!, row.rowRef.rowIndex)
                          : undefined
                      }
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
