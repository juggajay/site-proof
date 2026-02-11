import { useState, memo } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import type { NCR } from '../types'

interface RejectRectificationModalProps {
  isOpen: boolean
  ncr: NCR | null
  onClose: () => void
  onSuccess: () => void
}

function RejectRectificationModalInner({
  isOpen,
  ncr,
  onClose,
  onSuccess,
}: RejectRectificationModalProps) {
  const [rejectFeedback, setRejectFeedback] = useState('')
  const [rejectingRectification, setRejectingRectification] = useState(false)

  const handleRejectRectification = async () => {
    if (!ncr || !rejectFeedback.trim()) {
      toast({
        title: 'Error',
        description: 'Feedback is required when rejecting rectification',
        variant: 'error',
      })
      return
    }

    setRejectingRectification(true)
    try {
      await apiFetch(`/api/ncrs/${ncr.id}/reject-rectification`, {
        method: 'POST',
        body: JSON.stringify({ feedback: rejectFeedback }),
      })

      toast({
        title: 'Rectification Rejected',
        description: 'NCR has been returned to rectification status and responsible party notified',
      })
      handleClose()
      onSuccess()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to reject rectification',
        variant: 'error',
      })
    } finally {
      setRejectingRectification(false)
    }
  }

  const handleClose = () => {
    setRejectFeedback('')
    onClose()
  }

  if (!isOpen || !ncr) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-red-600">Reject Rectification</h2>
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

        <p className="text-sm text-gray-600 mb-4">
          The rectification will be rejected and returned to the responsible party for additional work.
          Please provide feedback explaining what needs to be improved.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Feedback / Issues Found *</label>
          <textarea
            value={rejectFeedback}
            onChange={(e) => setRejectFeedback(e.target.value)}
            placeholder="Describe the issues with the rectification and what needs to be addressed..."
            rows={4}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            disabled={rejectingRectification}
          >
            Cancel
          </button>
          <button
            onClick={handleRejectRectification}
            disabled={rejectingRectification || !rejectFeedback.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {rejectingRectification ? 'Rejecting...' : 'Reject Rectification'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export const RejectRectificationModal = memo(RejectRectificationModalInner)
