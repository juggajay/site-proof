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
});
