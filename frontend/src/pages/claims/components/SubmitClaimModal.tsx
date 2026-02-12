import React, { useState } from 'react'
import { Mail, Download, Upload } from 'lucide-react'
import type { Claim, SubmitMethod } from '../types'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'

interface SubmitClaimModalProps {
  claim: Claim
  onClose: () => void
  onSubmitted: (claimId: string, method: SubmitMethod) => void
}

export const SubmitClaimModal = React.memo(function SubmitClaimModal({
  claim,
  onClose,
  onSubmitted,
}: SubmitClaimModalProps) {
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (method: SubmitMethod) => {
    setSubmitting(true)
    try {
      onSubmitted(claim.id, method)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>Submit Claim</ModalHeader>
      <ModalBody>
        <p className="text-muted-foreground mb-6">
          Choose how you would like to submit this progress claim:
        </p>

        <div className="space-y-3">
          <button
            onClick={() => handleSubmit('email')}
            disabled={submitting}
            className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
          >
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="font-medium">Email</div>
              <div className="text-sm text-muted-foreground">Send claim via email to client</div>
            </div>
          </button>

          <button
            onClick={() => handleSubmit('download')}
            disabled={submitting}
            className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
          >
            <div className="p-2 bg-green-100 rounded-lg">
              <Download className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="font-medium">Download</div>
              <div className="text-sm text-muted-foreground">Download package for manual submission</div>
            </div>
          </button>

          <button
            onClick={() => handleSubmit('portal')}
            disabled={submitting}
            className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
          >
            <div className="p-2 bg-purple-100 rounded-lg">
              <Upload className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="font-medium">Portal Upload</div>
              <div className="text-sm text-muted-foreground">Upload directly to client portal</div>
            </div>
          </button>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  )
})
