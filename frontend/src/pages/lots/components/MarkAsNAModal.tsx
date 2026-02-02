import { useState } from 'react'

interface MarkAsNAModalProps {
  isOpen: boolean
  itemDescription: string
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
  isSubmitting: boolean
}

export function MarkAsNAModal({
  isOpen,
  itemDescription,
  onClose,
  onSubmit,
  isSubmitting
}: MarkAsNAModalProps) {
  const [naReason, setNaReason] = useState('')

  const handleSubmit = async () => {
    await onSubmit(naReason)
    setNaReason('')
  }

  const handleClose = () => {
    setNaReason('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            <span className="text-xl font-bold">—</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Mark as Not Applicable</h2>
            <p className="text-sm text-muted-foreground">This item will be skipped</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">{itemDescription}</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Reason for N/A <span className="text-red-500">*</span>
          </label>
          <textarea
            value={naReason}
            onChange={(e) => setNaReason(e.target.value)}
            placeholder="Enter reason why this item is not applicable..."
            className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent resize-none"
            rows={3}
            autoFocus
          />
          <p className="text-xs text-muted-foreground mt-1">
            A reason is required to mark an item as N/A
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !naReason.trim()}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Mark as N/A'}
          </button>
        </div>
      </div>
    </div>
  )
}
