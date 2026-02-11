import React, { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { handleApiError } from '@/lib/errorHandling'
import type { Lot } from '../lotsPageTypes'

// Lot number length constraints
const LOT_NUMBER_MIN_LENGTH = 3
const LOT_NUMBER_MAX_LENGTH = 50

// Chainage min/max constraints
const CHAINAGE_MIN = 0
const CHAINAGE_MAX = 999999

interface CreateLotModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (lot: Lot) => void
  projectId: string
}

export function CreateLotModal({ isOpen, onClose, onSuccess, projectId }: CreateLotModalProps) {
  const [creating, setCreating] = useState(false)
  const [newLot, setNewLot] = useState({
    lotNumber: '',
    description: '',
    activityType: 'Earthworks',
    chainageStart: '',
    chainageEnd: '',
    assignedSubcontractorId: '',
    canCompleteITP: false,
    itpRequiresVerification: true,
  })
  const [chainageError, setChainageError] = useState<string | null>(null)
  const [lotNumberTouched, setLotNumberTouched] = useState(false)
  const [lotNumberError, setLotNumberError] = useState<string | null>(null)

  // ITP template suggestion state
  const [itpTemplates, setItpTemplates] = useState<{ id: string; name: string; activityType: string }[]>([])
  const [suggestedTemplate, setSuggestedTemplate] = useState<{ id: string; name: string } | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Subcontractors
  const [subcontractors, setSubcontractors] = useState<{ id: string; companyName: string }[]>([])

  // Validate lot number length
  const validateLotNumber = (value: string): string | null => {
    if (!value.trim()) {
      return 'Lot Number is required'
    }
    if (value.trim().length < LOT_NUMBER_MIN_LENGTH) {
      return `Lot Number must be at least ${LOT_NUMBER_MIN_LENGTH} characters`
    }
    if (value.length > LOT_NUMBER_MAX_LENGTH) {
      return `Lot Number must be at most ${LOT_NUMBER_MAX_LENGTH} characters`
    }
    return null
  }

  // Validate chainage values
  const validateChainage = (start: string, end: string) => {
    if (start) {
      const startNum = parseInt(start)
      if (!isNaN(startNum)) {
        if (startNum < CHAINAGE_MIN) return `Chainage Start must be at least ${CHAINAGE_MIN}`
        if (startNum > CHAINAGE_MAX) return `Chainage Start must be at most ${CHAINAGE_MAX}`
      }
    }
    if (end) {
      const endNum = parseInt(end)
      if (!isNaN(endNum)) {
        if (endNum < CHAINAGE_MIN) return `Chainage End must be at least ${CHAINAGE_MIN}`
        if (endNum > CHAINAGE_MAX) return `Chainage End must be at most ${CHAINAGE_MAX}`
      }
    }
    if (start && end) {
      const startNum = parseInt(start)
      const endNum = parseInt(end)
      if (!isNaN(startNum) && !isNaN(endNum) && endNum < startNum) {
        return 'Chainage End must be greater than or equal to Chainage Start'
      }
    }
    return null
  }

  const handleChainageStartChange = (value: string) => {
    setNewLot((prev) => ({ ...prev, chainageStart: value }))
    setChainageError(validateChainage(value, newLot.chainageEnd))
  }

  const handleChainageEndChange = (value: string) => {
    setNewLot((prev) => ({ ...prev, chainageEnd: value }))
    setChainageError(validateChainage(newLot.chainageStart, value))
  }

  // Update suggested ITP template when activity type changes
  const handleActivityTypeChange = (activityType: string) => {
    setNewLot(prev => ({ ...prev, activityType }))

    const suggested = itpTemplates.find(t =>
      t.activityType?.toLowerCase() === activityType.toLowerCase()
    )
    if (suggested) {
      setSuggestedTemplate({ id: suggested.id, name: suggested.name })
      setSelectedTemplateId(suggested.id)
    } else {
      setSuggestedTemplate(null)
      setSelectedTemplateId('')
    }
  }

  // Fetch data when modal opens
  useEffect(() => {
    if (!isOpen) return

    // Reset form
    setNewLot({
      lotNumber: '',
      description: '',
      activityType: 'Earthworks',
      chainageStart: '',
      chainageEnd: '',
      assignedSubcontractorId: '',
      canCompleteITP: false,
      itpRequiresVerification: true,
    })
    setChainageError(null)
    setSuggestedTemplate(null)
    setSelectedTemplateId('')
    setLotNumberTouched(false)
    setLotNumberError(null)

    const fetchData = async () => {
      try {
        const [lotData, itpData, subData] = await Promise.all([
          apiFetch<{ suggestedNumber?: string }>(`/api/lots/suggest-number?projectId=${projectId}`),
          apiFetch<{ templates: any[] }>(`/api/itp/templates?projectId=${projectId}&includeGlobal=true`),
          apiFetch<{ subcontractors: { id: string; companyName: string }[] }>(`/api/subcontractors/for-project/${projectId}`),
        ])

        if (lotData.suggestedNumber) {
          setNewLot(prev => ({ ...prev, lotNumber: lotData.suggestedNumber! }))
        }

        const templates = itpData.templates || []
        setItpTemplates(templates.filter((t: any) => t.isActive !== false))
        const suggested = templates.find((t: any) =>
          t.activityType?.toLowerCase() === 'earthworks' && t.isActive !== false
        )
        if (suggested) {
          setSuggestedTemplate({ id: suggested.id, name: suggested.name })
          setSelectedTemplateId(suggested.id)
        }

        setSubcontractors(subData.subcontractors || [])
      } catch (err) {
        console.error('Failed to fetch lot data:', err)
      }
    }

    fetchData()
  }, [isOpen, projectId])

  const handleClose = () => {
    setLotNumberTouched(false)
    setSuggestedTemplate(null)
    setSelectedTemplateId('')
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const handleCreateLot = async () => {
    if (creating) return
    if (!newLot.lotNumber.trim()) return

    setCreating(true)

    try {
      const data = await apiFetch<{ lot: Lot }>('/api/lots', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          lotNumber: newLot.lotNumber,
          description: newLot.description || null,
          activityType: newLot.activityType,
          chainageStart: newLot.chainageStart ? parseInt(newLot.chainageStart) : null,
          chainageEnd: newLot.chainageEnd ? parseInt(newLot.chainageEnd) : null,
          itpTemplateId: selectedTemplateId || null,
          assignedSubcontractorId: newLot.assignedSubcontractorId || null,
          canCompleteITP: newLot.assignedSubcontractorId ? newLot.canCompleteITP : undefined,
          itpRequiresVerification: newLot.assignedSubcontractorId ? newLot.itpRequiresVerification : undefined,
        }),
      })

      const createdLot: Lot = {
        ...data.lot,
        activityType: newLot.activityType,
        chainageStart: newLot.chainageStart ? parseInt(newLot.chainageStart) : null,
        chainageEnd: newLot.chainageEnd ? parseInt(newLot.chainageEnd) : null,
      }

      const assignedTemplate = selectedTemplateId
        ? itpTemplates.find(t => t.id === selectedTemplateId)
        : null

      toast({
        title: 'Lot Created',
        description: assignedTemplate
          ? `Lot ${newLot.lotNumber} created with ITP template "${assignedTemplate.name}"`
          : `Lot ${newLot.lotNumber} has been created successfully`,
        variant: 'success',
      })

      onSuccess(createdLot)
    } catch (err) {
      handleApiError(err, 'Failed to create lot')
    } finally {
      setCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Create New Lot</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close modal"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="lot-number" className="block text-sm font-medium text-gray-700">
              Lot Number <span className="text-red-500">*</span>
              <span className="text-xs text-gray-500 ml-2">({LOT_NUMBER_MIN_LENGTH}-{LOT_NUMBER_MAX_LENGTH} chars)</span>
            </label>
            <input
              id="lot-number"
              type="text"
              value={newLot.lotNumber}
              onChange={(e) => {
                setNewLot((prev) => ({ ...prev, lotNumber: e.target.value }))
                if (lotNumberTouched) {
                  setLotNumberError(validateLotNumber(e.target.value))
                }
              }}
              onBlur={() => {
                setLotNumberTouched(true)
                setLotNumberError(validateLotNumber(newLot.lotNumber))
              }}
              maxLength={LOT_NUMBER_MAX_LENGTH}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                lotNumberTouched && lotNumberError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'focus:border-primary focus:ring-primary'
              }`}
              placeholder="e.g., LOT-001"
            />
            {lotNumberTouched && lotNumberError && (
              <p className="text-sm text-red-600 mt-1" role="alert" aria-live="assertive">{lotNumberError}</p>
            )}
          </div>

          <div>
            <label htmlFor="lot-description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <input
              id="lot-description"
              type="text"
              value={newLot.description}
              onChange={(e) => setNewLot((prev) => ({ ...prev, description: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label htmlFor="lot-activity" className="block text-sm font-medium text-gray-700">
              Activity Type
            </label>
            <select
              id="lot-activity"
              value={newLot.activityType}
              onChange={(e) => handleActivityTypeChange(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="Earthworks">Earthworks</option>
              <option value="Concrete">Concrete</option>
              <option value="Drainage">Drainage</option>
              <option value="Pavement">Pavement</option>
              <option value="Structures">Structures</option>
              <option value="Utilities">Utilities</option>
            </select>
          </div>

          {/* ITP Template suggestion */}
          {suggestedTemplate && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Suggested ITP Template:</span>{' '}
                {suggestedTemplate.name}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use-suggested-itp"
                  checked={selectedTemplateId === suggestedTemplate.id}
                  onChange={(e) => setSelectedTemplateId(e.target.checked ? suggestedTemplate.id : '')}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="use-suggested-itp" className="text-sm text-blue-700">
                  Assign this ITP template to the lot
                </label>
              </div>
            </div>
          )}

          {/* ITP template dropdown for manual selection */}
          <div>
            <label htmlFor="lot-itp-template" className="block text-sm font-medium text-gray-700">
              ITP Template (Optional)
            </label>
            <select
              id="lot-itp-template"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">No ITP template</option>
              {itpTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.activityType})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="chainage-start" className="block text-sm font-medium text-gray-700">
                Chainage Start
              </label>
              <input
                id="chainage-start"
                type="number"
                value={newLot.chainageStart}
                onChange={(e) => handleChainageStartChange(e.target.value)}
                min={CHAINAGE_MIN}
                max={CHAINAGE_MAX}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  chainageError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'focus:border-primary focus:ring-primary'
                }`}
                placeholder="e.g., 0"
              />
            </div>
            <div>
              <label htmlFor="chainage-end" className="block text-sm font-medium text-gray-700">
                Chainage End
              </label>
              <input
                id="chainage-end"
                type="number"
                value={newLot.chainageEnd}
                onChange={(e) => handleChainageEndChange(e.target.value)}
                min={CHAINAGE_MIN}
                max={CHAINAGE_MAX}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  chainageError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'focus:border-primary focus:ring-primary'
                }`}
                placeholder="e.g., 100"
              />
            </div>
          </div>
          {chainageError && (
            <p className="text-sm text-red-600 mt-1" role="alert" aria-live="assertive">{chainageError}</p>
          )}

          {/* Subcontractor assignment */}
          {subcontractors.length > 0 && (
            <div>
              <label htmlFor="lot-subcontractor" className="block text-sm font-medium text-gray-700">
                Assign to Subcontractor (Optional)
              </label>
              <select
                id="lot-subcontractor"
                value={newLot.assignedSubcontractorId}
                onChange={(e) => setNewLot((prev) => ({ ...prev, assignedSubcontractorId: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">No subcontractor assigned</option>
                {subcontractors.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.companyName}
                  </option>
                ))}
              </select>

              {/* ITP permissions - only show when subcontractor is selected */}
              {newLot.assignedSubcontractorId && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-gray-700">ITP Permissions</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="can-complete-itp"
                      checked={newLot.canCompleteITP}
                      onChange={(e) => setNewLot((prev) => ({ ...prev, canCompleteITP: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="can-complete-itp" className="text-sm text-gray-700">
                      Allow ITP completion
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="itp-requires-verification"
                      checked={newLot.itpRequiresVerification}
                      onChange={(e) => setNewLot((prev) => ({ ...prev, itpRequiresVerification: e.target.checked }))}
                      disabled={!newLot.canCompleteITP}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                    />
                    <label htmlFor="itp-requires-verification" className={`text-sm ${newLot.canCompleteITP ? 'text-gray-700' : 'text-gray-400'}`}>
                      Require verification (recommended)
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={creating}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateLot}
            disabled={creating || !newLot.lotNumber.trim() || !!chainageError}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Lot'}
          </button>
        </div>
      </div>
    </div>
  )
}
