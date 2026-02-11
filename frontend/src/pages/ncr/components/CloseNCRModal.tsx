import { useState, memo } from 'react'
import { createPortal } from 'react-dom'
import type { NCR } from '../types'

interface CloseNCRModalProps {
  isOpen: boolean
  ncr: NCR | null
  onClose: () => void
  onSubmit: (ncrId: string, data: { verificationNotes: string; lessonsLearned: string }) => void
  loading: boolean
}

function CloseNCRModalInner({
  isOpen,
  ncr,
  onClose,
  onSubmit,
  loading,
}: CloseNCRModalProps) {
  const [verificationNotes, setVerificationNotes] = useState('')
  const [lessonsLearned, setLessonsLearned] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ncr) return
    onSubmit(ncr.id, { verificationNotes, lessonsLearned })
  }

  const handleClose = () => {
    setVerificationNotes('')
    setLessonsLearned('')
    onClose()
  }

  if (!isOpen || !ncr) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Close NCR {ncr.ncrNumber}</h2>
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

        {ncr.severity === 'major' && ncr.qmApprovedAt && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
            QM Approval granted by {ncr.qmApprovedBy?.fullName || 'Quality Manager'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Verification Notes</label>
            <textarea
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Notes about the verification and closure..."
            />
          </div>
          {/* Feature #474: Lessons Learned Recording */}
          <div>
            <label className="block text-sm font-medium mb-1">Lessons Learned</label>
            <textarea
              value={lessonsLearned}
              onChange={(e) => setLessonsLearned(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="What lessons can be learned from this NCR? How can similar issues be prevented in the future?"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Document insights for continuous improvement and future reference.
            </p>
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
              disabled={loading}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Closing...' : 'Close NCR'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export const CloseNCRModal = memo(CloseNCRModalInner)
