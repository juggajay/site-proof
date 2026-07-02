import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/renderWithProviders';
import type { Claim } from '../types';
import { ClaimsTable } from './ClaimsTable';

const CLAIM: Claim = {
  id: 'claim-1',
  claimNumber: 5,
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  status: 'submitted',
  totalClaimedAmount: 61500,
  certifiedAmount: null,
  paidAmount: null,
  submittedAt: '2026-06-30T00:00:00.000Z',
  disputeNotes: null,
  disputedAt: null,
  lotCount: 3,
};

function renderTable(overrides: Partial<React.ComponentProps<typeof ClaimsTable>> = {}) {
  const props = {
    claims: [CLAIM],
    loadingCompleteness: false,
    showCompletenessModal: null,
    generatingEvidence: null,
    onCreateClaim: vi.fn(),
    onSubmitClaim: vi.fn(),
    onDeleteDraftClaim: vi.fn(),
    onDisputeClaim: vi.fn(),
    onCertifyClaim: vi.fn(),
    onRecordPayment: vi.fn(),
    onCompletenessCheck: vi.fn(),
    onEvidencePackage: vi.fn(),
    onExportXero: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<ClaimsTable {...props} />);
  return props;
}

describe('ClaimsTable — Export to Xero', () => {
  it('renders an Export to Xero button for each claim', () => {
    renderTable();
    expect(screen.getByRole('button', { name: 'Export to Xero' })).toBeInTheDocument();
  });

  it('calls onExportXero with the claim when clicked', () => {
    const props = renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Export to Xero' }));
    expect(props.onExportXero).toHaveBeenCalledWith(CLAIM);
  });
});
