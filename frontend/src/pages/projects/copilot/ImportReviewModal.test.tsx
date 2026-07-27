import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

import { ImportReviewModal } from './ImportReviewModal';
import type { DryRunResult, ImportBatchDetail } from './importData';

const state = vi.hoisted(() => ({
  detail: null as unknown,
  dryRunSpy: vi.fn(),
  decideSpy: vi.fn(),
  reviewSpy: vi.fn(),
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
  };
});
vi.mock('./copilotData', () => ({
  useDecideProposal: () => ({ mutateAsync: state.decideSpy, isLoading: false }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

function dryRun(overrides: Partial<DryRunResult> = {}): DryRunResult {
  return {
    counts: { willCreate: 1, willUpdate: 0, willSkip: 0, needsReview: 0, ambiguous: 0, blocked: 0 },
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

function renderModal(kind: 'itp_template' | 'lot_register' = 'itp_template'): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ImportReviewModal projectId="p1" kind={kind} batchId="batch-1" onClose={vi.fn()} />
    </QueryClientProvider>,
  ) as unknown as ReactElement;
}

describe('ImportReviewModal', () => {
  beforeEach(() => {
    state.dryRunSpy = vi.fn(async () => ({ dryRun: dryRun() }));
    state.reviewSpy = vi.fn(async () => ({ proposalId: 'prop-1', templateCount: 1 }));
    state.decideSpy = vi.fn(async () => ({}));
    state.detail = detailFor(dryRun());
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

  it('spells out an over-length cell rather than offering to truncate it', () => {
    const blocked = dryRun({
      counts: {
        willCreate: 0,
        willUpdate: 0,
        willSkip: 0,
        needsReview: 0,
        ambiguous: 0,
        blocked: 1,
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

  it('sends the batch to review and then accepts it, in that order', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^Import 1 ITP$/ }));

    await vi.waitFor(() => expect(state.decideSpy).toHaveBeenCalled());
    expect(state.reviewSpy).toHaveBeenCalledWith(expect.objectContaining({ batchId: 'batch-1' }));
    expect(state.decideSpy).toHaveBeenCalledWith({ proposalId: 'prop-1', action: 'accept' });
  });
});
