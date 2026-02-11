import { useState, memo } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { handleApiError } from '@/lib/errorHandling'
import type { NCR } from '../types'

interface NotifyClientModalProps {
  isOpen: boolean
  ncr: NCR | null
  onClose: () => void
  onSuccess: () => void
}

function NotifyClientModalInner({
  isOpen,
  ncr,
  onClose,
  onSuccess,
}: NotifyClientModalProps) {
  const [notifyClientEmail, setNotifyClientEmail] = useState('')
  const [notifyClientMessage, setNotifyClientMessage] = useState('')
  const [notifyingClient, setNotifyingClient] = useState(false)

  const handleNotifyClient = async () => {
    if (!ncr) return

    setNotifyingClient(true)
    try {
      await apiFetch(`/api/ncrs/${ncr.id}/notify-client`, {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail: notifyClientEmail || undefined,
          additionalMessage: notifyClientMessage || undefined,
        }),
      })

      toast({
        title: 'Client Notified',
        description: `Client notification sent for ${ncr.ncrNumber}`,
      })
      handleClose()
      onSuccess()
    } catch (err) {
      handleApiError(err, 'Failed to notify client')
    } finally {
      setNotifyingClient(false)
    }
  }

  const handleClose = () => {
    setNotifyClientEmail('')
    setNotifyClientMessage('')
    onClose()
  }

  if (!isOpen || !ncr) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Notify Client - Major NCR</h2>
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

        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">Major NCR: {ncr.ncrNumber}</p>
          <p className="text-sm text-red-700 mt-1">{ncr.description.substring(0, 100)}{ncr.description.length > 100 ? '...' : ''}</p>
          <p className="text-xs text-red-600 mt-2">
            Affected Lots: {ncr.ncrLots.map(nl => nl.lot.lotNumber).join(', ') || 'None'}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Client Email (optional)</label>
            <input
              type="email"
              value={notifyClientEmail}
              onChange={(e) => setNotifyClientEmail(e.target.value)}
              placeholder="Enter client email address"
              className="w-full border rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Leave blank to record notification without sending email</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Additional Message (optional)</label>
            <textarea
              value={notifyClientMessage}
              onChange={(e) => setNotifyClientMessage(e.target.value)}
              placeholder="Add any additional context for the client..."
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
          <p className="text-sm text-blue-800 font-medium">Notification Package will include:</p>
          <ul className="text-xs text-blue-700 mt-1 list-disc list-inside">
            <li>NCR Number and Description</li>
            <li>Category and Severity</li>
            <li>Affected Lots</li>
            <li>Specification Reference</li>
            <li>Raised By and Date</li>
          </ul>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            disabled={notifyingClient}
          >
            Cancel
          </button>
          <button
            onClick={handleNotifyClient}
            disabled={notifyingClient}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {notifyingClient ? 'Sending...' : 'Send Notification'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export const NotifyClientModal = memo(NotifyClientModalInner)
