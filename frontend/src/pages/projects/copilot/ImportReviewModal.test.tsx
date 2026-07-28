import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

import { ImportReviewModal } from './ImportReviewModal';
import type { DryRunResult, ImportBatchDetail } from './importData';

const state = vi.hoisted(() => ({
  detail: null as unknown,
  masters: [] as unknown[],
  dryRunSpy: vi.fn(),
  decideSpy: vi.fn(),
  reviewSpy: vi.fn(),
  masterSpy: vi.fn(),
}));

vi.mock('./importData', async () => {
  const actual = await vi.importActual<typeof import('./importData')>('./importData');
  return {
    ...actual,
    useImportBatch: () => ({ data: state.detail }),
    useImportProfiles: () => ({
      data: {
        builtIn: [{ key: 'generic_au_itp_excel', name: 'Generic AU ITP sheet', fieldMap: [] }],
        saved: [],
      },
    }),
    useUploadImport: () => ({ mutateAsync: vi.fn(), isLoading: false }),
    useImportDryRun: () => ({ mutateAsync: state.dryRunSpy, isLoading: false }),
    useSendImportToReview: () => ({ mutateAsync: state.reviewSpy, isLoading: false }),
    useCancelImport: () => ({ mutateAsync: vi.fn(), isLoading: false }),
    useCorporateMasters: () => ({ data: state.masters }),
    useImportFromMaster: () => ({ mutateAsync: state.masterSpy, isLoading: false }),
  };
});
vi.mock('./copilotData', () => ({
  useDecideProposal: () => ({ mutateAsync: state.decideSpy, isLoading: false }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

function dryRun(overrides: Partial<DryRunResult> = {}): DryRunResult {
  return {
    counts: {
      willCreate: 1,
      willUpdate: 0,
      willSkip: 0,
      needsReview: 0,
      ambiguous: 0,
      blocked: 0,
      willImport: 1,
    },
    rows: [
      {
        key: 'ITP-01::ITP-01',
        unit: 'template',
        rowRef: { sheet: 'ITP-01', rowIndex: 2 },
        label: 'ITP-01 Subgrade',
        outcome: 'create',
        checklistItemCount: 3,
      },
    ],
    unmappedHeaders: [],
    canApply: true,
    ...overrides,
  };
}

/**
 * A CivilPro export whose "Milestone" rows the transform deliberately leaves
 * unfolded: one `needs_review` row per milestone checklist row, plus the
 * template row itself. Unresolved, `canApply` is false (itpImportDryRun.ts).
 */
function milestoneDryRun(templateKeys: string[] = ['ITP-01::ITP-01']): DryRunResult {
  return dryRun({
    counts: {
      willCreate: 0,
      willUpdate: 0,
      willSkip: 0,
      needsReview: templateKeys.length,
      ambiguous: 0,
      blocked: 0,
      willImport: 0,
    },
    canApply: false,
    rows: templateKeys.flatMap((key, index) => {
      const sheet = key.split('::')[0];
      return [
        {
          key: `row:${sheet}#4`,
          unit: 'checklist_row' as const,
          rowRef: { sheet, rowIndex: 4 },
          label: 'Superintendent approval to proceed',
          outcome: 'needs_review' as const,
          reason: 'milestone_point_type',
        },
        {
          key,
          unit: 'template' as const,
          rowRef: { sheet, rowIndex: 2 },
          label: `${sheet} ${index === 0 ? 'Subgrade' : 'Pavement'}`,
          outcome: 'needs_review' as const,
          reason: 'milestone_point_type',
        },
      ];
    }),
  });
}

function detailFor(result: DryRunResult): ImportBatchDetail {
  return {
    batch: {
      id: 'batch-1',
      kind: 'itp_template',
      status: 'dry_run',
      failedReason: null,
      createdAt: '',
      sourceFileName: 'itps.xlsx',
      proposalId: null,
      proposalStatus: null,
      sourceAvailable: true,
      mappingProfileId: null,
    },
    grid: {
      sheets: [
        {
          name: 'ITP-01',
          headers: ['Activity', 'Inspection / Test Activity'],
          rows: [['Earthworks', 'Proof roll subgrade']],
        },
      ],
    },
    dryRun: result,
  };
}

function renderModal(
  kind: 'itp_template' | 'lot_register' = 'itp_template',
  batchId: string | null = 'batch-1',
): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ImportReviewModal projectId="p1" kind={kind} batchId={batchId} onClose={vi.fn()} />
    </QueryClientProvider>,
  ) as unknown as ReactElement;
}

describe('ImportReviewModal', () => {
  beforeEach(() => {
    state.dryRunSpy = vi.fn(async () => ({ dryRun: dryRun() }));
    state.reviewSpy = vi.fn(async () => ({ proposalId: 'prop-1', templateCount: 1 }));
    state.decideSpy = vi.fn(async () => ({}));
    state.masterSpy = vi.fn(async () => ({
      batch: { id: 'batch-9', status: 'parsed', kind: 'itp_template' },
      sheets: [{ name: 'ITP-01', headers: ['Activity'], rowCount: 1 }],
      suggestedProfile: null,
      suggestedFieldMap: [],
    }));
    state.detail = detailFor(dryRun());
    state.masters = [];
  });

  it('shows the dry-run counts before anything is committed', () => {
    renderModal();
    expect(screen.getByText('import')).toBeInTheDocument();
    expect(screen.getByText('must be fixed')).toBeInTheDocument();
  });

  it('renders the source sheet beside the proposed ITPs', () => {
    renderModal();
    // Left pane: the parsed source grid.
    expect(screen.getByText('Proof roll subgrade')).toBeInTheDocument();
    // Right pane: the proposal card.
    expect(screen.getByText('ITP-01 Subgrade')).toBeInTheDocument();
    expect(screen.getByText(/3 checklist rows/)).toBeInTheDocument();
  });

  it('enables the apply CTA on a clean dry run', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /^Import 1 ITP$/ })).toBeEnabled();
  });

  // B2: the same surface migrates lot registers. Only the copy differs, and a
  // lot row carries its resolution controls exactly as a template row does.
  it('speaks about lots when it is importing a lot register', () => {
    state.detail = detailFor(
      dryRun({
        rows: [
          {
            key: 'lot:Lot Register#2',
            unit: 'lot',
            rowRef: { sheet: 'Lot Register', rowIndex: 2 },
            label: 'L-001',
            outcome: 'create',
          },
        ],
      }),
    );
    renderModal('lot_register');

    expect(screen.getByText('Import lots from a register')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Import 1 lot$/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Leave this one out/ })).toBeInTheDocument();
  });

  it('shows the server wording for a value the project specification rejects', () => {
    state.detail = detailFor(
      dryRun({
        counts: {
          willCreate: 0,
          willUpdate: 0,
          willSkip: 0,
          needsReview: 0,
          ambiguous: 0,
          blocked: 1,
          willImport: 0,
        },
        canApply: false,
        rows: [
          {
            key: 'lot:Lot Register#2',
            unit: 'lot',
            rowRef: { sheet: 'Lot Register', rowIndex: 2 },
            label: 'L-001',
            outcome: 'blocked',
            reason: 'unsupported_attribute',
            detail: '"Z" is not a testing scale VicRoads 173 uses. Valid scales: A, B, C.',
          },
        ],
      }),
    );
    renderModal('lot_register');

    expect(screen.getByText(/Valid scales: A, B, C/)).toBeInTheDocument();
  });

  it('disables apply and names the count while a row is blocked', () => {
    const blocked = dryRun({
      counts: {
        willCreate: 0,
        willUpdate: 0,
        willSkip: 0,
        needsReview: 0,
        ambiguous: 0,
        blocked: 2,
        willImport: 0,
      },
      canApply: false,
      rows: [
        {
          key: 'ITP-03::ITP-03',
          unit: 'template',
          rowRef: { sheet: 'ITP-03', rowIndex: 2 },
          label: 'ITP-03 Kerbing',
          outcome: 'blocked',
          reason: 'unresolvable_activity',
        },
      ],
    });
    state.detail = detailFor(blocked);
    renderModal();

    expect(screen.getByText(/2 rows must be resolved or skipped/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Import 0 ITPs$/ })).toBeDisabled();
  });

  it('offers an activity picker for an unresolvable activity and re-runs the dry run', () => {
    const blocked = dryRun({
      counts: {
        willCreate: 0,
        willUpdate: 0,
        willSkip: 0,
        needsReview: 0,
        ambiguous: 0,
        blocked: 1,
        willImport: 0,
      },
      canApply: false,
      rows: [
        {
          key: 'ITP-03::ITP-03',
          unit: 'template',
          rowRef: { sheet: 'ITP-03', rowIndex: 2 },
          label: 'ITP-03 Kerbing',
          outcome: 'blocked',
          reason: 'unresolvable_activity',
        },
      ],
    });
    state.detail = detailFor(blocked);
    renderModal();

    const picker = screen.getByLabelText('Activity for ITP-03 Kerbing');
    fireEvent.change(picker, { target: { value: 'kerb_channel' } });

    expect(state.dryRunSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-1',
        resolutions: { 'ITP-03::ITP-03': { activitySlug: 'kerb_channel' } },
      }),
    );
  });

  // B2/PDF: a PDF has no printed column headers — the reader emits the import
  // targets as its columns, so the batch's mapping is the map stored with its
  // dry run, never a spreadsheet profile whose columns are not in the file.
  it('re-runs a batch on the map stored with its dry run, not on a profile', () => {
    const pdfFieldMap = [{ target: 'description', source: { header: 'description' } }];
    const blocked = dryRun({
      counts: {
        willCreate: 0,
        willUpdate: 0,
        willSkip: 0,
        needsReview: 0,
        ambiguous: 0,
        blocked: 1,
        willImport: 0,
      },
      canApply: false,
      fieldMap: pdfFieldMap,
      rows: [
        {
          key: 'ITP Pack::ITP-03 Kerbing',
          unit: 'template',
          rowRef: { sheet: 'ITP Pack', rowIndex: 2 },
          label: 'ITP-03 Kerbing',
          outcome: 'blocked',
          reason: 'unresolvable_activity',
        },
      ],
    });
    state.detail = detailFor(blocked);
    renderModal();

    expect(screen.getByRole('option', { name: 'Columns read from the file' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Activity for ITP-03 Kerbing'), {
      target: { value: 'kerb_channel' },
    });

    const [args] = state.dryRunSpy.mock.calls.at(-1) as [Record<string, unknown>];
    expect(args.fieldMap).toEqual(pdfFieldMap);
    expect(args.profileId).toBeUndefined();
  });

  it('spells out an over-length cell rather than offering to truncate it', () => {
    const blocked = dryRun({
      counts: {
        willCreate: 0,
        willUpdate: 0,
        willSkip: 0,
        needsReview: 0,
        ambiguous: 0,
        blocked: 1,
        willImport: 0,
      },
      canApply: false,
      rows: [
        {
          key: 'row:ITP-01#4',
          unit: 'checklist_row',
          rowRef: { sheet: 'ITP-01', rowIndex: 4 },
          label: 'A very long item',
          outcome: 'blocked',
          reason: 'over_length',
          overLength: { field: 'description', length: 1200, max: 1000 },
        },
      ],
    });
    state.detail = detailFor(blocked);
    renderModal();

    expect(screen.getByText(/description is 1200 characters \(max 1000\)/)).toBeInTheDocument();
  });

  it('offers an affirm gesture with the conflicting spec named', () => {
    const conflicted = dryRun({
      counts: {
        willCreate: 0,
        willUpdate: 0,
        willSkip: 0,
        needsReview: 0,
        ambiguous: 0,
        blocked: 1,
        willImport: 0,
      },
      canApply: false,
      rows: [
        {
          key: 'ITP-01::ITP-01',
          unit: 'template',
          rowRef: { sheet: 'ITP-01', rowIndex: 2 },
          label: 'ITP-01 Subgrade',
          outcome: 'blocked',
          reason: 'state_spec_conflict',
          declaredStateSpec: 'MRTS',
        },
      ],
    });
    state.detail = detailFor(conflicted);
    renderModal();

    expect(screen.getByRole('button', { name: 'Affirm MRTS anyway' })).toBeInTheDocument();
    expect(screen.getByText(/This ITP declares MRTS/)).toBeInTheDocument();
  });

  // B3 §4.5: the project's copy is CONTROLLED. A re-imported master shows what
  // it would change and writes nothing — never a silent overwrite.
  it('spells out what a corporate master would change in the project copy', () => {
    state.detail = detailFor(
      dryRun({
        counts: {
          willCreate: 0,
          willUpdate: 0,
          willSkip: 0,
          needsReview: 1,
          ambiguous: 0,
          blocked: 0,
          willImport: 0,
        },
        canApply: false,
        rows: [
          {
            key: 'ITP-01::ITP-01',
            unit: 'template',
            rowRef: { sheet: 'ITP-01', rowIndex: 2 },
            label: 'ITP-01 Subgrade',
            outcome: 'needs_review',
            reason: 'duplicate',
            duplicateOf: { model: 'ITPTemplate', id: 't1', matchedOn: 'name + activity' },
            diff: {
              added: 1,
              changed: 1,
              removed: 0,
              items: [
                { change: 'added', description: 'Record the moisture content' },
                { change: 'changed', description: 'Proof roll the prepared subgrade' },
              ],
            },
          },
        ],
      }),
    );
    renderModal();

    expect(screen.getByText(/its copy differs — 1 new, 1 changed/)).toBeInTheDocument();
    expect(screen.getByText(/Record the moisture content/)).toBeInTheDocument();
    // A duplicate creates nothing, so it is not counted as an import.
    expect(screen.getByRole('button', { name: /^Import 0 ITPs$/ })).toBeDisabled();
  });

  // H6: a CivilPro Milestone is approval-bearing, so the server refuses to
  // guess and holds the whole batch. Without this control the reviewer had no
  // way to answer it and the file could never be imported.
  it('offers a point-type picker for a milestone row and unblocks the import', async () => {
    state.detail = detailFor(milestoneDryRun());
    renderModal();

    // The checklist row and its template both carry the reason.
    expect(screen.getAllByText(/A milestone row needs a point type/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^Import 0 ITPs$/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Milestone point type for ITP-01 Subgrade'), {
      target: { value: 'hold_point' },
    });

    expect(state.dryRunSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-1',
        resolutions: { 'ITP-01::ITP-01': { milestoneAs: 'hold_point' } },
      }),
    );

    // The re-run's verdict is what the apply CTA reads, and the resolution
    // travels with the batch when it is sent to review.
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: /^Import 1 ITP$/ })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Import 1 ITP$/ }));
    await vi.waitFor(() => expect(state.decideSpy).toHaveBeenCalled());
    expect(state.reviewSpy).toHaveBeenCalledWith({
      batchId: 'batch-1',
      resolutions: { 'ITP-01::ITP-01': { milestoneAs: 'hold_point' } },
    });
  });

  it('still lets a milestone template be left out instead of resolved', () => {
    state.detail = detailFor(milestoneDryRun());
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Leave this one out' }));

    expect(state.dryRunSpy).toHaveBeenCalledWith(
      expect.objectContaining({ resolutions: { 'ITP-01::ITP-01': { skip: true } } }),
    );
  });

  it('resolves each milestone template on its own', () => {
    const keys = ['ITP-01::ITP-01', 'ITP-02::ITP-02'];
    state.detail = detailFor(milestoneDryRun(keys));
    // The re-run still needs the other template resolved, so both cards stay.
    state.dryRunSpy = vi.fn(async () => ({ dryRun: milestoneDryRun(keys) }));
    renderModal();

    fireEvent.change(screen.getByLabelText('Milestone point type for ITP-01 Subgrade'), {
      target: { value: 'hold_point' },
    });
    fireEvent.change(screen.getByLabelText('Milestone point type for ITP-02 Pavement'), {
      target: { value: 'witness' },
    });

    expect(state.dryRunSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resolutions: {
          'ITP-01::ITP-01': { milestoneAs: 'hold_point' },
          'ITP-02::ITP-02': { milestoneAs: 'witness' },
        },
      }),
    );
  });

  it('offers corporate masters on the upload step and opens the one picked', async () => {
    state.masters = [
      {
        id: 'master-1',
        projectId: 'p0',
        projectName: 'Northern Interchange',
        sourceFileName: 'company-itps.xlsx',
        sourceFormat: 'excel',
        appliedAt: '',
        templateCount: 12,
      },
    ];
    renderModal('itp_template', null);

    expect(screen.getByText('Bring in a corporate master')).toBeInTheDocument();
    expect(screen.getByText(/Northern Interchange · 12 ITPs/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use this master' }));
    await vi.waitFor(() => expect(state.masterSpy).toHaveBeenCalledWith('master-1'));
  });

  /**
   * M10: the CTA used to be re-derived here as `willCreate + ambiguous`, so a
   * `template_not_found` row — which needs a look AND still creates its lot —
   * was left out of the number while the lot was written anyway. The count is
   * now the server's, derived from the payload.
   */
  it('promises the number of records the server says Apply will create', () => {
    state.detail = detailFor(
      dryRun({
        counts: {
          willCreate: 1,
          willUpdate: 0,
          willSkip: 0,
          needsReview: 2,
          ambiguous: 0,
          blocked: 0,
          willImport: 3,
        },
        rows: [
          {
            key: 'lot:Lot Register#2',
            unit: 'lot',
            rowRef: { sheet: 'Lot Register', rowIndex: 2 },
            label: 'L-001',
            outcome: 'create',
            willImport: true,
          },
          ...[3, 4].map((rowIndex) => ({
            key: `lot:Lot Register#${rowIndex}`,
            unit: 'lot' as const,
            rowRef: { sheet: 'Lot Register', rowIndex },
            label: `L-00${rowIndex}`,
            outcome: 'needs_review' as const,
            reason: 'template_not_found',
            willImport: true,
          })),
        ],
      }),
    );
    renderModal('lot_register');

    expect(screen.getByRole('button', { name: /^Import 3 lots$/ })).toBeEnabled();
    // …and the counts bar agrees with the CTA rather than with the outcomes.
    expect(screen.getByText('import').parentElement).toHaveTextContent('3 import');
  });

  /**
   * M10: `skipRows` was accepted by the server and typed on the client, but no
   * control ever wrote it — while the blocked row's own message told the
   * reviewer to "skip the row", and one over-length cell blocked the whole ITP.
   */
  it('lets the reviewer leave a blocked checklist row out of its template', () => {
    state.detail = detailFor(
      dryRun({
        counts: {
          willCreate: 0,
          willUpdate: 0,
          willSkip: 0,
          needsReview: 0,
          ambiguous: 0,
          blocked: 2,
          willImport: 0,
        },
        canApply: false,
        rows: [
          {
            key: 'row:ITP-01#4',
            unit: 'checklist_row',
            parentKey: 'ITP-01::ITP-01',
            rowRef: { sheet: 'ITP-01', rowIndex: 4 },
            label: 'A very long item',
            outcome: 'blocked',
            reason: 'over_length',
            overLength: { field: 'description', length: 1200, max: 1000 },
          },
          {
            key: 'ITP-01::ITP-01',
            unit: 'template',
            rowRef: { sheet: 'ITP-01', rowIndex: 2 },
            label: 'ITP-01 Subgrade',
            outcome: 'blocked',
            reason: 'over_length',
            overLength: { field: 'description', length: 1200, max: 1000 },
          },
        ],
      }),
    );
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Leave this row out' }));

    // Keyed on the TEMPLATE, carrying the source row index — the shape
    // `TemplateResolution.skipRows` has always accepted.
    expect(state.dryRunSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-1',
        resolutions: { 'ITP-01::ITP-01': { skipRows: [4] } },
      }),
    );
  });

  // M10: a read that could not account for its whole source says so, rather
  // than importing a truncated one silently.
  it('surfaces a read-level notice above the counts', () => {
    const detail = detailFor(dryRun());
    detail.grid = {
      ...detail.grid!,
      notice: 'The PDF reader could not confirm how many pages that document has',
    };
    state.detail = detail;
    renderModal();

    expect(screen.getByText(/could not confirm how many pages/)).toBeInTheDocument();
  });

  it('sends the batch to review and then accepts it, in that order', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^Import 1 ITP$/ }));

    await vi.waitFor(() => expect(state.decideSpy).toHaveBeenCalled());
    expect(state.reviewSpy).toHaveBeenCalledWith(expect.objectContaining({ batchId: 'batch-1' }));
    expect(state.decideSpy).toHaveBeenCalledWith({ proposalId: 'prop-1', action: 'accept' });
  });
});
