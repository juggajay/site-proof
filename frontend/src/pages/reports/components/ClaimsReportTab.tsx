import React from 'react';
import { useDateFormat } from '@/lib/dateFormat';
import { useTimezone } from '@/lib/timezone';
import type { ClaimsReport } from '../types';
import { formatReportDateTime } from '../reportFormatting';
import { formatStatusLabel } from '@/lib/statusLabels';

export interface ClaimsReportTabProps {
  report: ClaimsReport;
}

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
}: ClaimsReportTabProps) {
  const { dateFormat, formatDate } = useDateFormat();
  const { timezone } = useTimezone();
  const generatedAt = formatReportDateTime(report.generatedAt, dateFormat, timezone);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(report.financialSummary.totalClaimed)}
          </div>
          <div className="text-sm text-muted-foreground">Total Claimed</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="text-2xl font-bold text-green-700">
            {formatCurrency(report.financialSummary.totalCertified)}
          </div>
          <div className="text-sm text-green-600">Certified</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="text-2xl font-bold text-blue-700">
            {formatCurrency(report.financialSummary.totalPaid)}
          </div>
          <div className="text-sm text-blue-600">Paid</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-2xl font-bold text-amber-700">
            {formatCurrency(report.financialSummary.outstanding)}
          </div>
          <div className="text-sm text-amber-600">Outstanding</div>
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
    </div>
  );
});
