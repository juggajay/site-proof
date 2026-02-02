import { useState } from 'react'

interface WitnessPointModalProps {
  isOpen: boolean
  itemDescription: string
  onClose: () => void
  onSubmit: (witnessPresent: boolean, witnessName?: string, witnessCompany?: string) => Promise<void>
  isSubmitting: boolean
}

export function WitnessPointModal({
  isOpen,
  itemDescription,
  onClose,
  onSubmit,
  isSubmitting
}: WitnessPointModalProps) {
  const [witnessPresent, setWitnessPresent] = useState<boolean | null>(null)
  const [witnessName, setWitnessName] = useState('')
  const [witnessCompany, setWitnessCompany] = useState('')

  const handleSubmit = async () => {
    if (witnessPresent === null) return

    await onSubmit(
      witnessPresent,
      witnessPresent ? witnessName.trim() : undefined,
      witnessPresent ? witnessCompany.trim() : undefined
    )

    // Reset state after successful submit
    setWitnessPresent(null)
    setWitnessName('')
    setWitnessCompany('')
  }

  const handleClose = () => {
    setWitnessPresent(null)
    setWitnessName('')
    setWitnessCompany('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400">
            <span className="text-xl font-bold">W</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Complete Witness Point</h2>
            <p className="text-sm text-muted-foreground">Record witness attendance</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm font-medium">{itemDescription}</p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Was the client witness present? <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWitnessPresent(true)}
                className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                  witnessPresent === true
                    ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-400'
                    : 'hover:bg-muted'
                }`}
              >
                Yes, witness was present
              </button>
              <button
                type="button"
                onClick={() => setWitnessPresent(false)}
                className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                  witnessPresent === false
                    ? 'bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900/30 dark:border-orange-600 dark:text-orange-400'
                    : 'hover:bg-muted'
                }`}
              >
                No, notification given
              </button>
            </div>
          </div>

          {witnessPresent === true && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Witness Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={witnessName}
                  onChange={(e) => setWitnessName(e.target.value)}
                  placeholder="Enter witness name..."
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Witness Company/Organisation
                </label>
                <input
                  type="text"
                  value={witnessCompany}
                  onChange={(e) => setWitnessCompany(e.target.value)}
                  placeholder="e.g., Client Name, Superintendent Firm..."
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                />
              </div>
            </>
          )}

          {witnessPresent === false && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-700 dark:text-orange-400">
                <strong>Note:</strong> The item will be marked as complete with a record that notification was given but the witness was not present.
              </p>
            </div>
          )}
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
            disabled={isSubmitting || witnessPresent === null || (witnessPresent && !witnessName.trim())}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Complete Witness Point'}
          </button>
        </div>
      </div>
    </div>
  )
}
