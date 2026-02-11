import { useState, memo } from 'react'
import { createPortal } from 'react-dom'
import { getAuthToken } from '@/lib/auth'
import { apiFetch, apiUrl } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { handleApiError } from '@/lib/errorHandling'
import type { NCR } from '../types'

interface RectifyNCRModalProps {
  isOpen: boolean
  ncr: NCR | null
  projectId?: string
  onClose: () => void
  onSuccess: () => void
}

function RectifyNCRModalInner({
  isOpen,
  ncr,
  projectId,
  onClose,
  onSuccess,
}: RectifyNCRModalProps) {
  const token = getAuthToken()
  const [rectificationNotes, setRectificationNotes] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [uploadingEvidence, setUploadingEvidence] = useState(false)
  const [submittingRectification, setSubmittingRectification] = useState(false)

  const handleEvidenceUpload = async (file: File, evidenceType: string) => {
    if (!ncr) return

    setUploadingEvidence(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', ncr.project?.id || projectId || '')

      const uploadResponse = await fetch(apiUrl('/api/documents/upload'), {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file')
      }

      const uploadData = await uploadResponse.json()

      await apiFetch(`/api/ncrs/${ncr.id}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          documentId: uploadData.document?.id,
          evidenceType,
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
          projectId: ncr.project?.id || projectId,
        }),
      })

      toast({
        title: 'Evidence Uploaded',
        description: `${file.name} has been added as ${evidenceType} evidence`,
      })

      setEvidenceFiles(prev => [...prev, file])
    } catch (err) {
      handleApiError(err, 'Failed to upload evidence')
    } finally {
      setUploadingEvidence(false)
    }
  }

  const handleSubmitRectification = async () => {
    if (!ncr) return

    setSubmittingRectification(true)
    try {
      await apiFetch(`/api/ncrs/${ncr.id}/submit-for-verification`, {
        method: 'POST',
        body: JSON.stringify({ rectificationNotes }),
      })

      toast({
        title: 'Rectification Submitted',
        description: 'NCR has been submitted for verification',
      })
      handleClose()
      onSuccess()
    } catch (err) {
      handleApiError(err, 'Failed to submit rectification')
    } finally {
      setSubmittingRectification(false)
    }
  }

  const handleClose = () => {
    setRectificationNotes('')
    setEvidenceFiles([])
    onClose()
  }

  if (!isOpen || !ncr) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Submit Rectification Evidence</h2>
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

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-800">{ncr.ncrNumber}</p>
          <p className="text-sm text-blue-700 mt-1">{ncr.description}</p>
        </div>

        {/* Evidence Upload Section */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Upload Evidence</p>

          {/* Photo Evidence */}
          <div className="mb-3">
            <label className="block text-sm text-gray-600 mb-1">Photos (Rectification Evidence)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = e.target.files
                if (files) {
                  Array.from(files).forEach(file => handleEvidenceUpload(file, 'photo'))
                }
              }}
              disabled={uploadingEvidence}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Re-test Certificate */}
          <div className="mb-3">
            <label className="block text-sm text-gray-600 mb-1">Re-test Certificates (PDF)</label>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={(e) => {
                const files = e.target.files
                if (files) {
                  Array.from(files).forEach(file => handleEvidenceUpload(file, 'retest_certificate'))
                }
              }}
              disabled={uploadingEvidence}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {uploadingEvidence && (
            <p className="text-sm text-amber-600">Uploading evidence...</p>
          )}

          {/* Uploaded files list */}
          {evidenceFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-gray-500">Uploaded Evidence:</p>
              {evidenceFiles.map((file, index) => (
                <p key={index} className="text-xs text-green-600">✓ {file.name}</p>
              ))}
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Rectification Notes</label>
          <textarea
            value={rectificationNotes}
            onChange={(e) => setRectificationNotes(e.target.value)}
            placeholder="Describe the corrective actions taken..."
            rows={4}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Please upload at least one piece of evidence (photo or re-test certificate) before submitting for verification.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            disabled={submittingRectification}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitRectification}
            disabled={submittingRectification || evidenceFiles.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            title={evidenceFiles.length === 0 ? 'Please upload at least one piece of evidence' : 'Submit for verification'}
          >
            {submittingRectification ? 'Submitting...' : 'Submit for Verification'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export const RectifyNCRModal = memo(RectifyNCRModalInner)
