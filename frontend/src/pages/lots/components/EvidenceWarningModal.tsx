interface EvidenceWarning {
  checklistItemId: string
  itemDescription: string
  evidenceType: string
  currentNotes: string | null
}

interface EvidenceWarningModalProps {
  isOpen: boolean
  warning: EvidenceWarning | null
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
}

export function EvidenceWarningModal({
  isOpen,
  warning,
  onClose,
  onConfirm,
  isLoading
}: EvidenceWarningModalProps) {
  if (!isOpen || !warning) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Evidence Required</h2>
            <p className="text-sm text-muted-foreground">This item requires {warning.evidenceType.toLowerCase()} evidence</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">{warning.itemDescription}</p>
          <p className="text-xs text-amber-600 mt-1">
            Warning: No {warning.evidenceType.toLowerCase()} has been attached to this item yet.
          </p>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          You can still complete this item without evidence, but it is recommended to attach the required {warning.evidenceType.toLowerCase()} for quality assurance purposes.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border rounded-lg hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {isLoading ? 'Completing...' : 'Complete Anyway'}
          </button>
        </div>
      </div>
    </div>
  )
}
