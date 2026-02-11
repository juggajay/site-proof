import { useState } from 'react'

// =====================
// Bulk Delete Modal
// =====================

interface BulkDeleteModalProps {
  isOpen: boolean
  selectedCount: number
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function BulkDeleteModal({ isOpen, selectedCount, onClose, onConfirm }: BulkDeleteModalProps) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await onConfirm()
    } finally {
      setDeleting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Confirm Bulk Deletion</h2>
        <p className="mt-2 text-sm text-gray-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-900">{selectedCount} lot(s)</span>?
        </p>
        <p className="mt-3 text-sm text-red-600">
          This action cannot be undone. All associated data will be permanently deleted.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : `Delete ${selectedCount} Lot(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================
// Bulk Status Update Modal
// =====================

interface BulkStatusModalProps {
  isOpen: boolean
  selectedCount: number
  onClose: () => void
  onConfirm: (status: string) => Promise<void>
}

export function BulkStatusModal({ isOpen, selectedCount, onClose, onConfirm }: BulkStatusModalProps) {
  const [updating, setUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState('in_progress')

  const handleUpdate = async () => {
    if (updating) return
    setUpdating(true)
    try {
      await onConfirm(newStatus)
    } finally {
      setUpdating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Update Lot Status</h2>
        <p className="mt-2 text-sm text-gray-600">
          Update status for{' '}
          <span className="font-semibold text-gray-900">{selectedCount} lot(s)</span>
        </p>
        <div className="mt-4">
          <label htmlFor="bulk-status-select" className="block text-sm font-medium text-gray-700 mb-1">
            New Status
          </label>
          <select
            id="bulk-status-select"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="awaiting_test">Awaiting Test</option>
            <option value="hold_point">Hold Point</option>
            <option value="ncr_raised">NCR Raised</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={updating}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {updating ? 'Updating...' : 'Update Status'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================
// Bulk Assign Subcontractor Modal
// =====================

interface BulkAssignModalProps {
  isOpen: boolean
  selectedCount: number
  subcontractors: { id: string; companyName: string }[]
  onClose: () => void
  onConfirm: (subcontractorId: string) => Promise<void>
}

export function BulkAssignModal({ isOpen, selectedCount, subcontractors, onClose, onConfirm }: BulkAssignModalProps) {
  const [assigning, setAssigning] = useState(false)
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>('')

  const handleAssign = async () => {
    if (assigning) return
    setAssigning(true)
    try {
      await onConfirm(selectedSubcontractorId)
    } finally {
      setAssigning(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Assign Subcontractor</h2>
        <p className="text-sm text-gray-600 mb-4">
          Assign {selectedCount} selected lot(s) to a subcontractor.
        </p>
        <div className="mb-4">
          <label htmlFor="bulk-subcontractor" className="block text-sm font-medium text-gray-700 mb-1">
            Subcontractor
          </label>
          <select
            id="bulk-subcontractor"
            value={selectedSubcontractorId}
            onChange={(e) => setSelectedSubcontractorId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">-- Unassign --</option>
            {subcontractors.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.companyName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={assigning}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={assigning}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {assigning ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}
