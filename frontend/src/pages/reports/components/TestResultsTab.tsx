import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDateFormat } from '@/lib/dateFormat';
import { useTimezone } from '@/lib/timezone';
import type { TestReport } from '../types';
import { applyDatePreset } from '../types';
import { formatReportDateTime } from '../reportFormatting';
import { buildReportPaginationCaption } from '../reportPagination';
import { getReportDateRangeError } from '../reportDateRange';

export interface TestResultsTabProps {
  report: TestReport | null;
  loading: boolean;
  onRefresh: (startDate: string, endDate: string, testTypes: string[]) => void;
  onFiltersChange?: (startDate: string, endDate: string, testTypes: string[]) => void;
}

export const TestResultsTab = React.memo(function TestResultsTab({
  report,
  loading,
  onRefresh,
  onFiltersChange,
}: TestResultsTabProps) {
  const { dateFormat } = useDateFormat();
  const { timezone } = useTimezone();
  const [testStartDate, setTestStartDate] = useState<string>('');
  const [testEndDate, setTestEndDate] = useState<string>('');
  const [selectedTestTypes, setSelectedTestTypes] = useState<string[]>([]);
  const [knownTestTypes, setKnownTestTypes] = useState<string[]>([]);
  const generatedAt = report
    ? formatReportDateTime(report.generatedAt, dateFormat, timezone)
    : null;
  const paginationCaption = report
    ? buildReportPaginationCaption(
        report.tests.length,
        report.pagination?.total ?? report.totalTests,
        'test results',
      )
    : null;
  const dateRangeError = getReportDateRangeError(testStartDate, testEndDate);

  useEffect(() => {
    onFiltersChange?.(testStartDate, testEndDate, selectedTestTypes);
  }, [onFiltersChange, testStartDate, testEndDate, selectedTestTypes]);

  useEffect(() => {
    if (!report) return;
    const reportTypes = Object.keys(report.testTypeCounts);
    if (reportTypes.length === 0) return;

    setKnownTestTypes((current) => Array.from(new Set([...current, ...reportTypes])));
  }, [report]);

  const availableTestTypes = useMemo(() => {
    const reportTypes = report ? Object.keys(report.testTypeCounts) : [];
    return Array.from(new Set([...knownTestTypes, ...reportTypes, ...selectedTestTypes]));
  }, [knownTestTypes, report, selectedTestTypes]);

  const handleToggleTestType = useCallback((testType: string) => {
    setSelectedTestTypes((prev) =>
      prev.includes(testType) ? prev.filter((t) => t !== testType) : [...prev, testType],
    );
  }, []);

  const handleGenerateReport = useCallback(() => {
    if (dateRangeError) return;
    onRefresh(testStartDate, testEndDate, selectedTestTypes);
  }, [dateRangeError, onRefresh, testStartDate, testEndDate, selectedTestTypes]);

  const handleClearFilters = useCallback(() => {
    setTestStartDate('');
    setTestEndDate('');
    setSelectedTestTypes([]);
    onRefresh('', '', []);
  }, [onRefresh]);

  const hasFilters = testStartDate || testEndDate || selectedTestTypes.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Feature #208: Report Filters */}
      <div className="bg-card border rounded-lg p-6 print:hidden">
        <h3 className="text-lg font-medium mb-4">Report Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Date Range */}
          <div>
            <span className="block text-sm font-medium text-foreground mb-2">
              Date Range (Sample Date)
            </span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="test-report-start-date" className="sr-only">
                Test report start date
              </label>
              <input
                id="test-report-start-date"
                type="date"
                value={testStartDate}
                onChange={(e) => setTestStartDate(e.target.value)}
                className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
              />
              <span className="text-muted-foreground">to</span>
              <label htmlFor="test-report-end-date" className="sr-only">
                Test report end date
              </label>
              <input
                id="test-report-end-date"
                type="date"
                value={testEndDate}
                onChange={(e) => setTestEndDate(e.target.value)}
                className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
              />
            </div>
            {/* Date Range Presets */}
            <div className="flex gap-1 mt-2">
              <button
                type="button"
                onClick={() => applyDatePreset('today', setTestStartDate, setTestEndDate)}
                className="px-2 py-1 text-xs rounded border border-border hover:bg-muted transition-colors"
                data-testid="date-preset-today"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('this-week', setTestStartDate, setTestEndDate)}
                className="px-2 py-1 text-xs rounded border border-border hover:bg-muted transition-colors"
                data-testid="date-preset-this-week"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('this-month', setTestStartDate, setTestEndDate)}
                className="px-2 py-1 text-xs rounded border border-border hover:bg-muted transition-colors"
                data-testid="date-preset-this-month"
              >
                This Month
              </button>
            </div>
            {dateRangeError && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {dateRangeError}
              </p>
            )}
          </div>

          {/* Test Types Selection */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-2">Test Types</label>
            <div className="flex flex-wrap gap-2">
              {availableTestTypes.length > 0 ? (
                availableTestTypes.map((testType) => (
                  <button
                    type="button"
                    key={testType}
                    aria-pressed={selectedTestTypes.includes(testType)}
                    onClick={() => handleToggleTestType(testType)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedTestTypes.includes(testType)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground hover:bg-muted'
                    }`}
                  >
                    {testType}
                  </button>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">
                  All types (generate report to see options)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={loading || Boolean(dateRangeError)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={loading}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border rounded-lg p-4">
              <div className="text-3xl font-bold text-foreground">{report.totalTests}</div>
              <div className="text-sm text-muted-foreground">Total Tests</div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-3xl font-bold text-foreground">{report.summary.pass}</div>
              <div className="text-sm text-muted-foreground">Passed</div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-3xl font-bold text-foreground">{report.summary.fail}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-3xl font-bold text-foreground">{report.summary.passRate}%</div>
              <div className="text-sm text-muted-foreground">Pass Rate</div>
            </div>
          </div>

          {/* Test Type Breakdown */}
          {Object.keys(report.testTypeCounts).length > 0 && (
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-3">By Test Type</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.testTypeCounts).map(([testType, count]) => (
                  <span key={testType} className="px-3 py-1 bg-muted rounded-full text-sm">
                    {testType}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tests Table */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Test Details</h3>
              <span className="text-sm text-muted-foreground">Generated: {generatedAt}</span>
            </div>
            {paginationCaption && (
              <p className="text-sm text-muted-foreground mb-3">{paginationCaption}</p>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Test ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Laboratory
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Result
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Pass/Fail
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {report.tests.map((test) => (
                    <tr key={test.id}>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {test.testRequestNumber || test.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{test.testType}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {test.laboratoryName || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {test.resultValue != null
                          ? `${test.resultValue} ${test.resultUnit || ''}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            test.passFail === 'pass'
                              ? 'bg-success/10 text-success'
                              : test.passFail === 'fail'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-muted text-foreground'
                          }`}
                        >
                          {test.passFail || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{test.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.tests.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No test results found for this project.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
});
