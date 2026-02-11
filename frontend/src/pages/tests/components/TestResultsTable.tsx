import React, { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '@/lib/api'
import { generateTestCertificatePDF, TestCertificateData } from '@/lib/pdfGenerator'
import { toast } from '@/components/ui/toaster'
import type { TestResult } from '../types'
import {
  statusColors,
  testStatusColors,
  testStatusLabels,
  nextStatusMap,
  nextStatusButtonLabels,
  isTestOverdue,
  getDaysSince,
} from '../constants'

interface TestResultsTableProps {
  projectId: string
  filteredTestResults: TestResult[]
  hasActiveFilters: boolean
  updatingStatusId: string | null
  onUpdateStatus: (testId: string, newStatus: string) => void
  onRejectTest: (testId: string) => void
  onClearFilters: () => void
  onOpenCreateModal: () => void
}

export const TestResultsTable = React.memo(function TestResultsTable({
  projectId,
  filteredTestResults,
  hasActiveFilters,
  updatingStatusId,
  onUpdateStatus,
  onRejectTest,
  onClearFilters,
  onOpenCreateModal,
}: TestResultsTableProps) {
  const navigate = useNavigate()

  if (filteredTestResults.length === 0 && !hasActiveFilters) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <div className="text-5xl mb-4">{'\uD83E\uDDEA'}</div>
        <h3 className="text-lg font-semibold mb-2">No Test Results</h3>
        <p className="text-muted-foreground mb-4">
          No test results have been recorded yet. Add test results to track quality compliance.
        </p>
        <button
          onClick={onOpenCreateModal}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Add your first test result
        </button>
      </div>
    )
  }

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: filteredTestResults.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  })

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Test Type</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Request #</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Linked Lot</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Laboratory</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Result</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Pass/Fail</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
      </table>
      {filteredTestResults.length === 0 && hasActiveFilters ? (
        <div className="px-4 py-8 text-center text-muted-foreground">
          <div className="text-3xl mb-2">{'\uD83D\uDD0D'}</div>
          <p>No test results match your filters.</p>
          <button
            onClick={onClearFilters}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div ref={parentRef} style={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const test = filteredTestResults[virtualRow.index]
              const overdue = isTestOverdue(test)
              const daysSince = getDaysSince(test.sampleDate, test.createdAt)
              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <table className="w-full">
                    <tbody>
                      <tr
                        className={`hover:bg-muted/30 border-b ${overdue ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500' : ''}`}
                      >
                        <td className="px-4 py-3 text-sm font-medium">
                          <div className="flex items-center gap-2">
                            {test.testType}
                            {/* Feature #200: AI extracted indicator */}
                            {test.aiExtracted && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-purple-500 text-white rounded font-bold" title="AI Extracted from certificate">
                                AI
                              </span>
                            )}
                            {overdue && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded font-bold">
                                OVERDUE
                              </span>
                            )}
                          </div>
                          {/* Feature #197: Show days since sample/created */}
                          <div className={`text-xs mt-0.5 ${overdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                            {daysSince} days since {test.sampleDate ? 'sample' : 'request'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{test.testRequestNumber || '\u2014'}</td>
                        <td className="px-4 py-3 text-sm">
                          {test.lot ? (
                            <button
                              onClick={() => navigate(`/projects/${projectId}/lots/${test.lotId}`)}
                              className="text-primary hover:underline"
                            >
                              {test.lot.lotNumber}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">{'\u2014'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{test.laboratoryName || '\u2014'}</td>
                        <td className="px-4 py-3 text-sm">
                          {test.resultValue != null
                            ? `${test.resultValue}${test.resultUnit ? ` ${test.resultUnit}` : ''}`
                            : '\u2014'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[test.passFail] || 'bg-gray-100'}`}>
                            {test.passFail}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${testStatusColors[test.status] || 'bg-gray-100'}`}>
                            {testStatusLabels[test.status] || test.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2 items-center">
                            {/* Feature #668: Print Certificate button */}
                            <button
                              onClick={async () => {
                                try {
                                  // Fetch project info for the certificate
                                  let projectData = null
                                  try {
                                    projectData = await apiFetch<any>(`/api/projects/${projectId}`)
                                  } catch (e) {
                                    // ignore - projectData stays null
                                  }

                                  // Get lot info if test is linked to a lot
                                  const lotInfo = test.lot ? {
                                    lotNumber: test.lot.lotNumber,
                                    description: (test.lot as any).description || null,
                                    activityType: (test.lot as any).activityType || null,
                                    chainageStart: (test.lot as any).chainageStart || null,
                                    chainageEnd: (test.lot as any).chainageEnd || null,
                                  } : null

                                  const pdfData: TestCertificateData = {
                                    test: {
                                      id: test.id,
                                      testType: test.testType,
                                      testRequestNumber: test.testRequestNumber,
                                      laboratoryName: test.laboratoryName,
                                      laboratoryReportNumber: test.laboratoryReportNumber,
                                      sampleDate: test.sampleDate,
                                      sampleLocation: test.sampleLocation,
                                      testDate: test.testDate,
                                      resultDate: test.resultDate,
                                      resultValue: test.resultValue,
                                      resultUnit: test.resultUnit,
                                      specificationMin: test.specificationMin,
                                      specificationMax: test.specificationMax,
                                      passFail: test.passFail,
                                      status: test.status,
                                      aiExtracted: test.aiExtracted,
                                      createdAt: test.createdAt,
                                    },
                                    lot: lotInfo,
                                    project: {
                                      name: projectData?.name || 'Unknown Project',
                                      projectNumber: projectData?.projectNumber || projectId || 'N/A',
                                    },
                                  }

                                  generateTestCertificatePDF(pdfData)
                                  toast({
                                    title: 'Certificate Generated',
                                    description: `Test certificate PDF downloaded successfully`,
                                  })
                                } catch (error) {
                                  console.error('Error generating test certificate:', error)
                                  toast({
                                    title: 'Error',
                                    description: 'Failed to generate test certificate',
                                    variant: 'error',
                                  })
                                }
                              }}
                              className="p-1.5 text-xs border rounded hover:bg-muted/50 transition-colors"
                              title="Print Test Certificate"
                            >
                              {'\uD83D\uDDA8\uFE0F'}
                            </button>
                            {nextStatusMap[test.status] && (
                              <button
                                onClick={() => onUpdateStatus(test.id, nextStatusMap[test.status])}
                                disabled={updatingStatusId === test.id}
                                className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                              >
                                {updatingStatusId === test.id ? 'Updating...' : nextStatusButtonLabels[test.status]}
                              </button>
                            )}
                            {/* Feature #204: Reject button for tests in "entered" status */}
                            {test.status === 'entered' && (
                              <button
                                onClick={() => onRejectTest(test.id)}
                                className="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                              >
                                Reject
                              </button>
                            )}
                            {test.status === 'verified' && (
                              <span className="text-green-600 text-xs font-medium">{'\u2713'} Complete</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})
