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
      <div className="bg-white border rounded-lg p-6 print:hidden">
        <h3 className="text-lg font-medium mb-4">Report Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range (Sample Date)</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={testStartDate}
                onChange={(e) => setTestStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={testEndDate}
                onChange={(e) => setTestEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            {/* Date Range Presets */}
            <div className="flex gap-1 mt-2">
              <button
                type="button"
                onClick={() => applyDatePreset('today', setTestStartDate, setTestEndDate)}
                className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                data-testid="date-preset-today"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('this-week', setTestStartDate, setTestEndDate)}
                className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                data-testid="date-preset-this-week"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('this-month', setTestStartDate, setTestEndDate)}
                className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                data-testid="date-preset-this-month"
              >
                This Month
              </button>
            </div>
          </div>

          {/* Test Types Selection */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Test Types</label>
            <div className="flex flex-wrap gap-2">
              {availableTestTypes.length > 0 ? (
                availableTestTypes.map((testType) => (
                  <button
                    key={testType}
                    onClick={() => handleToggleTestType(testType)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedTestTypes.includes(testType)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {testType}
                  </button>
                ))
              ) : (
                <span className="text-gray-500 text-sm">All types (generate report to see options)</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          {hasFilters && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
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
              className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
            >
              Print / Save PDF
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border rounded-lg p-4">
              <div className="text-3xl font-bold text-gray-800">{report.totalTests}</div>
              <div className="text-sm text-gray-500">Total Tests</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600">{report.summary.pass}</div>
              <div className="text-sm text-green-500">Passed</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-red-600">{report.summary.fail}</div>
              <div className="text-sm text-red-500">Failed</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-600">{report.summary.passRate}%</div>
              <div className="text-sm text-blue-500">Pass Rate</div>
            </div>
          </div>

          {/* Test Type Breakdown */}
          {Object.keys(report.testTypeCounts).length > 0 && (
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-3">By Test Type</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.testTypeCounts).map(([testType, count]) => (
                  <span key={testType} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                    {testType}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tests Table */}
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Test Details</h3>
              <span className="text-sm text-gray-500">
                Generated: {new Date(report.generatedAt).toLocaleString()}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Laboratory</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pass/Fail</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.tests.map((test) => (
                    <tr key={test.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {test.testRequestNumber || test.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{test.testType}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{test.laboratoryName || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {test.resultValue != null ? `${test.resultValue} ${test.resultUnit || ''}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          test.passFail === 'pass' ? 'bg-green-100 text-green-700' :
                          test.passFail === 'fail' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {test.passFail || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{test.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.tests.length === 0 && (
                <div className="text-center py-8 text-gray-500">No test results found for this project.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
})
