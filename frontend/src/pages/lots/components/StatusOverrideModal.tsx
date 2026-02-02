import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { lotStatusColors } from '../constants'

export interface StatusOption {
  value: string
  label: string
}

interface StatusOverrideModalProps {
  isOpen: boolean
  currentStatus: string
  validStatuses: StatusOption[]
  onClose: () => void
  onSubmit: (newStatus: string, reason: string) => Promise<void>
  isSubmitting: boolean
}

export function StatusOverrideModal({
  isOpen,
  currentStatus,
  validStatuses,
  onClose,
  onSubmit,
  isSubmitting
}: StatusOverrideModalProps) {
  const [selectedStatus, setSelectedStatus] = useState('')
  const [reason, setReason] = useState('')

  const handleSubmit = async () => {
    await onSubmit(selectedStatus, reason)
    setSelectedStatus('')
    setReason('')
  }

  const handleClose = () => {
    setSelectedStatus('')
    setReason('')
    onClose()
  }

  if (!isOpen) return null

  // Filter out current status from options
  const availableStatuses = validStatuses.filter(s => s.value !== currentStatus)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 text-purple-600">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Override Status</h2>
            <p className="text-sm text-muted-foreground">Manually change the lot status</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Current Status
            </label>
            <div className={`px-3 py-2 rounded border ${lotStatusColors[currentStatus] || 'bg-gray-100'}`}>
              {currentStatus.replace('_', ' ')}
            </div>
          </div>

          <div>
            <label htmlFor="override-status" className="block text-sm font-medium mb-1">
              New Status <span className="text-red-500">*</span>
            </label>
            <select
              id="override-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background"
            >
              <option value="">Select new status...</option>
              {availableStatuses.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="override-reason" className="block text-sm font-medium mb-1">
              Reason for Override <span className="text-red-500">*</span>
            </label>
            <textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you are overriding the status..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This reason will be recorded in the lot history for audit purposes.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedStatus || !reason.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Overriding...' : 'Override Status'}
          </button>
        </div>
      </div>
    </div>
  )
}
