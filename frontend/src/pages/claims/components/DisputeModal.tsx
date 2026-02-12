import React, { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

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
    <Modal onClose={onClose} alert className="max-w-md">
      <ModalHeader>
        <span className="text-red-600">Mark Claim as Disputed</span>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-medium">This action will mark the claim as disputed.</p>
              <p className="mt-1">The claim will remain in disputed status until resolved. Please provide details about the dispute.</p>
            </div>
          </div>

          <div>
            <Label>Dispute Notes <span className="text-red-500">*</span></Label>
            <Textarea
              value={disputeNotes}
              onChange={(e) => setDisputeNotes(e.target.value)}
              placeholder="Describe the reason for the dispute, including any specific items or amounts in question..."
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleDispute}
          disabled={disputing || !disputeNotes.trim()}
        >
          {disputing ? 'Marking...' : 'Mark as Disputed'}
        </Button>
      </ModalFooter>
    </Modal>
  )
})
