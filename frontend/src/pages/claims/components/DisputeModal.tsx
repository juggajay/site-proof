import React, { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'

interface DisputeModalProps {
  claimId: string
  onClose: () => void
  onDisputed: (claimId: string, notes: string) => void
}

export const DisputeModal = React.memo(function DisputeModal({
  claimId,
  onClose,
  onDisputed,
}: DisputeModalProps) {
  const [disputeNotes, setDisputeNotes] = useState('')
  const [disputing, setDisputing] = useState(false)

  const handleDispute = async () => {
    if (!disputeNotes.trim()) {
      alert('Please enter dispute notes')
      return
    }
    setDisputing(true)

    try {
      onDisputed(claimId, disputeNotes.trim())
    } finally {
      setDisputing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-red-600">Mark Claim as Disputed</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-medium">This action will mark the claim as disputed.</p>
              <p className="mt-1">The claim will remain in disputed status until resolved. Please provide details about the dispute.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Dispute Notes <span className="text-red-500">*</span></label>
            <textarea
              value={disputeNotes}
              onChange={(e) => setDisputeNotes(e.target.value)}
              placeholder="Describe the reason for the dispute, including any specific items or amounts in question..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[120px] resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleDispute}
            disabled={disputing || !disputeNotes.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {disputing ? 'Marking...' : 'Mark as Disputed'}
          </button>
        </div>
      </div>
    </div>
  )
})
