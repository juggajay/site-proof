import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/renderWithProviders';
import { DocketApprovalsMobileView } from './DocketApprovalsMobileView';

type Props = Parameters<typeof DocketApprovalsMobileView>[0];

function buildProps(overrides: Partial<Props> = {}): Props {
  return {
    dockets: [],
    filteredDockets: [],
    loading: false,
    statusFilter: 'all',
    setStatusFilter: vi.fn(),
    pendingCount: 0,
    totalLabourHours: 0,
    totalPlantHours: 0,
    loadError: null,
    canApprove: true,
    subcontractorSetupHref: '/setup',
    onApprove: vi.fn(),
    onQuery: vi.fn(),
    onReject: vi.fn(),
    onTapDocket: vi.fn(),
    onRefresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('DocketApprovalsMobileView skeleton loading state', () => {
  it('shows the docket skeleton while loading=true', () => {
    renderWithProviders(<DocketApprovalsMobileView {...buildProps({ loading: true })} />);
    expect(screen.getByTestId('docket-approvals-skeleton')).toBeInTheDocument();
    // At least 3 individual card skeletons rendered
    expect(screen.getAllByTestId('docket-card-skeleton').length).toBeGreaterThanOrEqual(3);
  });

  it('removes the skeleton once loading=false and shows empty state', () => {
    renderWithProviders(<DocketApprovalsMobileView {...buildProps({ loading: false })} />);
    expect(screen.queryByTestId('docket-approvals-skeleton')).not.toBeInTheDocument();
    // Empty state appears when there are no dockets and no error
    expect(screen.getByText('No subcontractor dockets yet')).toBeInTheDocument();
  });

  it('shows approved dollar totals on approved docket cards', () => {
    const docket: Props['filteredDockets'][number] = {
      id: 'docket-1',
      docketNumber: 'DKT-001',
      subcontractor: 'Ryox Carpentry',
      subcontractorId: 'sub-1',
      date: '2026-06-04',
      status: 'approved',
      notes: null,
      labourHours: 8,
      plantHours: 4,
      totalLabourSubmitted: 1200,
      totalLabourApproved: 6,
      totalPlantSubmitted: 300,
      totalPlantApproved: 3,
      totalLabourApprovedCost: 900,
      totalPlantApprovedCost: 200,
      submittedAt: '2026-06-04T08:00:00.000Z',
      approvedAt: '2026-06-04T09:00:00.000Z',
      foremanNotes: null,
    };

    renderWithProviders(
      <DocketApprovalsMobileView
        {...buildProps({
          dockets: [docket],
          filteredDockets: [docket],
          totalLabourHours: 8,
          totalPlantHours: 4,
        })}
      />,
    );

    expect(screen.getByText('$1,100.00')).toBeInTheDocument();
    expect(screen.getByText('$1,500.00').className).toContain('line-through');
    expect(screen.getByText('6h')).toBeInTheDocument();
    expect(screen.getByText('8h').className).toContain('line-through');
    expect(screen.getByText('3h')).toBeInTheDocument();
    expect(screen.getByText('4h').className).toContain('line-through');
  });

  it('shows restricted instead of zero when docket costs are redacted', () => {
    const docket: Props['filteredDockets'][number] = {
      id: 'docket-1',
      docketNumber: 'DKT-001',
      subcontractor: 'Ryox Carpentry',
      subcontractorId: 'sub-1',
      date: '2026-06-04',
      status: 'pending_approval',
      notes: null,
      labourHours: 8,
      plantHours: 4,
      totalLabourSubmitted: null,
      totalLabourApproved: 8,
      totalPlantSubmitted: null,
      totalPlantApproved: 4,
      totalLabourApprovedCost: null,
      totalPlantApprovedCost: null,
      submittedAt: '2026-06-04T08:00:00.000Z',
      approvedAt: null,
      foremanNotes: null,
    };

    renderWithProviders(
      <DocketApprovalsMobileView
        {...buildProps({
          dockets: [docket],
          filteredDockets: [docket],
          totalLabourHours: 8,
          totalPlantHours: 4,
        })}
      />,
    );

    expect(screen.getByText('Restricted')).toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });
});
