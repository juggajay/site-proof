import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateFormatProvider } from '@/lib/dateFormat';
import { TimezoneProvider } from '@/lib/timezone';
import { ClaimsReportTab } from './ClaimsReportTab';
import type { ClaimsReport } from '../types';

function renderClaimsReportTab(report: ClaimsReport) {
  render(
    <DateFormatProvider>
      <TimezoneProvider>
        <ClaimsReportTab report={report} loading={false} onGenerateReport={vi.fn()} />
      </TimezoneProvider>
    </DateFormatProvider>,
  );
}

describe('ClaimsReportTab', () => {
  it('renders missing row certified and outstanding amounts as unavailable', () => {
    renderClaimsReportTab({
      generatedAt: '2026-06-30T00:00:00.000Z',
      projectId: 'project-1',
      dateRange: { startDate: null, endDate: null },
      totalClaims: 1,
      statusCounts: { submitted: 1 },
      financialSummary: {
        totalClaimed: 1200,
        totalCertified: 0,
        totalPaid: 0,
        outstanding: 0,
        certificationRate: '0.0',
        collectionRate: '0.0',
        totalLots: 1,
      },
      monthlyBreakdown: [],
      claims: [
        {
          id: 'claim-1',
          claimNumber: 12,
          periodStart: '2026-06-01',
          periodEnd: '2026-06-30',
          status: 'submitted',
          totalClaimedAmount: 1200,
          certifiedAmount: null,
          paidAmount: null,
          variance: null,
          outstanding: null,
          submittedAt: '2026-06-30',
          certifiedAt: null,
          paidAt: null,
          paymentReference: null,
          lotCount: 1,
          lots: [],
          preparedBy: null,
          preparedAt: null,
        },
      ],
    });

    const row = screen.getByRole('row', { name: /Claim 12/i });
    const cells = within(row).getAllByRole('cell');

    expect(cells[4]).toHaveTextContent('-');
    expect(cells[5]).toHaveTextContent('-');
  });
});
