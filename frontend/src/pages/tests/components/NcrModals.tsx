import React, { useState, useCallback } from 'react'
import type { FailedTestForNcr, NcrFormData } from '../types'
import { INITIAL_NCR_FORM_DATA } from '../constants'

// Feature #210: NCR Prompt Modal for Failed Test
interface NcrPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onRaiseNcr: () => void
  failedTestForNcr: FailedTestForNcr | null
}

export const NcrPromptModal = React.memo(function NcrPromptModal({
  isOpen,
  onClose,
  onRaiseNcr,
  failedTestForNcr,
}: NcrPromptModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-red-600">Test Failed</h2>
              <p className="text-sm text-muted-foreground">
                {failedTestForNcr?.testType} result: {failedTestForNcr?.resultValue}
              </p>
            </div>
          </div>
          <p className="text-sm mb-4">
            This test result has failed. Would you like to raise a Non-Conformance Report (NCR) to document and track this issue?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
            >
              No, Skip NCR
            </button>
            <button
              onClick={onRaiseNcr}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              Yes, Raise NCR
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

// Feature #210: NCR Creation Modal
interface NcrCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (ncrFormData: NcrFormData) => Promise<void>
  failedTestForNcr: FailedTestForNcr | null
  initialDescription: string
}

export const NcrCreateModal = React.memo(function NcrCreateModal({
  isOpen,
  onClose,
  onSubmit,
  failedTestForNcr,
  initialDescription,
}: NcrCreateModalProps) {
  const [ncrFormData, setNcrFormData] = useState<NcrFormData>({
    ...INITIAL_NCR_FORM_DATA,
    description: initialDescription,
  })
  const [creatingNcr, setCreatingNcr] = useState(false)

  // Sync the initial description when it changes (new failed test)
  React.useEffect(() => {
    setNcrFormData(prev => ({ ...prev, description: initialDescription }))
  }, [initialDescription])

  const handleClose = useCallback(() => {
    setNcrFormData({ ...INITIAL_NCR_FORM_DATA })
    onClose()
  }, [onClose])

  const handleSubmit = useCallback(async () => {
    if (!ncrFormData.description.trim()) {
      alert('NCR description is required')
      return
    }

    setCreatingNcr(true)

    try {
      await onSubmit(ncrFormData)
      setNcrFormData({ ...INITIAL_NCR_FORM_DATA })
    } catch {
      // Error handled by parent
    } finally {
      setCreatingNcr(false)
    }
  }, [ncrFormData, onSubmit])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2">Raise NCR from Test Failure</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create a Non-Conformance Report for the failed test result.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Description *</label>
              <textarea
                value={ncrFormData.description}
                onChange={(e) => setNcrFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the non-conformance..."
                rows={4}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <select
                value={ncrFormData.category}
                onChange={(e) => setNcrFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="materials">Materials</option>
                <option value="workmanship">Workmanship</option>
                <option value="documentation">Documentation</option>
                <option value="process">Process</option>
                <option value="design">Design</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Severity *</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="severity"
                    value="minor"
                    checked={ncrFormData.severity === 'minor'}
                    onChange={(e) => setNcrFormData(prev => ({ ...prev, severity: e.target.value }))}
                  />
                  <span>Minor</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="severity"
                    value="major"
                    checked={ncrFormData.severity === 'major'}
                    onChange={(e) => setNcrFormData(prev => ({ ...prev, severity: e.target.value }))}
                  />
                  <span className="text-red-600 font-medium">Major</span>
                </label>
              </div>
              {ncrFormData.severity === 'major' && (
                <p className="text-amber-600 text-xs mt-1">
                  Major NCRs require Quality Manager approval before closure.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Specification Reference</label>
              <input
                type="text"
                value={ncrFormData.specificationReference}
                onChange={(e) => setNcrFormData(prev => ({ ...prev, specificationReference: e.target.value }))}
                placeholder="e.g., MRTS05, AS 1289"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            {failedTestForNcr?.lotId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Linked Lot:</span> This NCR will be automatically linked to the lot associated with this test result.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
              disabled={creatingNcr}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={creatingNcr || !ncrFormData.description.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {creatingNcr ? 'Creating NCR...' : 'Raise NCR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
