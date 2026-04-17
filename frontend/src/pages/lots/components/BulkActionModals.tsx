import { useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter, AlertModalHeader, AlertModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Label } from '@/components/ui/label'

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
    <Modal alert onClose={onClose}>
      <AlertModalHeader>Confirm Bulk Deletion</AlertModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-foreground">{selectedCount} lot(s)</span>?
        </p>
        <p className="mt-3 text-sm text-red-600">
          This action cannot be undone. All associated data will be permanently deleted.
        </p>
      </ModalBody>
      <AlertModalFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={deleting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : `Delete ${selectedCount} Lot(s)`}
        </Button>
      </AlertModalFooter>
    </Modal>
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
    <Modal onClose={onClose}>
      <ModalHeader>Update Lot Status</ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground">
          Update status for{' '}
          <span className="font-semibold text-foreground">{selectedCount} lot(s)</span>
        </p>
        <div className="mt-4">
          <Label htmlFor="bulk-status-select">New Status</Label>
          <NativeSelect
            id="bulk-status-select"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="mt-1"
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="awaiting_test">Awaiting Test</option>
            <option value="hold_point">Hold Point</option>
            <option value="ncr_raised">NCR Raised</option>
            <option value="completed">Completed</option>
          </NativeSelect>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={updating}
        >
          Cancel
        </Button>
        <Button
          onClick={handleUpdate}
          disabled={updating}
        >
          {updating ? 'Updating...' : 'Update Status'}
        </Button>
      </ModalFooter>
    </Modal>
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
    <Modal onClose={onClose}>
      <ModalHeader>Assign Subcontractor</ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground mb-4">
          Assign {selectedCount} selected lot(s) to a subcontractor.
        </p>
        <div>
          <Label htmlFor="bulk-subcontractor">Subcontractor</Label>
          <NativeSelect
            id="bulk-subcontractor"
            value={selectedSubcontractorId}
            onChange={(e) => setSelectedSubcontractorId(e.target.value)}
            className="mt-1"
          >
            <option value="">-- Unassign --</option>
            {subcontractors.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.companyName}
              </option>
            ))}
          </NativeSelect>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={assigning}
        >
          Cancel
        </Button>
        <Button
          onClick={handleAssign}
          disabled={assigning}
        >
          {assigning ? 'Assigning...' : 'Assign'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
