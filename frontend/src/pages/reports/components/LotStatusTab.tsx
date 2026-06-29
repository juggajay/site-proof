import React from 'react';
import { useDateFormat } from '@/lib/dateFormat';
import { useTimezone } from '@/lib/timezone';
import type { LotStatusReport } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import { formatReportDateTime } from '../reportFormatting';
import { buildReportPaginationCaption } from '../reportPagination';

export interface LotStatusTabProps {
  report: LotStatusReport;
}

export const LotStatusTab = React.memo(function LotStatusTab({ report }: LotStatusTabProps) {
  const { dateFormat } = useDateFormat();
  const { timezone } = useTimezone();
  const generatedAt = formatReportDateTime(report.generatedAt, dateFormat, timezone);
  const paginationCaption = buildReportPaginationCaption(
    report.lots.length,
    report.totalLots,
    'lots',
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Summary Cards with Percentage */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{report.summary.notStarted}</div>
          <div className="text-sm text-muted-foreground">Not Started</div>
          <div className="text-xs text-muted-foreground mt-1">
            {report.totalLots > 0
              ? ((report.summary.notStarted / report.totalLots) * 100).toFixed(1)
              : 0}
            %
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{report.summary.inProgress}</div>
          <div className="text-sm text-muted-foreground">In Progress</div>
          <div className="text-xs text-muted-foreground mt-1">
            {report.totalLots > 0
              ? ((report.summary.inProgress / report.totalLots) * 100).toFixed(1)
              : 0}
            %
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{report.summary.awaitingTest}</div>
          <div className="text-sm text-muted-foreground">Awaiting Test</div>
          <div className="text-xs text-muted-foreground mt-1">
            {report.totalLots > 0
              ? ((report.summary.awaitingTest / report.totalLots) * 100).toFixed(1)
              : 0}
            %
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{report.summary.holdPoint}</div>
          <div className="text-sm text-muted-foreground">Hold Point</div>
          <div className="text-xs text-muted-foreground mt-1">
            {report.totalLots > 0
              ? ((report.summary.holdPoint / report.totalLots) * 100).toFixed(1)
              : 0}
            %
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{report.summary.ncrRaised}</div>
          <div className="text-sm text-muted-foreground">NCR Raised</div>
          <div className="text-xs text-muted-foreground mt-1">
            {report.totalLots > 0
              ? ((report.summary.ncrRaised / report.totalLots) * 100).toFixed(1)
              : 0}
            %
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{report.summary.conformed}</div>
          <div className="text-sm text-muted-foreground">Conformed</div>
          <div className="text-xs text-muted-foreground mt-1">
            {report.totalLots > 0
              ? ((report.summary.conformed / report.totalLots) * 100).toFixed(1)
              : 0}
            %
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{report.summary.claimed}</div>
          <div className="text-sm text-muted-foreground">Claimed</div>
          <div className="text-xs text-muted-foreground mt-1">
            {report.totalLots > 0
              ? ((report.summary.claimed / report.totalLots) * 100).toFixed(1)
              : 0}
            %
          </div>
        </div>
      </div>

      {/* Period Comparison */}
      {report.periodComparison && (
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Period Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border rounded-lg p-4">
              <div className="text-3xl font-bold text-foreground">
                {report.periodComparison.conformedThisPeriod}
              </div>
              <div className="text-sm text-muted-foreground">Conformed This Period</div>
              <div className="text-xs text-muted-foreground mt-1">
                {report.periodComparison.currentPeriodLabel}
              </div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-3xl font-bold text-foreground">
                {report.periodComparison.conformedLastPeriod}
              </div>
              <div className="text-sm text-muted-foreground">Conformed Last Period</div>
              <div className="text-xs text-muted-foreground mt-1">
                {report.periodComparison.previousPeriodLabel}
              </div>
            </div>
            <div
              className={`border rounded-lg p-4 ${
                report.periodComparison.periodChange > 0
                  ? 'bg-success/10 border-success/20'
                  : report.periodComparison.periodChange < 0
                    ? 'bg-destructive/10 border-destructive/20'
                    : 'bg-card border-border'
              }`}
            >
              <div
                className={`text-3xl font-bold ${
                  report.periodComparison.periodChange > 0
                    ? 'text-success'
                    : report.periodComparison.periodChange < 0
                      ? 'text-destructive'
                      : 'text-foreground'
                }`}
              >
                {report.periodComparison.periodChange > 0 ? '+' : ''}
                {report.periodComparison.periodChange}
              </div>
              <div
                className={`text-sm ${
                  report.periodComparison.periodChange > 0
                    ? 'text-success'
                    : report.periodComparison.periodChange < 0
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                }`}
              >
                Change from Previous
              </div>
              <div
                className={`text-xs mt-1 ${
                  report.periodComparison.periodChange > 0
                    ? 'text-success'
                    : report.periodComparison.periodChange < 0
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                }`}
              >
                {report.periodComparison.periodChange > 0 ? '+' : ''}
                {report.periodComparison.periodChangePercent}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Total Count */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Total Lots: {report.totalLots}</h2>
          <span className="text-sm text-muted-foreground">Generated: {generatedAt}</span>
        </div>

        {/* Activity Type Breakdown */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">By Activity Type</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(report.activityCounts).map(([activity, count]) => (
              <span key={activity} className="px-3 py-1 bg-muted rounded-full text-sm">
                {activity}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Lots Table */}
        <h3 className="text-lg font-medium mb-3">Lot Details</h3>
        {paginationCaption && (
          <p className="text-sm text-muted-foreground mb-3">{paginationCaption}</p>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Lot Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Activity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Chainage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {report.lots.map((lot) => (
                <tr key={lot.id}>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{lot.lotNumber}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {lot.description || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{lot.activityType}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {lot.chainageStart != null && lot.chainageEnd != null
                      ? `${lot.chainageStart} - ${lot.chainageEnd}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[lot.status] || 'bg-muted'}`}
                    >
                      {STATUS_LABELS[lot.status] || lot.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div hidden={report.lots.length > 0} className="text-center py-8 text-muted-foreground">
            No lots found for this project.
          </div>
        </div>
      </div>
    </div>
  );
});
