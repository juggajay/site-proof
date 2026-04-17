import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { extractErrorMessage } from '@/lib/errorHandling'
import type { Lot } from '../lotsPageTypes'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'

interface DeleteLotModalProps {
  isOpen: boolean
  lot: Lot | null
  onClose: () => void
  onDeleted: (lotId: string) => void
  onError: (message: string) => void
}

export function DeleteLotModal({ isOpen, lot, onClose, onDeleted, onError }: DeleteLotModalProps) {
  const [deleting, setDeleting] = useState(false)

  const handleConfirmDelete = async () => {
    if (!lot) return
    if (deleting) return

    setDeleting(true)

    try {
      await apiFetch(`/api/lots/${lot.id}`, {
        method: 'DELETE',
      })

      onDeleted(lot.id)
    } catch (err) {
      onError(extractErrorMessage(err, 'Failed to delete lot'))
    } finally {
      setDeleting(false)
    }
  }

  if (!isOpen || !lot) return null

  return (
    <Modal alert onClose={onClose}>
      <ModalHeader>Confirm Deletion</ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete lot{' '}
          <span className="font-semibold text-foreground">{lot.lotNumber}</span>?
        </p>
        {lot.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            &quot;{lot.description}&quot;
          </p>
        )}
        <p className="mt-3 text-sm text-red-600">
          This action cannot be undone. All associated data will be permanently deleted.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete Lot'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
