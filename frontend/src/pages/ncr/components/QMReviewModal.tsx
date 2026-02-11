import { useState, memo } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { handleApiError } from '@/lib/errorHandling'
import type { NCR } from '../types'

interface QMReviewModalProps {
  isOpen: boolean
  ncr: NCR | null
  onClose: () => void
  onSuccess: () => void
}

function QMReviewModalInner({
  isOpen,
  ncr,
  onClose,
  onSuccess,
}: QMReviewModalProps) {
  const [qmReviewComments, setQmReviewComments] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const handleQmReview = async (action: 'accept' | 'request_revision') => {
    if (!ncr) return

    setSubmittingReview(true)
    try {
      const data = await apiFetch<{ message: string }>(`/api/ncrs/${ncr.id}/qm-review`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          comments: qmReviewComments || undefined,
        }),
      })

      toast({
        title: action === 'accept' ? 'Response Accepted' : 'Revision Requested',
        description: data.message,
      })
      handleClose()
      onSuccess()
    } catch (err) {
      handleApiError(err, 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleClose = () => {
    setQmReviewComments('')
    onClose()
  }

  if (!isOpen || !ncr) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Review NCR Response</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm font-medium text-gray-800">{ncr.ncrNumber}</p>
          <p className="text-sm text-gray-600 mt-1">{ncr.description}</p>
        </div>

        {/* Show submitted response details */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Submitted Response:</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <p className="text-amber-800">The responsible party has submitted a response. Review the root cause analysis and proposed corrective action.</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Review Comments (optional)</label>
          <textarea
            value={qmReviewComments}
            onChange={(e) => setQmReviewComments(e.target.value)}
            placeholder="Add feedback or comments..."
            rows={3}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            disabled={submittingReview}
          >
            Cancel
          </button>
          <button
            onClick={() => handleQmReview('request_revision')}
            disabled={submittingReview}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {submittingReview ? 'Processing...' : 'Request Revision'}
          </button>
          <button
            onClick={() => handleQmReview('accept')}
            disabled={submittingReview}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {submittingReview ? 'Processing...' : 'Accept Response'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export const QMReviewModal = memo(QMReviewModalInner)
