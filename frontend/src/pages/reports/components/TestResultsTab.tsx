import React, { useState, useCallback, useMemo } from 'react'
import type { TestReport } from '../types'
import { applyDatePreset } from '../types'

export interface TestResultsTabProps {
  report: TestReport | null
  loading: boolean
  onRefresh: (startDate: string, endDate: string, testTypes: string[]) => void
}

export const TestResultsTab = React.memo(function TestResultsTab({
  report,
  loading,
  onRefresh,
}: TestResultsTabProps) {
  const [testStartDate, setTestStartDate] = useState<string>('')
  const [testEndDate, setTestEndDate] = useState<string>('')
  const [selectedTestTypes, setSelectedTestTypes] = useState<string[]>([])

  const availableTestTypes = useMemo(() => {
    if (!report) return []
    return Object.keys(report.testTypeCounts)
  }, [report])

  const handleToggleTestType = useCallback((testType: string) => {
    setSelectedTestTypes(prev =>
      prev.includes(testType)
        ? prev.filter(t => t !== testType)
        : [...prev, testType]
    )
  }, [])

  const handleGenerateReport = useCallback(() => {
    onRefresh(testStartDate, testEndDate, selectedTestTypes)
  }, [onRefresh, testStartDate, testEndDate, selectedTestTypes])

  const handleClearFilters = useCallback(() => {
    setTestStartDate('')
    setTestEndDate('')
    setSelectedTestTypes([])
  }, [])

  const hasFilters = testStartDate || testEndDate || selectedTestTypes.length > 0

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Feature #208: Report Filters */}
      <div className="bg-card border rounded-lg p-6 print:hidden">
        <h3 className="text-lg font-medium mb-4">Report Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Date Range (Sample Date)</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={testStartDate}
                onChange={(e) => setTestStartDate(e.target.value)}
                className="px-3 py-2 border border-border rounded-md text-sm"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={testEndDate}
                onChange={(e) => setTestEndDate(e.target.value)}
                className="px-3 py-2 border border-border rounded-md text-sm"
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
          </div>

          {/* Test Types Selection */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-2">Test Types</label>
            <div className="flex flex-wrap gap-2">
              {availableTestTypes.length > 0 ? (
                availableTestTypes.map((testType) => (
                  <button
                    key={testType}
                    onClick={() => handleToggleTestType(testType)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedTestTypes.includes(testType)
                        ? 'bg-primary text-white'
                        : 'bg-muted text-foreground hover:bg-muted'
                    }`}
                  >
                    {testType}
                  </button>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">All types (generate report to see options)</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          {hasFilters && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {report && (
        <>
          {/* Feature #208: Report Actions */}
          <div className="flex justify-end gap-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted/50 flex items-center gap-2"
            >
              Print / Save PDF
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border rounded-lg p-4">
              <div className="text-3xl font-bold text-foreground">{report.totalTests}</div>
              <div className="text-sm text-muted-foreground">Total Tests</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600">{report.summary.pass}</div>
              <div className="text-sm text-green-500">Passed</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-red-600">{report.summary.fail}</div>
              <div className="text-sm text-red-500">Failed</div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="text-3xl font-bold text-primary">{report.summary.passRate}%</div>
              <div className="text-sm text-primary/70">Pass Rate</div>
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
              <span className="text-sm text-muted-foreground">
                Generated: {new Date(report.generatedAt).toLocaleString()}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Test ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Laboratory</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Result</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pass/Fail</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {report.tests.map((test) => (
                    <tr key={test.id}>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {test.testRequestNumber || test.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{test.testType}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{test.laboratoryName || '-'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {test.resultValue != null ? `${test.resultValue} ${test.resultUnit || ''}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          test.passFail === 'pass' ? 'bg-green-100 text-green-700' :
                          test.passFail === 'fail' ? 'bg-red-100 text-red-700' :
                          'bg-muted text-foreground'
                        }`}>
                          {test.passFail || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{test.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.tests.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No test results found for this project.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
})
