/**
 * Tests tab content for LotDetailPage.
 * Displays test results linked to a lot.
 */

import { useNavigate } from 'react-router-dom'
import type { TestResult } from '@/pages/lots/types'
import { testPassFailColors, testStatusColors } from '@/pages/lots/constants'

interface TestsTabContentProps {
  projectId: string
  testResults: TestResult[]
  loading: boolean
}

export function TestsTabContent({ projectId, testResults, loading }: TestsTabContentProps) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (testResults.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <div className="text-4xl mb-2">🧪</div>
        <h3 className="text-lg font-semibold mb-2">No Test Results</h3>
        <p className="text-muted-foreground mb-4">
          No test results have been linked to this lot yet. Link test results to verify quality compliance.
        </p>
        <button
          onClick={() => navigate(`/projects/${projectId}/tests`)}
          className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
        >
          Go to Test Results
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Test Type</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Request #</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Laboratory</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Result</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Pass/Fail</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {testResults.map((test) => (
            <tr key={test.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 text-sm font-medium">{test.testType}</td>
              <td className="px-4 py-3 text-sm">{test.testRequestNumber || '—'}</td>
              <td className="px-4 py-3 text-sm">{test.laboratoryName || '—'}</td>
              <td className="px-4 py-3 text-sm">
                {test.resultValue != null
                  ? `${test.resultValue}${test.resultUnit ? ` ${test.resultUnit}` : ''}`
                  : '—'}
              </td>
              <td className="px-4 py-3 text-sm">
                <span className={`px-2 py-1 rounded text-xs font-medium ${testPassFailColors[test.passFail] || 'bg-gray-100'}`}>
                  {test.passFail}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                <span className={`px-2 py-1 rounded text-xs font-medium ${testStatusColors[test.status] || 'bg-gray-100'}`}>
                  {test.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
