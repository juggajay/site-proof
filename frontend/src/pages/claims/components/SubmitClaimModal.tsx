import React, { useState } from 'react'
import { X, Mail, Download, Upload } from 'lucide-react'
import type { Claim, SubmitMethod } from '../types'

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Submit Claim</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
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
        </div>

        <div className="flex justify-end p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
})
