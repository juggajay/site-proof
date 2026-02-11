import React, { useState, useCallback } from 'react'

interface RejectTestModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (testId: string, reason: string) => Promise<void>
  rejectingTestId: string | null
}

export const RejectTestModal = React.memo(function RejectTestModal({
  isOpen,
  onClose,
  onSubmit,
  rejectingTestId,
}: RejectTestModalProps) {
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const handleClose = useCallback(() => {
    setRejectReason('')
    onClose()
  }, [onClose])

  const handleRejectTest = useCallback(async () => {
    if (!rejectingTestId || !rejectReason.trim()) {
      alert('Rejection reason is required')
      return
    }

    setRejecting(true)

    try {
      await onSubmit(rejectingTestId, rejectReason.trim())
      setRejectReason('')
    } catch {
      // Error handled by parent
    } finally {
      setRejecting(false)
    }
  }, [rejectingTestId, rejectReason, onSubmit])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2 text-red-600">Reject Test Verification</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Please provide a reason for rejecting this test result. The engineer will be notified and can re-enter the data.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Rejection Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter the reason for rejection (e.g., incorrect values, missing data, doesn't match certificate)"
              rows={4}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
              disabled={rejecting}
            >
              Cancel
            </button>
            <button
              onClick={handleRejectTest}
              disabled={rejecting || !rejectReason.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {rejecting ? 'Rejecting...' : 'Reject Test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
