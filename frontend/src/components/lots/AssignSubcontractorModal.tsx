import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { toast } from '@/components/ui/toaster'
import { Loader2 } from 'lucide-react'

interface SubcontractorCompany {
  id: string
  companyName: string
  status: string
}

interface LotSubcontractorAssignment {
  id: string
  subcontractorCompanyId: string
  canCompleteITP: boolean
  itpRequiresVerification: boolean
  subcontractorCompany: {
    id: string
    companyName: string
  }
}

interface AssignSubcontractorModalProps {
  lotId: string
  lotNumber: string
  projectId: string
  existingAssignment?: LotSubcontractorAssignment | null
  onClose: () => void
  onSuccess?: () => void
}

export function AssignSubcontractorModal({
  lotId,
  lotNumber,
  projectId,
  existingAssignment,
  onClose,
  onSuccess
}: AssignSubcontractorModalProps) {
  const queryClient = useQueryClient()
  const isEditing = !!existingAssignment

  const [selectedSubcontractor, setSelectedSubcontractor] = useState(
    existingAssignment?.subcontractorCompanyId || ''
  )
  const [canCompleteITP, setCanCompleteITP] = useState(
    existingAssignment?.canCompleteITP || false
  )
  const [itpRequiresVerification, setItpRequiresVerification] = useState(
    existingAssignment?.itpRequiresVerification ?? true
  )

  // Reset form when existingAssignment changes
  useEffect(() => {
    if (existingAssignment) {
      setSelectedSubcontractor(existingAssignment.subcontractorCompanyId)
      setCanCompleteITP(existingAssignment.canCompleteITP)
      setItpRequiresVerification(existingAssignment.itpRequiresVerification)
    } else {
      setSelectedSubcontractor('')
      setCanCompleteITP(false)
      setItpRequiresVerification(true)
    }
  }, [existingAssignment])

  // Fetch subcontractors for this project (exclude only rejected/removed)
  const { data: subcontractors = [], isLoading: loadingSubcontractors, error: subError } = useQuery({
    queryKey: ['subcontractors', projectId],
    queryFn: async () => {
      console.log('[AssignSubModal] Fetching subcontractors for projectId:', projectId)
      try {
        const response = await apiFetch<{ subcontractors: SubcontractorCompany[] }>(
          `/api/subcontractors/for-project/${projectId}`
        )
        console.log('[AssignSubModal] API returned subcontractors:', response.subcontractors)
        // Include approved, pending_approval, active - exclude rejected/removed
        const filtered = response.subcontractors.filter(s =>
          s.status !== 'rejected' && s.status !== 'removed'
        )
        console.log('[AssignSubModal] After status filter:', filtered)
        return filtered
      } catch (err) {
        console.error('[AssignSubModal] Error fetching subcontractors:', err)
        throw err
      }
    },
    enabled: !isEditing && !!projectId,
    retry: false
  })

  // Fetch existing assignments to filter out already assigned subcontractors
  const { data: existingAssignments = [], isLoading: loadingAssignments, error: assignError } = useQuery({
    queryKey: ['lot-assignments', lotId],
    queryFn: async () => {
      console.log('[AssignSubModal] Fetching existing assignments for lotId:', lotId)
      try {
        const result = await apiFetch<LotSubcontractorAssignment[]>(`/api/lots/${lotId}/subcontractors`)
        console.log('[AssignSubModal] Existing assignments:', result)
        return result
      } catch (err) {
        console.error('[AssignSubModal] Error fetching assignments:', err)
        throw err
      }
    },
    enabled: !isEditing,
    retry: false
  })

  // Log any errors
  if (subError) console.error('[AssignSubModal] Subcontractors query error:', subError)
  if (assignError) console.error('[AssignSubModal] Assignments query error:', assignError)

  const availableSubcontractors = subcontractors.filter(
    s => !existingAssignments.some(a => a.subcontractorCompanyId === s.id)
  )

  // Debug logging
  console.log('[AssignSubModal] Final available subcontractors:', availableSubcontractors)

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (isEditing && existingAssignment) {
        return apiFetch(`/api/lots/${lotId}/subcontractors/${existingAssignment.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ canCompleteITP, itpRequiresVerification })
        })
      }
      return apiFetch(`/api/lots/${lotId}/subcontractors`, {
        method: 'POST',
        body: JSON.stringify({
          subcontractorCompanyId: selectedSubcontractor,
          canCompleteITP,
          itpRequiresVerification
        })
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot-assignments', lotId] })
      queryClient.invalidateQueries({ queryKey: ['lots'] })
      queryClient.invalidateQueries({ queryKey: ['lot', lotId] })
      toast({
        title: isEditing ? 'Permissions updated' : 'Subcontractor assigned',
        description: isEditing
          ? 'ITP permissions have been updated.'
          : 'Subcontractor has been assigned to this lot.',
        variant: 'success'
      })
      onSuccess?.()
      onClose()
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save assignment',
        variant: 'error'
      })
    }
  })

  const handleSubmit = () => {
    if (!isEditing && !selectedSubcontractor) {
      toast({
        title: 'Error',
        description: 'Please select a subcontractor',
        variant: 'error'
      })
      return
    }
    assignMutation.mutate()
  }

  const isLoading = loadingSubcontractors || loadingAssignments

  return (
    <Modal onClose={onClose} className="w-full max-w-md">
      <ModalHeader onClose={onClose}>
        {isEditing ? 'Edit Subcontractor Permissions' : 'Assign Subcontractor'} - {lotNumber}
      </ModalHeader>

      <ModalBody>
        <div className="space-y-4">
          {!isEditing && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Subcontractor Company
              </label>
              {!projectId ? (
                <p className="text-sm text-red-500">
                  Error: Project ID is missing. Please reload the page.
                </p>
              ) : subError || assignError ? (
                <p className="text-sm text-red-500">
                  Error loading data: {(subError as Error)?.message || (assignError as Error)?.message || 'Authentication failed. Please refresh the page.'}
                </p>
              ) : isLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading subcontractors...</span>
                </div>
              ) : (
                <>
                  <select
                    value={selectedSubcontractor}
                    onChange={(e) => setSelectedSubcontractor(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select subcontractor...</option>
                    {availableSubcontractors.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.companyName}
                      </option>
                    ))}
                  </select>
                  {availableSubcontractors.length === 0 && (
                    <p className="text-sm text-gray-500">
                      {subcontractors.length === 0
                        ? 'No subcontractors found for this project. Invite subcontractors from the Subcontractors page first.'
                        : 'All subcontractors are already assigned to this lot.'}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {isEditing && (
            <div className="text-sm text-gray-600">
              Editing permissions for: <strong>{existingAssignment?.subcontractorCompany.companyName}</strong>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              ITP Permissions
            </label>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="canCompleteITP"
                checked={canCompleteITP}
                onChange={(e) => setCanCompleteITP(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <label
                  htmlFor="canCompleteITP"
                  className="text-sm font-medium text-gray-900 cursor-pointer"
                >
                  Allow ITP completion
                </label>
                <p className="text-sm text-gray-500">
                  Subcontractor can complete checklist items
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="itpRequiresVerification"
                checked={itpRequiresVerification}
                onChange={(e) => setItpRequiresVerification(e.target.checked)}
                disabled={!canCompleteITP}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className={!canCompleteITP ? 'opacity-50' : ''}>
                <label
                  htmlFor="itpRequiresVerification"
                  className={`text-sm font-medium text-gray-900 ${canCompleteITP ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  Require verification (recommended)
                </label>
                <p className="text-sm text-gray-500">
                  Completions need head contractor approval
                </p>
              </div>
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={assignMutation.isPending || (!isEditing && !selectedSubcontractor)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {assignMutation.isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : isEditing ? 'Save' : 'Assign'}
        </button>
      </ModalFooter>
    </Modal>
  )
}
