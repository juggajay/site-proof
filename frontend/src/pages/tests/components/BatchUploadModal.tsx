import React, { useState, useCallback } from 'react'
import { getAuthToken } from '@/lib/auth'
import { apiFetch, apiUrl } from '@/lib/api'
import type { TestResult } from '../types'
import { getBatchConfidenceIndicator } from '../constants'

interface BatchUploadModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onTestResultsUpdated: (testResults: TestResult[]) => void
}

export const BatchUploadModal = React.memo(function BatchUploadModal({
  isOpen,
  onClose,
  projectId,
  onTestResultsUpdated,
}: BatchUploadModalProps) {
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchResults, setBatchResults] = useState<any[]>([])
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [selectedBatchResult, setSelectedBatchResult] = useState<number | null>(null)
  const [batchReviewData, setBatchReviewData] = useState<Record<string, Record<string, string>>>({})
  const [batchConfirming, setBatchConfirming] = useState(false)

  const resetState = useCallback(() => {
    setBatchFiles([])
    setBatchResults([])
    setBatchReviewData({})
    setSelectedBatchResult(null)
    setBatchProgress(null)
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [resetState, onClose])

  // Feature #202: Batch upload handler (FormData - uses raw fetch)
  const handleBatchUpload = useCallback(async () => {
    if (batchFiles.length === 0) {
      alert('Please select files first')
      return
    }

    setBatchUploading(true)
    setBatchProgress({ current: 0, total: batchFiles.length })

    const token = getAuthToken()

    try {
      const formDataObj = new FormData()
      for (const file of batchFiles) {
        formDataObj.append('certificates', file)
      }
      formDataObj.append('projectId', projectId || '')

      const response = await fetch(apiUrl('/api/test-results/batch-upload'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataObj,
      })

      if (response.ok) {
        const data = await response.json()
        setBatchResults(data.results)
        setBatchProgress(null)

        // Initialize review data for each result
        const reviewData: Record<string, Record<string, string>> = {}
        for (const result of data.results) {
          if (result.success) {
            const extracted = result.extraction.extractedFields
            reviewData[result.testResult.id] = {
              testType: extracted.testType?.value || '',
              laboratoryName: extracted.laboratoryName?.value || '',
              laboratoryReportNumber: extracted.laboratoryReportNumber?.value || '',
              sampleDate: extracted.sampleDate?.value || '',
              testDate: extracted.testDate?.value || '',
              sampleLocation: extracted.sampleLocation?.value || '',
              resultValue: extracted.resultValue?.value || '',
              resultUnit: extracted.resultUnit?.value || '',
              specificationMin: extracted.specificationMin?.value || '',
              specificationMax: extracted.specificationMax?.value || '',
            }
          }
        }
        setBatchReviewData(reviewData)

        // Refresh test results list
        const testsData = await apiFetch<{ testResults: TestResult[] }>(`/api/test-results?projectId=${projectId}`)
        onTestResultsUpdated(testsData.testResults || [])
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to upload certificates')
        setBatchProgress(null)
      }
    } catch (err) {
      alert('Failed to upload certificates')
      setBatchProgress(null)
    } finally {
      setBatchUploading(false)
    }
  }, [batchFiles, projectId, onTestResultsUpdated])

  // Feature #202: Batch confirm all handler
  const handleBatchConfirmAll = useCallback(async () => {
    setBatchConfirming(true)

    try {
      const confirmations = batchResults
        .filter(r => r.success)
        .map(r => ({
          testResultId: r.testResult.id,
          corrections: batchReviewData[r.testResult.id] || {}
        }))

      await apiFetch('/api/test-results/batch-confirm', {
        method: 'POST',
        body: JSON.stringify({ confirmations }),
      })

      // Close modal and reset
      resetState()
      onClose()

      // Refresh test results
      const testsData = await apiFetch<{ testResults: TestResult[] }>(`/api/test-results?projectId=${projectId}`)
      onTestResultsUpdated(testsData.testResults || [])
    } catch (err) {
      alert('Failed to confirm extractions')
    } finally {
      setBatchConfirming(false)
    }
  }, [batchResults, batchReviewData, resetState, onClose, projectId, onTestResultsUpdated])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {'\uD83D\uDCC1'} Batch Upload Test Certificates
          </h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground text-2xl"
          >
            {'\u00D7'}
          </button>
        </div>

        {/* Before processing - File selection */}
        {batchResults.length === 0 ? (
          <div className="p-6">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <div className="text-5xl mb-4">{'\uD83D\uDCC1'}</div>
              <h3 className="text-lg font-semibold mb-2">Upload Multiple Test Certificates</h3>
              <p className="text-muted-foreground mb-4">
                Select up to 10 PDF files to process with AI extraction
              </p>
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png"
                multiple
                onChange={(e) => setBatchFiles(Array.from(e.target.files || []))}
                className="hidden"
                id="batch-certificate-upload"
              />
              <label
                htmlFor="batch-certificate-upload"
                className="inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90"
              >
                Select Files
              </label>
              {batchFiles.length > 0 && (
                <div className="mt-4 text-left">
                  <p className="text-sm font-medium mb-2">{batchFiles.length} file(s) selected:</p>
                  <div className="max-h-40 overflow-auto space-y-1">
                    {batchFiles.map((file, i) => (
                      <div key={i} className="p-2 bg-muted rounded text-sm flex justify-between">
                        <span>{file.name}</span>
                        <span className="text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Progress indicator */}
            {batchProgress && (
              <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Processing certificates...</span>
                  <span className="text-sm text-muted-foreground">
                    {batchProgress.current} / {batchProgress.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setBatchFiles([])
                  onClose()
                }}
                className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchUpload}
                disabled={batchFiles.length === 0 || batchUploading}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {batchUploading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Processing...
                  </span>
                ) : (
                  `\uD83E\uDD16 Process ${batchFiles.length} File${batchFiles.length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        ) : (
          /* After processing - Review queue */
          <div className="flex-1 flex overflow-hidden">
            {/* Left side - Results list */}
            <div className="w-1/3 border-r flex flex-col">
              <div className="p-3 bg-muted/50 border-b">
                <h3 className="font-medium">Extraction Results</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {batchResults.filter(r => r.success).length} of {batchResults.length} processed successfully
                </p>
              </div>
              <div className="flex-1 overflow-auto">
                {batchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => result.success && setSelectedBatchResult(index)}
                    className={`p-3 border-b cursor-pointer hover:bg-muted/50 ${
                      selectedBatchResult === index ? 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-l-purple-500' : ''
                    } ${!result.success ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {result.filename}
                      </span>
                      {result.success ? (
                        result.extraction?.needsReview ? (
                          <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">Review</span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-800 rounded">{'\u2713'} Good</span>
                        )
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-800 rounded">Failed</span>
                      )}
                    </div>
                    {result.success && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.testResult.testType}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right side - Selected result details */}
            <div className="w-2/3 flex flex-col">
              {selectedBatchResult !== null && batchResults[selectedBatchResult]?.success ? (
                <>
                  <div className="p-3 bg-muted/50 border-b">
                    <h3 className="font-medium">Review Extracted Data</h3>
                    <p className="text-xs text-muted-foreground">
                      {batchResults[selectedBatchResult].filename}
                    </p>
                  </div>
                  <div className="flex-1 overflow-auto p-4 space-y-3">
                    {/* Editable fields for selected result */}
                    {(() => {
                      const result = batchResults[selectedBatchResult]
                      const testId = result.testResult.id
                      const formData = batchReviewData[testId] || {}
                      const updateField = (field: string, value: string) => {
                        setBatchReviewData(prev => ({
                          ...prev,
                          [testId]: { ...prev[testId], [field]: value }
                        }))
                      }

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium mb-1">Test Type</label>
                              <input
                                type="text"
                                value={formData.testType || ''}
                                onChange={(e) => updateField('testType', e.target.value)}
                                className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'testType').color}`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Laboratory</label>
                              <input
                                type="text"
                                value={formData.laboratoryName || ''}
                                onChange={(e) => updateField('laboratoryName', e.target.value)}
                                className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'laboratoryName').color}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Lab Report #</label>
                            <input
                              type="text"
                              value={formData.laboratoryReportNumber || ''}
                              onChange={(e) => updateField('laboratoryReportNumber', e.target.value)}
                              className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'laboratoryReportNumber').color}`}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium mb-1">Sample Date</label>
                              <input
                                type="date"
                                value={formData.sampleDate || ''}
                                onChange={(e) => updateField('sampleDate', e.target.value)}
                                className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'sampleDate').color}`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Test Date</label>
                              <input
                                type="date"
                                value={formData.testDate || ''}
                                onChange={(e) => updateField('testDate', e.target.value)}
                                className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'testDate').color}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Sample Location</label>
                            <input
                              type="text"
                              value={formData.sampleLocation || ''}
                              onChange={(e) => updateField('sampleLocation', e.target.value)}
                              className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'sampleLocation').color}`}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium mb-1">Result Value</label>
                              <input
                                type="number"
                                step="any"
                                value={formData.resultValue || ''}
                                onChange={(e) => updateField('resultValue', e.target.value)}
                                className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'resultValue').color}`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Unit</label>
                              <input
                                type="text"
                                value={formData.resultUnit || ''}
                                onChange={(e) => updateField('resultUnit', e.target.value)}
                                className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'resultUnit').color}`}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium mb-1">Spec Min</label>
                              <input
                                type="number"
                                step="any"
                                value={formData.specificationMin || ''}
                                onChange={(e) => updateField('specificationMin', e.target.value)}
                                className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'specificationMin').color}`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Spec Max</label>
                              <input
                                type="number"
                                step="any"
                                value={formData.specificationMax || ''}
                                onChange={(e) => updateField('specificationMax', e.target.value)}
                                className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'specificationMax').color}`}
                              />
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  Select a result from the list to review
                </div>
              )}

              {/* Footer actions */}
              <div className="p-4 border-t flex justify-between">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchConfirmAll}
                  disabled={batchConfirming}
                  className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {batchConfirming ? 'Saving...' : `\u2713 Confirm All (${batchResults.filter(r => r.success).length})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
