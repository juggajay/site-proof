import { useState, useCallback } from 'react'
import type { NCR } from '../types'

type ModalType =
  | 'create'
  | 'close'
  | 'concession'
  | 'respond'
  | 'notifyClient'
  | 'qmReview'
  | 'rectify'
  | 'rejectRectification'

interface UseNCRModalsReturn {
  activeModal: ModalType | null
  selectedNcr: NCR | null
  openModal: (modal: ModalType, ncr?: NCR | null) => void
  closeModal: () => void
  selectNcr: (ncr: NCR) => void
}

export function useNCRModals(): UseNCRModalsReturn {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null)
  const [selectedNcr, setSelectedNcr] = useState<NCR | null>(null)

  const openModal = useCallback((modal: ModalType, ncr: NCR | null = null) => {
    setSelectedNcr(ncr)
    setActiveModal(modal)
  }, [])

  const closeModal = useCallback(() => {
    setActiveModal(null)
    setSelectedNcr(null)
  }, [])

  const selectNcr = useCallback((ncr: NCR) => {
    setSelectedNcr(ncr)
  }, [])

  return { activeModal, selectedNcr, openModal, closeModal, selectNcr }
}
