import { useState } from 'react'

interface MarkAsFailedModalProps {
  isOpen: boolean
  itemDescription: string
  onClose: () => void
  onSubmit: (description: string, category: string, severity: string) => Promise<void>
  isSubmitting: boolean
}

export function MarkAsFailedModal({
  isOpen,
  itemDescription,
  onClose,
  onSubmit,
  isSubmitting
}: MarkAsFailedModalProps) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('workmanship')
  const [severity, setSeverity] = useState('minor')

  const handleSubmit = async () => {
    if (!description.trim()) return
    await onSubmit(description.trim(), category, severity)
    // Reset state after successful submission
    setDescription('')
    setCategory('workmanship')
    setSeverity('minor')
  }

  const handleClose = () => {
    setDescription('')
    setCategory('workmanship')
    setSeverity('minor')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400">
            <span className="text-xl font-bold">&#10007;</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Mark as Failed</h2>
            <p className="text-sm text-muted-foreground">This will raise an NCR</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <p className="text-sm font-medium">{itemDescription}</p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">
              NCR Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the non-conformance..."
              className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent resize-none"
              rows={3}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
            >
              <option value="workmanship">Workmanship</option>
              <option value="material">Material</option>
              <option value="design">Design</option>
              <option value="documentation">Documentation</option>
              <option value="process">Process</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Severity
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
            >
              <option value="minor">Minor</option>
              <option value="major">Major (requires QM approval to close)</option>
            </select>
          </div>
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
            disabled={isSubmitting || !description.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating NCR...' : 'Mark as Failed & Raise NCR'}
          </button>
        </div>
      </div>
    </div>
  )
}
