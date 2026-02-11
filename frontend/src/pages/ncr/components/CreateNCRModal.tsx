import { useState, useEffect, memo } from 'react'
import { createPortal } from 'react-dom'
import { getAuthToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'

interface CreateNCRModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    description: string
    category: string
    severity: string
    specificationReference?: string
    lotIds?: string[]
    dueDate?: string
  }) => void
  loading: boolean
  projectId?: string
}

function CreateNCRModalInner({
  isOpen,
  onClose,
  onSubmit,
  loading,
  projectId,
}: CreateNCRModalProps) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('minor')
  const [specificationReference, setSpecificationReference] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([])
  const [lots, setLots] = useState<Array<{ id: string; lotNumber: string; description: string }>>([])
  const [lotsLoading, setLotsLoading] = useState(true)
  const token = getAuthToken()

  // Fetch lots for this project
  useEffect(() => {
    const fetchLots = async () => {
      if (!projectId) {
        setLotsLoading(false)
        return
      }
      try {
        const data = await apiFetch<{ lots: Array<{ id: string; lotNumber: string; description: string }> }>(`/api/lots?projectId=${projectId}`)
        setLots(data.lots || [])
      } catch (err) {
        console.error('Failed to fetch lots:', err)
      } finally {
        setLotsLoading(false)
      }
    }
    fetchLots()
  }, [projectId, token])

  const handleLotToggle = (lotId: string) => {
    setSelectedLotIds(prev =>
      prev.includes(lotId)
        ? prev.filter(id => id !== lotId)
        : [...prev, lotId]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      description,
      category,
      severity,
      specificationReference,
      lotIds: selectedLotIds.length > 0 ? selectedLotIds : undefined,
      dueDate: dueDate || undefined,
    })
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Raise Non-Conformance Report</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ncr-description" className="block text-sm font-medium mb-1">Description *</label>
            <textarea
              id="ncr-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              required
            />
          </div>
          <div>
            <label htmlFor="ncr-category" className="block text-sm font-medium mb-1">Category *</label>
            <select
              id="ncr-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            >
              <option value="">Select category</option>
              <option value="materials">Materials</option>
              <option value="workmanship">Workmanship</option>
              <option value="documentation">Documentation</option>
              <option value="process">Process</option>
              <option value="design">Design</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Affected Lots</label>
            {lotsLoading ? (
              <p className="text-sm text-muted-foreground">Loading lots...</p>
            ) : lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lots available</p>
            ) : (
              <div className="border rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                {lots.map((lot) => (
                  <label key={lot.id} className="flex items-center gap-2 p-1 hover:bg-muted/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLotIds.includes(lot.id)}
                      onChange={() => handleLotToggle(lot.id)}
                      className="rounded"
                    />
                    <span className="text-sm">
                      <span className="font-medium">{lot.lotNumber}</span>
                      {lot.description && <span className="text-muted-foreground"> - {lot.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {selectedLotIds.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedLotIds.length} lot{selectedLotIds.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Severity *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="severity"
                  value="minor"
                  checked={severity === 'minor'}
                  onChange={(e) => setSeverity(e.target.value)}
                />
                <span>Minor</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="severity"
                  value="major"
                  checked={severity === 'major'}
                  onChange={(e) => setSeverity(e.target.value)}
                />
                <span className="text-red-600 font-medium">Major</span>
              </label>
            </div>
            {severity === 'major' && (
              <p className="text-amber-600 text-sm mt-1">
                Major NCRs require Quality Manager approval before closure.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="ncr-spec-reference" className="block text-sm font-medium mb-1">Specification Reference</label>
            <input
              id="ncr-spec-reference"
              type="text"
              value={specificationReference}
              onChange={(e) => setSpecificationReference(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., MRTS05, Q6-2021"
            />
          </div>
          <div>
            <label htmlFor="ncr-due-date" className="block text-sm font-medium mb-1">Due Date</label>
            <input
              id="ncr-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !description || !category}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Raise NCR'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export const CreateNCRModal = memo(CreateNCRModalInner)
