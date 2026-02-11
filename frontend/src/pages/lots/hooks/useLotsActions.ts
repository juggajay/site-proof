import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import type { Lot } from '../lotsPageTypes'

interface UseLotsActionsParams {
  lots: Lot[]
  setLots: React.Dispatch<React.SetStateAction<Lot[]>>
  displayedLots: Lot[]
  fetchLots: () => Promise<void>
  fetchSubcontractors: () => Promise<void>
  subcontractors: { id: string; companyName: string }[]
}

export function useLotsActions({
  lots: _lots,
  setLots,
  displayedLots,
  fetchLots: _fetchLots,
  fetchSubcontractors,
  subcontractors,
}: UseLotsActionsParams) {
  const [searchParams, setSearchParams] = useSearchParams()

  // Selection state
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set())

  // Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [lotToDelete, setLotToDelete] = useState<Lot | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [bulkWizardOpen, setBulkWizardOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [printLabelsModalOpen, setPrintLabelsModalOpen] = useState(false)
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false)
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false)

  // Quick view state
  const [quickViewLot, setQuickViewLot] = useState<{ id: string; position: { x: number; y: number } } | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ lot: Lot; x: number; y: number } | null>(null)

  // Derived
  const deletableLots = displayedLots.filter(lot => lot.status !== 'conformed' && lot.status !== 'claimed')
  const allDeletableSelected = deletableLots.length > 0 && deletableLots.every(lot => selectedLots.has(lot.id))

  // =====================
  // Handlers
  // =====================
  const updateFilters = useCallback((newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams)
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) { params.set(key, value) } else { params.delete(key) }
    })
    if (!('page' in newParams)) params.set('page', '1')
    setSearchParams(params)
  }, [searchParams, setSearchParams])

  const handleSort = useCallback((field: string) => {
    const sortField = searchParams.get('sort') || 'lotNumber'
    const sortDirection = searchParams.get('dir') || 'asc'
    if (field === sortField) {
      updateFilters({ dir: sortDirection === 'asc' ? 'desc' : 'asc', sort: field })
    } else {
      updateFilters({ sort: field, dir: 'asc' })
    }
  }, [searchParams, updateFilters])

  const toggleViewMode = useCallback((mode: 'list' | 'card' | 'linear') => {
    localStorage.setItem('siteproof_lot_view_mode', mode)
  }, [])

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    if (allDeletableSelected) {
      const newSelected = new Set(selectedLots)
      deletableLots.forEach(lot => newSelected.delete(lot.id))
      setSelectedLots(newSelected)
    } else {
      const newSelected = new Set(selectedLots)
      deletableLots.forEach(lot => newSelected.add(lot.id))
      setSelectedLots(newSelected)
    }
  }, [allDeletableSelected, selectedLots, deletableLots])

  const handleSelectLot = useCallback((lotId: string) => {
    const newSelected = new Set(selectedLots)
    if (newSelected.has(lotId)) { newSelected.delete(lotId) } else { newSelected.add(lotId) }
    setSelectedLots(newSelected)
  }, [selectedLots])

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, lot: Lot) => {
    e.preventDefault()
    setContextMenu({ lot, x: e.clientX, y: e.clientY })
  }, [])

  const closeContextMenu = useCallback(() => { setContextMenu(null) }, [])

  // Quick view handlers
  const handleLotMouseEnter = useCallback((lotId: string, event: React.MouseEvent) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      setQuickViewLot({ id: lotId, position: { x: event.clientX, y: event.clientY } })
    }, 400)
  }, [])

  const handleLotMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null }
  }, [])

  const handleQuickViewClose = useCallback(() => { setQuickViewLot(null) }, [])

  // Delete handlers
  const handleDeleteClick = useCallback((lot: Lot) => { setLotToDelete(lot); setDeleteModalOpen(true) }, [])

  const handleDeleteSuccess = useCallback((lotId: string) => {
    setLots(prev => prev.filter(l => l.id !== lotId))
    setDeleteModalOpen(false)
    setLotToDelete(null)
  }, [setLots])

  // Clone lot
  const handleCloneLot = useCallback(async (lot: Lot) => {
    try {
      const data = await apiFetch<{ lot: Lot }>(`/api/lots/${lot.id}/clone`, {
        method: 'POST', body: JSON.stringify({}),
      })
      setLots(prev => [...prev, data.lot])
      toast({ title: 'Lot Cloned', description: `${lot.lotNumber} cloned as ${data.lot.lotNumber}`, variant: 'success' })
    } catch (err) {
      toast({ title: 'Clone Failed', description: err instanceof Error ? err.message : 'Failed to clone lot', variant: 'error' })
    }
  }, [setLots])

  // Create lot success
  const handleCreateSuccess = useCallback((lot: Lot) => {
    setLots(prev => [...prev, lot])
    setCreateModalOpen(false)
  }, [setLots])

  // Bulk actions
  const handleBulkDelete = useCallback(async () => {
    if (selectedLots.size === 0) return
    try {
      const data = await apiFetch<{ message: string }>('/api/lots/bulk-delete', {
        method: 'POST', body: JSON.stringify({ lotIds: Array.from(selectedLots) }),
      })
      setLots(prev => prev.filter(l => !selectedLots.has(l.id)))
      setSelectedLots(new Set())
      setBulkDeleteModalOpen(false)
      toast({ title: 'Lots Deleted', description: data.message, variant: 'success' })
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete lots', variant: 'error' })
    }
  }, [selectedLots, setLots])

  const handleBulkStatusUpdate = useCallback(async (newStatus: string) => {
    if (selectedLots.size === 0) return
    try {
      const data = await apiFetch<{ message: string }>('/api/lots/bulk-update-status', {
        method: 'POST', body: JSON.stringify({ lotIds: Array.from(selectedLots), status: newStatus }),
      })
      setLots(prev => prev.map(lot => selectedLots.has(lot.id) ? { ...lot, status: newStatus } : lot))
      setSelectedLots(new Set())
      setBulkStatusModalOpen(false)
      toast({ title: 'Status Updated', description: data.message, variant: 'success' })
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update lot status', variant: 'error' })
    }
  }, [selectedLots, setLots])

  const handleOpenBulkAssignModal = useCallback(async () => {
    await fetchSubcontractors()
    setBulkAssignModalOpen(true)
  }, [fetchSubcontractors])

  const handleBulkAssignSubcontractor = useCallback(async (selectedSubcontractorId: string) => {
    if (selectedLots.size === 0) return
    try {
      const data = await apiFetch<{ message: string }>('/api/lots/bulk-assign-subcontractor', {
        method: 'POST', body: JSON.stringify({ lotIds: Array.from(selectedLots), subcontractorId: selectedSubcontractorId || null }),
      })
      const selectedSub = subcontractors.find(s => s.id === selectedSubcontractorId)
      setLots(prev => prev.map(lot =>
        selectedLots.has(lot.id)
          ? { ...lot, assignedSubcontractorId: selectedSubcontractorId || null, assignedSubcontractor: selectedSubcontractorId && selectedSub ? { companyName: selectedSub.companyName } : null }
          : lot
      ))
      setSelectedLots(new Set())
      setBulkAssignModalOpen(false)
      toast({ title: 'Subcontractor Assigned', description: data.message, variant: 'success' })
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to assign subcontractor', variant: 'error' })
    }
  }, [selectedLots, subcontractors, setLots])

  // Escape key handler for modals
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (createModalOpen) setCreateModalOpen(false)
        if (deleteModalOpen) { setDeleteModalOpen(false); setLotToDelete(null) }
        if (bulkWizardOpen) setBulkWizardOpen(false)
        if (bulkDeleteModalOpen) setBulkDeleteModalOpen(false)
        if (bulkStatusModalOpen) setBulkStatusModalOpen(false)
        if (bulkAssignModalOpen) setBulkAssignModalOpen(false)
        if (printLabelsModalOpen) setPrintLabelsModalOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [createModalOpen, deleteModalOpen, bulkWizardOpen, bulkDeleteModalOpen, bulkStatusModalOpen, bulkAssignModalOpen, printLabelsModalOpen])

  return {
    selectedLots,
    deleteModalOpen, setDeleteModalOpen,
    lotToDelete, setLotToDelete,
    createModalOpen, setCreateModalOpen,
    bulkWizardOpen, setBulkWizardOpen,
    importModalOpen, setImportModalOpen,
    exportModalOpen, setExportModalOpen,
    printLabelsModalOpen, setPrintLabelsModalOpen,
    bulkDeleteModalOpen, setBulkDeleteModalOpen,
    bulkStatusModalOpen, setBulkStatusModalOpen,
    bulkAssignModalOpen, setBulkAssignModalOpen,
    quickViewLot,
    contextMenu,
    allDeletableSelected,
    updateFilters,
    handleSort,
    toggleViewMode,
    handleSelectAll,
    handleSelectLot,
    handleContextMenu,
    closeContextMenu,
    handleLotMouseEnter,
    handleLotMouseLeave,
    handleQuickViewClose,
    handleDeleteClick,
    handleDeleteSuccess,
    handleCloneLot,
    handleCreateSuccess,
    handleBulkDelete,
    handleBulkStatusUpdate,
    handleOpenBulkAssignModal,
    handleBulkAssignSubcontractor,
  }
}
