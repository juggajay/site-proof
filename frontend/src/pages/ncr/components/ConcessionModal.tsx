import { useState, memo } from 'react'
import { createPortal } from 'react-dom'
import type { NCR } from '../types'

interface ConcessionModalProps {
  isOpen: boolean
  ncr: NCR | null
  onClose: () => void
  onSubmit: (ncrId: string, data: {
    concessionJustification: string
    concessionRiskAssessment: string
    clientApprovalDocId?: string
    verificationNotes?: string
  }) => void
  loading: boolean
}

function ConcessionModalInner({
  isOpen,
  ncr,
  onClose,
  onSubmit,
  loading,
}: ConcessionModalProps) {
  const [justification, setJustification] = useState('')
  const [riskAssessment, setRiskAssessment] = useState('')
  const [verificationNotes, setVerificationNotes] = useState('')
  const [clientApprovalConfirmed, setClientApprovalConfirmed] = useState(false)
  const [clientApprovalReference, setClientApprovalReference] = useState('')

  const isMajor = ncr?.severity === 'major'
  const requiresClientApproval = isMajor

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ncr) return
    if (requiresClientApproval && !clientApprovalConfirmed) {
      return
    }
    onSubmit(ncr.id, {
      concessionJustification: justification,
      concessionRiskAssessment: riskAssessment,
      verificationNotes: verificationNotes || undefined,
      clientApprovalDocId: clientApprovalReference || undefined,
    })
  }

  const handleClose = () => {
    setJustification('')
    setRiskAssessment('')
    setVerificationNotes('')
    setClientApprovalConfirmed(false)
    setClientApprovalReference('')
    onClose()
  }

  const isFormValid = justification && riskAssessment && (!requiresClientApproval || clientApprovalConfirmed)

  if (!isOpen || !ncr) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Close NCR with Concession</h2>
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
        <p className="text-sm text-muted-foreground mb-4">
          Use this when full rectification is not possible and a concession is required.
        </p>

        {/* NCR Info */}
        <div className="mb-4 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-sm">
          <div className="font-medium">{ncr.ncrNumber}</div>
          <div className="text-muted-foreground">{ncr.description}</div>
          <div className="mt-1">
            <span className={`px-2 py-0.5 rounded text-xs ${
              ncr.severity === 'major' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {ncr.severity.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Warning for Major NCRs */}
        {isMajor && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-sm flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <strong>Major NCR - Client Approval Required</strong>
              <p className="mt-1">Closing a major NCR with concession requires documented client approval.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Justification */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Concession Justification *
            </label>
            <p className="text-xs text-muted-foreground mb-1">
              Explain why full rectification is not possible
            </p>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Describe why the non-conformance cannot be fully rectified..."
              required
            />
          </div>

          {/* Risk Assessment */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Risk Assessment *
            </label>
            <p className="text-xs text-muted-foreground mb-1">
              Assess the risk of accepting this concession
            </p>
            <textarea
              value={riskAssessment}
              onChange={(e) => setRiskAssessment(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Describe the risk implications, mitigation measures, and impact on quality/safety..."
              required
            />
          </div>

          {/* Client Approval Section for Major NCRs */}
          {requiresClientApproval && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
              <label className="block text-sm font-medium mb-2 text-amber-900">
                Client Approval *
              </label>

              <div className="space-y-3">
                {/* Approval Reference/Document ID */}
                <div>
                  <label className="block text-xs text-amber-800 mb-1">
                    Approval Document Reference
                  </label>
                  <input
                    type="text"
                    value={clientApprovalReference}
                    onChange={(e) => setClientApprovalReference(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white"
                    placeholder="e.g., Email ref, Letter ID, Document number..."
                  />
                </div>

                {/* Confirmation Checkbox */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientApprovalConfirmed}
                    onChange={(e) => setClientApprovalConfirmed(e.target.checked)}
                    className="mt-1 rounded border-amber-400"
                  />
                  <span className="text-sm text-amber-900">
                    I confirm that the client has been notified of this concession and has provided documented approval to proceed.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Verification Notes (Optional) */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Verification Notes
            </label>
            <textarea
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              placeholder="Any additional verification notes..."
            />
          </div>

          {/* Status Info */}
          <div className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-sm">
            <span className="text-muted-foreground">NCR will be closed with status: </span>
            <span className="font-medium text-green-700">CLOSED_CONCESSION</span>
          </div>

          {/* Buttons */}
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
              disabled={loading || !isFormValid}
              className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'Closing...' : 'Close with Concession'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export const ConcessionModal = memo(ConcessionModalInner)
