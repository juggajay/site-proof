import { useState, memo } from 'react'
import { createPortal } from 'react-dom'
import type { NCR } from '../types'

interface RespondNCRModalProps {
  isOpen: boolean
  ncr: NCR | null
  onClose: () => void
  onSubmit: (ncrId: string, data: {
    rootCauseCategory: string
    rootCauseDescription: string
    proposedCorrectiveAction: string
  }) => void
  loading: boolean
}

function RespondNCRModalInner({
  isOpen,
  ncr,
  onClose,
  onSubmit,
  loading,
}: RespondNCRModalProps) {
  const [rootCauseCategory, setRootCauseCategory] = useState('')
  const [rootCauseDescription, setRootCauseDescription] = useState('')
  const [proposedCorrectiveAction, setProposedCorrectiveAction] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ncr) return
    onSubmit(ncr.id, { rootCauseCategory, rootCauseDescription, proposedCorrectiveAction })
  }

  const handleClose = () => {
    setRootCauseCategory('')
    setRootCauseDescription('')
    setProposedCorrectiveAction('')
    onClose()
  }

  if (!isOpen || !ncr) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Respond to NCR {ncr.ncrNumber}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-sm">
          <span className="font-medium">Issue:</span> {ncr.description}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="root-cause-category" className="block text-sm font-medium mb-1">Root Cause Category *</label>
            <select
              id="root-cause-category"
              value={rootCauseCategory}
              onChange={(e) => setRootCauseCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            >
              <option value="">Select root cause category</option>
              <option value="human_error">Human Error</option>
              <option value="equipment">Equipment</option>
              <option value="materials">Materials</option>
              <option value="process">Process</option>
              <option value="training">Training</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="root-cause-description" className="block text-sm font-medium mb-1">Root Cause Description *</label>
            <textarea
              id="root-cause-description"
              value={rootCauseDescription}
              onChange={(e) => setRootCauseDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Describe the root cause of this non-conformance..."
              required
            />
          </div>
          <div>
            <label htmlFor="proposed-corrective-action" className="block text-sm font-medium mb-1">Proposed Corrective Action *</label>
            <textarea
              id="proposed-corrective-action"
              value={proposedCorrectiveAction}
              onChange={(e) => setProposedCorrectiveAction(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Describe the proposed corrective action to address this issue..."
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !rootCauseCategory || !rootCauseDescription || !proposedCorrectiveAction}
              className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Response'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export const RespondNCRModal = memo(RespondNCRModalInner)
