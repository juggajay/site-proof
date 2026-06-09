import React from 'react';
import { useDateFormat } from '@/lib/dateFormat';
import { useTimezone } from '@/lib/timezone';
import type { NCRReport } from '../types';
import { formatReportDateTime } from '../reportFormatting';

export interface NCRReportTabProps {
  report: NCRReport;
}

export const NCRReportTab = React.memo(function NCRReportTab({ report }: NCRReportTabProps) {
  const { dateFormat } = useDateFormat();
  const { timezone } = useTimezone();
  const generatedAt = formatReportDateTime(report.generatedAt, dateFormat, timezone);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-3xl font-bold text-foreground">{report.totalNCRs}</div>
          <div className="text-sm text-muted-foreground">Total NCRs</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-3xl font-bold text-foreground">
            {report.summary.open +
              report.summary.investigating +
              report.summary.rectification +
              report.summary.verification}
          </div>
          <div className="text-sm text-muted-foreground">Open NCRs</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-3xl font-bold text-foreground">{report.closedThisMonth}</div>
          <div className="text-sm text-muted-foreground">Closed This Month</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-3xl font-bold text-foreground">
            {report.averageClosureTime > 0 ? `${report.averageClosureTime}d` : 'N/A'}
          </div>
          <div className="text-sm text-muted-foreground">Avg Closure Time</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-3xl font-bold text-foreground">{report.overdueCount}</div>
          <div className="text-sm text-muted-foreground">Overdue</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-3xl font-bold text-foreground">
            {report.summary.closed + report.summary.closedConcession}
          </div>
          <div className="text-sm text-muted-foreground">Total Closed</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-3xl font-bold text-foreground">{report.closureRate}%</div>
          <div className="text-sm text-muted-foreground">Closure Rate</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* NCRs by Category Chart */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">NCRs by Category</h3>
          <div className="space-y-3">
            {Object.entries(report.categoryCounts).map(([category, count]) => {
              const percentage =
                report.totalNCRs > 0 ? Math.round((count / report.totalNCRs) * 100) : 0;
              return (
                <div key={category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">{category.replace(/_/g, ' ')}</span>
                    <span className="font-medium">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(report.categoryCounts).length === 0 && (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </div>
        </div>

        {/* NCRs by Root Cause Chart */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">NCRs by Root Cause</h3>
          <div className="space-y-3">
            {Object.entries(report.rootCauseCounts).map(([rootCause, count]) => {
              const percentage =
                report.totalNCRs > 0 ? Math.round((count / report.totalNCRs) * 100) : 0;
              return (
                <div key={rootCause}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">{rootCause.replace(/_/g, ' ')}</span>
                    <span className="font-medium">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(report.rootCauseCounts).length === 0 && (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </div>
        </div>

        {/* NCRs by Responsible Party */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">NCRs by Responsible Party</h3>
          <div className="space-y-3">
            {Object.entries(report.responsiblePartyCounts).map(([party, count]) => {
              const percentage =
                report.totalNCRs > 0 ? Math.round((count / report.totalNCRs) * 100) : 0;
              return (
                <div key={party}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate max-w-[150px]">{party}</span>
                    <span className="font-medium">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(report.responsiblePartyCounts).length === 0 && (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Severity Breakdown */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="text-lg font-medium mb-3">By Severity</h3>
        <div className="flex gap-4">
          <span className="px-4 py-2 bg-warning/10 text-warning rounded-lg">
            Minor: <strong>{report.summary.minor}</strong>
          </span>
          <span className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg">
            Major: <strong>{report.summary.major}</strong>
          </span>
        </div>
      </div>

      {/* NCRs Table */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">NCR Details</h3>
          <span className="text-sm text-muted-foreground">Generated: {generatedAt}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  NCR #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Raised
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {report.ncrs.map((ncr) => (
                <tr key={ncr.id}>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{ncr.ncrNumber}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{ncr.description}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        ncr.category === 'major'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {ncr.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{ncr.status}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(ncr.raisedAt).toLocaleDateString('en-AU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.ncrs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No NCRs found for this project.
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
