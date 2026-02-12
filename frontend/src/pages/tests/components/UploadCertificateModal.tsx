import React, { useState, useCallback } from 'react'
import { getAuthToken } from '@/lib/auth'
import { apiFetch, apiUrl } from '@/lib/api'
import type { TestResult, ExtractionResult } from '../types'
import { getConfidenceIndicator } from '../constants'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface UploadCertificateModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onTestResultsUpdated: (testResults: TestResult[]) => void
}

export const UploadCertificateModal = React.memo(function UploadCertificateModal({
  isOpen,
  onClose,
  projectId,
  onTestResultsUpdated,
}: UploadCertificateModalProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
  const [extractedTestId, setExtractedTestId] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [reviewFormData, setReviewFormData] = useState<Record<string, string>>({})
  const [confirmingExtraction, setConfirmingExtraction] = useState(false)

  const resetState = useCallback(() => {
    setUploadedFile(null)
    setExtractionResult(null)
    setExtractedTestId(null)
    setPdfUrl(null)
    setReviewFormData({})
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [resetState, onClose])

  // Feature #200: Handle certificate upload with AI extraction (FormData - uses raw fetch)
  const handleUploadCertificate = useCallback(async () => {
    if (!uploadedFile) {
      alert('Please select a file first')
      return
    }

    setUploading(true)
    const token = getAuthToken()

    try {
      const formDataObj = new FormData()
      formDataObj.append('certificate', uploadedFile)
      formDataObj.append('projectId', projectId || '')

      const response = await fetch(apiUrl('/api/test-results/upload-certificate'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataObj,
      })

      if (response.ok) {
        const data = await response.json()
        setExtractionResult(data.extraction)
        setExtractedTestId(data.testResult.id)

        // Set form data for review from extracted values
        const extractedFields = data.extraction.extractedFields
        setReviewFormData({
          testType: extractedFields.testType?.value || '',
          laboratoryName: extractedFields.laboratoryName?.value || '',
          laboratoryReportNumber: extractedFields.laboratoryReportNumber?.value || '',
          sampleDate: extractedFields.sampleDate?.value || '',
          testDate: extractedFields.testDate?.value || '',
          sampleLocation: extractedFields.sampleLocation?.value || '',
          resultValue: extractedFields.resultValue?.value || '',
          resultUnit: extractedFields.resultUnit?.value || '',
          specificationMin: extractedFields.specificationMin?.value || '',
          specificationMax: extractedFields.specificationMax?.value || '',
        })

        // Create preview URL for the PDF
        const previewUrl = URL.createObjectURL(uploadedFile)
        setPdfUrl(previewUrl)

        // Refresh test results list
        const testsData = await apiFetch<{ testResults: TestResult[] }>(`/api/test-results?projectId=${projectId}`)
        onTestResultsUpdated(testsData.testResults || [])
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to upload certificate')
      }
    } catch (err) {
      alert('Failed to upload certificate')
    } finally {
      setUploading(false)
    }
  }, [uploadedFile, projectId, onTestResultsUpdated])

  // Feature #200: Confirm extraction and save corrections
  const handleConfirmExtraction = useCallback(async () => {
    if (!extractedTestId) return

    setConfirmingExtraction(true)

    try {
      await apiFetch(`/api/test-results/${extractedTestId}/confirm-extraction`, {
        method: 'PATCH',
        body: JSON.stringify({ corrections: reviewFormData }),
      })

      // Close modal and refresh
      resetState()
      onClose()

      // Refresh test results
      const testsData = await apiFetch<{ testResults: TestResult[] }>(`/api/test-results?projectId=${projectId}`)
      onTestResultsUpdated(testsData.testResults || [])
    } catch (err) {
      alert('Failed to confirm extraction')
    } finally {
      setConfirmingExtraction(false)
    }
  }, [extractedTestId, reviewFormData, resetState, onClose, projectId, onTestResultsUpdated])

  const confidenceForField = useCallback((field: string) => {
    return getConfidenceIndicator(extractionResult?.confidence, field)
  }, [extractionResult])

  if (!isOpen) return null

  return (
    <Modal onClose={handleClose} className="max-w-5xl">
      <ModalHeader>
        {extractionResult ? '\uD83D\uDCCA Review AI Extracted Data' : '\uD83D\uDCC4 Upload Test Certificate'}
      </ModalHeader>
      <ModalBody className="p-0">
        {/* Before extraction - File upload */}
        {!extractionResult ? (
          <div className="p-6">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <div className="text-5xl mb-4">{'\uD83D\uDCC4'}</div>
              <h3 className="text-lg font-semibold mb-2">Upload Test Certificate PDF</h3>
              <p className="text-muted-foreground mb-4">
                Upload a test certificate and our AI will automatically extract the test data
              </p>
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png"
                onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                className="hidden"
                id="certificate-upload"
              />
              <label
                htmlFor="certificate-upload"
                className="inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90"
              >
                Select File
              </label>
              {uploadedFile && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{uploadedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setUploadedFile(null)
                  onClose()
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadCertificate}
                disabled={!uploadedFile || uploading}
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Processing with AI...
                  </span>
                ) : (
                  '\uD83E\uDD16 Extract with AI'
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* After extraction - Side-by-side view */
          <div className="flex overflow-hidden" style={{ height: '70vh' }}>
            {/* Left side - PDF Preview */}
            <div className="w-1/2 border-r flex flex-col">
              <div className="p-3 bg-muted/50 border-b">
                <h3 className="font-medium">Certificate Preview</h3>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {pdfUrl && uploadedFile?.type === 'application/pdf' ? (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full min-h-[500px] rounded border"
                    title="Certificate Preview"
                  />
                ) : pdfUrl ? (
                  <img src={pdfUrl} alt="Certificate" className="max-w-full rounded border" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No preview available
                  </div>
                )}
              </div>
            </div>

            {/* Right side - Extracted Data */}
            <div className="w-1/2 flex flex-col">
              <div className="p-3 bg-muted/50 border-b">
                <h3 className="font-medium">Extracted Data</h3>
                {extractionResult.needsReview && (
                  <p className="text-xs text-amber-600 mt-1">
                    {'\u26A0\uFE0F'} {extractionResult.reviewMessage}
                  </p>
                )}
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* Confidence Summary */}
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 text-sm font-medium text-purple-800 dark:text-purple-200">
                    <span>{'\uD83E\uDD16'}</span>
                    <span>AI Extraction Complete</span>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    {extractionResult.lowConfidenceFields.length === 0
                      ? 'All fields extracted with high confidence'
                      : `${extractionResult.lowConfidenceFields.length} field(s) need verification (highlighted in red)`}
                  </p>
                </div>

                {/* Editable Fields */}
                <div className="space-y-3">
                  <div>
                    <Label>Test Type</Label>
                    <Input
                      type="text"
                      value={reviewFormData.testType || ''}
                      onChange={(e) => setReviewFormData({ ...reviewFormData, testType: e.target.value })}
                      className={confidenceForField('testType').color}
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">{confidenceForField('testType').text}</p>
                  </div>
                  <div>
                    <Label>Laboratory Name</Label>
                    <Input
                      type="text"
                      value={reviewFormData.laboratoryName || ''}
                      onChange={(e) => setReviewFormData({ ...reviewFormData, laboratoryName: e.target.value })}
                      className={confidenceForField('laboratoryName').color}
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">{confidenceForField('laboratoryName').text}</p>
                  </div>
                  <div>
                    <Label>Lab Report Number</Label>
                    <Input
                      type="text"
                      value={reviewFormData.laboratoryReportNumber || ''}
                      onChange={(e) => setReviewFormData({ ...reviewFormData, laboratoryReportNumber: e.target.value })}
                      className={confidenceForField('laboratoryReportNumber').color}
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">{confidenceForField('laboratoryReportNumber').text}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Sample Date</Label>
                      <Input
                        type="date"
                        value={reviewFormData.sampleDate || ''}
                        onChange={(e) => setReviewFormData({ ...reviewFormData, sampleDate: e.target.value })}
                        className={confidenceForField('sampleDate').color}
                      />
                      <p className="text-xs text-muted-foreground mt-0.5">{confidenceForField('sampleDate').text}</p>
                    </div>
                    <div>
                      <Label>Test Date</Label>
                      <Input
                        type="date"
                        value={reviewFormData.testDate || ''}
                        onChange={(e) => setReviewFormData({ ...reviewFormData, testDate: e.target.value })}
                        className={confidenceForField('testDate').color}
                      />
                      <p className="text-xs text-muted-foreground mt-0.5">{confidenceForField('testDate').text}</p>
                    </div>
                  </div>
                  <div>
                    <Label>Sample Location</Label>
                    <Input
                      type="text"
                      value={reviewFormData.sampleLocation || ''}
                      onChange={(e) => setReviewFormData({ ...reviewFormData, sampleLocation: e.target.value })}
                      className={confidenceForField('sampleLocation').color}
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">{confidenceForField('sampleLocation').text}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Result Value</Label>
                      <Input
                        type="number"
                        step="any"
                        value={reviewFormData.resultValue || ''}
                        onChange={(e) => setReviewFormData({ ...reviewFormData, resultValue: e.target.value })}
                        className={confidenceForField('resultValue').color}
                      />
                      <p className="text-xs text-muted-foreground mt-0.5">{confidenceForField('resultValue').text}</p>
                    </div>
                    <div>
                      <Label>Unit</Label>
                      <Input
                        type="text"
                        value={reviewFormData.resultUnit || ''}
                        onChange={(e) => setReviewFormData({ ...reviewFormData, resultUnit: e.target.value })}
                        className={confidenceForField('resultUnit').color}
                      />
                      <p className="text-xs text-muted-foreground mt-0.5">{confidenceForField('resultUnit').text}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Spec Min</Label>
                      <Input
                        type="number"
                        step="any"
                        value={reviewFormData.specificationMin || ''}
                        onChange={(e) => setReviewFormData({ ...reviewFormData, specificationMin: e.target.value })}
                        className={confidenceForField('specificationMin').color}
                      />
                      <p className="text-xs text-muted-foreground mt-0.5">{confidenceForField('specificationMin').text}</p>
                    </div>
                    <div>
                      <Label>Spec Max</Label>
                      <Input
                        type="number"
                        step="any"
                        value={reviewFormData.specificationMax || ''}
                        onChange={(e) => setReviewFormData({ ...reviewFormData, specificationMax: e.target.value })}
                        className={confidenceForField('specificationMax').color}
                      />
                      <p className="text-xs text-muted-foreground mt-0.5">{confidenceForField('specificationMax').text}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="p-4 border-t flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmExtraction}
                  disabled={confirmingExtraction}
                >
                  {confirmingExtraction ? 'Saving...' : '\u2713 Confirm & Save'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </ModalBody>
    </Modal>
  )
})
