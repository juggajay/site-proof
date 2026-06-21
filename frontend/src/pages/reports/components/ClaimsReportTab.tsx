import React, { useCallback, useState } from 'react';
import { useDateFormat } from '@/lib/dateFormat';
import { useTimezone } from '@/lib/timezone';
import type { ClaimsReport } from '../types';
import { applyDatePreset } from '../types';
import { formatReportDateTime } from '../reportFormatting';
import { formatStatusLabel } from '@/lib/statusLabels';
import { NativeSelect } from '@/components/ui/native-select';

export interface ClaimsReportTabProps {
  report: ClaimsReport | null;
  loading: boolean;
  onGenerateReport: (startDate: string, endDate: string, statuses: string[]) => void;
}

const CLAIM_REPORT_STATUSES = [
  'draft',
  'submitted',
  'certified',
  'disputed',
  'paid',
  'partially_paid',
] as const;

const currencyFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

function formatCurrency(value: number | null | undefined): string {
  return currencyFormatter.format(value ?? 0);
}

export const ClaimsReportTab = React.memo(function ClaimsReportTab({
  report,
  loading,
  onGenerateReport,
}: ClaimsReportTabProps) {
  const { dateFormat, formatDate } = useDateFormat();
  const { timezone } = useTimezone();
  const [claimStartDate, setClaimStartDate] = useState<string>('');
  const [claimEndDate, setClaimEndDate] = useState<string>('');
  const [claimStatus, setClaimStatus] = useState<string>('');
  const generatedAt = report
    ? formatReportDateTime(report.generatedAt, dateFormat, timezone)
    : null;

  const handleGenerateReport = useCallback(() => {
    onGenerateReport(claimStartDate, claimEndDate, claimStatus ? [claimStatus] : []);
  }, [claimEndDate, claimStartDate, claimStatus, onGenerateReport]);

  const handleClearFilters = useCallback(() => {
    setClaimStartDate('');
    setClaimEndDate('');
    setClaimStatus('');
  }, []);

  const hasFilters = claimStartDate || claimEndDate || claimStatus;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="rounded-lg border bg-card p-6 print:hidden">
        <h3 className="mb-4 text-lg font-medium">Report Options</h3>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">
              Date Range (Period End)
            </span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="claim-report-start-date" className="sr-only">
                Claim report start date
              </label>
              <input
                id="claim-report-start-date"
                type="date"
                value={claimStartDate}
                onChange={(e) => setClaimStartDate(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
              <span className="text-muted-foreground">to</span>
              <label htmlFor="claim-report-end-date" className="sr-only">
                Claim report end date
              </label>
              <input
                id="claim-report-end-date"
                type="date"
                value={claimEndDate}
                onChange={(e) => setClaimEndDate(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                onClick={() => applyDatePreset('today', setClaimStartDate, setClaimEndDate)}
                className="rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-muted"
                data-testid="claim-date-preset-today"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('this-week', setClaimStartDate, setClaimEndDate)}
                className="rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-muted"
                data-testid="claim-date-preset-this-week"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('this-month', setClaimStartDate, setClaimEndDate)}
                className="rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-muted"
                data-testid="claim-date-preset-this-month"
              >
                This Month
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="claim-report-status"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Status
            </label>
            <NativeSelect
              id="claim-report-status"
              value={claimStatus}
              onChange={(e) => setClaimStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {CLAIM_REPORT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatStatusLabel(status)}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {!report ? null : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(report.financialSummary.totalClaimed)}
              </div>
              <div className="text-sm text-muted-foreground">Total Claimed</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(report.financialSummary.totalCertified)}
              </div>
              <div className="text-sm text-muted-foreground">Certified</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(report.financialSummary.totalPaid)}
              </div>
              <div className="text-sm text-muted-foreground">Paid</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(report.financialSummary.outstanding)}
              </div>
              <div className="text-sm text-muted-foreground">Outstanding</div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Claims Summary</h2>
                <p className="text-sm text-muted-foreground">
                  {report.totalClaims} claim{report.totalClaims === 1 ? '' : 's'} across{' '}
                  {report.financialSummary.totalLots} lot
                  {report.financialSummary.totalLots === 1 ? '' : 's'}
                </p>
              </div>
              <span className="text-sm text-muted-foreground">Generated: {generatedAt}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(report.statusCounts).map(([status, count]) => (
                <span key={status} className="rounded-full bg-muted px-3 py-1 text-sm">
                  {formatStatusLabel(status)}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          </div>

          {report.monthlyBreakdown.length > 0 ? (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-3 text-lg font-medium">Monthly Breakdown</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {report.monthlyBreakdown.map((month) => (
                  <div key={month.month} className="rounded-lg border bg-muted/30 p-4">
                    <div className="font-medium text-foreground">{month.month}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <span>Claims: {month.count}</span>
                      <span>Variance: {formatCurrency(month.variance)}</span>
                      <span>Claimed: {formatCurrency(month.claimed)}</span>
                      <span>Paid: {formatCurrency(month.paid)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-lg font-medium">Claim Details</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Claim
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Period
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                      Claimed
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                      Certified
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                      Outstanding
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                      Lots
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {report.claims.map((claim) => (
                    <tr key={claim.id}>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        Claim {claim.claimNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(claim.periodStart)} to {formatDate(claim.periodEnd)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatStatusLabel(claim.status)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {formatCurrency(claim.totalClaimedAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {formatCurrency(claim.certifiedAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {formatCurrency(claim.outstanding)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {claim.lotCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
