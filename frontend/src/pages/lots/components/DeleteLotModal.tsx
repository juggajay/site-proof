import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { extractErrorMessage } from '@/lib/errorHandling'
import type { Lot } from '../lotsPageTypes'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Confirm Deletion</h2>
        <p className="mt-2 text-sm text-gray-600">
          Are you sure you want to delete lot{' '}
          <span className="font-semibold text-gray-900">{lot.lotNumber}</span>?
        </p>
        {lot.description && (
          <p className="mt-1 text-sm text-gray-500">
            &quot;{lot.description}&quot;
          </p>
        )}
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
            onClick={handleConfirmDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Lot'}
          </button>
        </div>
      </div>
    </div>
  )
}
