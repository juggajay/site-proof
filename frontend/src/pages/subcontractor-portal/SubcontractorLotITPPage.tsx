import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { MobileITPChecklist } from '@/components/foreman/MobileITPChecklist'
import { apiFetch, getAuthToken, apiUrl } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface ITPChecklistItem {
  id: string
  description: string
  category: string
  responsibleParty: 'contractor' | 'subcontractor' | 'superintendent' | 'general'
  isHoldPoint: boolean
  pointType: 'standard' | 'witness' | 'hold_point'
  evidenceRequired: 'none' | 'photo' | 'test' | 'document'
  order: number
  testType?: string | null
  acceptanceCriteria?: string | null
}

interface ITPAttachment {
  id: string
  documentId: string
  document: {
    id: string
    filename: string
    fileUrl: string
    caption: string | null
  }
}

interface ITPCompletion {
  id: string
  checklistItemId: string
  isCompleted: boolean
  isNotApplicable?: boolean
  isFailed?: boolean
  isVerified?: boolean
  notes: string | null
  completedAt: string | null
  completedBy: { id: string; fullName: string; email: string } | null
  attachments: ITPAttachment[]
}

interface ITPInstance {
  id: string
  status: string
  template: {
    id: string
    name: string
    activityType: string
    checklistItems: ITPChecklistItem[]
  }
  completions: ITPCompletion[]
}

interface Lot {
  id: string
  lotNumber: string
  description?: string
  status: string
  subcontractorAssignments?: {
    canCompleteITP: boolean
    itpRequiresVerification: boolean
  }[]
}

export function SubcontractorLotITPPage() {
  const { lotId } = useParams<{ lotId: string }>()
  const [lot, setLot] = useState<Lot | null>(null)
  const [itpInstance, setItpInstance] = useState<ITPInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingItem, setUpdatingItem] = useState<string | null>(null)
  const [canCompleteItems, setCanCompleteItems] = useState(false)

  const fetchData = async () => {
    try {
      // Fetch lot details
      const lotData = await apiFetch<{ lot: Lot }>(`/api/lots/${lotId}`)
      setLot(lotData.lot)

      // Check if subcontractor can complete items (check all assignments)
      const canComplete = lotData.lot.subcontractorAssignments?.some(
        (a: { canCompleteITP: boolean }) => a.canCompleteITP
      ) ?? false
      setCanCompleteItems(canComplete)

      // Fetch ITP instance for this lot
      try {
        const itpData = await apiFetch<{ instance: ITPInstance }>(`/api/itp/instances/lot/${lotId}`)
        setItpInstance(itpData.instance)
      } catch {
        // No ITP instance for this lot
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load ITP data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (lotId) {
      fetchData()
    }
  }, [lotId])

  const handleToggleCompletion = async (checklistItemId: string, isCompleted: boolean, notes: string | null) => {
    if (!itpInstance) return
    setUpdatingItem(checklistItemId)

    try {
      await apiFetch(`/api/itp/completions`, {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          isCompleted,
          notes,
        }),
      })

      await fetchData()
      toast({ title: 'Success', description: 'Item updated', variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setUpdatingItem(null)
    }
  }

  const handleMarkNotApplicable = async (checklistItemId: string, reason: string) => {
    if (!itpInstance) return
    setUpdatingItem(checklistItemId)

    try {
      await apiFetch(`/api/itp/completions`, {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          isNotApplicable: true,
          notes: reason,
        }),
      })

      await fetchData()
      toast({ title: 'Success', description: 'Item marked as N/A', variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setUpdatingItem(null)
    }
  }

  const handleMarkFailed = async (checklistItemId: string, reason: string) => {
    if (!itpInstance) return
    setUpdatingItem(checklistItemId)

    try {
      await apiFetch(`/api/itp/completions`, {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          isFailed: true,
          notes: reason,
        }),
      })

      await fetchData()
      toast({ title: 'Success', description: 'Item marked as failed', variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setUpdatingItem(null)
    }
  }

  const handleUpdateNotes = async (checklistItemId: string, notes: string) => {
    if (!itpInstance) return
    setUpdatingItem(checklistItemId)

    try {
      const completion = itpInstance.completions.find(c => c.checklistItemId === checklistItemId)

      if (completion) {
        // Update existing completion
        await apiFetch(`/api/itp/completions/${completion.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ notes }),
        })
      }

      await fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setUpdatingItem(null)
    }
  }

  const handleAddPhoto = async (checklistItemId: string, file: File) => {
    if (!itpInstance) return
    setUpdatingItem(checklistItemId)

    try {
      const completion = itpInstance.completions.find(c => c.checklistItemId === checklistItemId)

      if (!completion) {
        // Create completion first
        await handleToggleCompletion(checklistItemId, true, null)
        await fetchData()
        return
      }

      // Upload photo - uses FormData so we use raw fetch
      const formData = new FormData()
      formData.append('file', file)
      const token = getAuthToken()

      const response = await fetch(
        apiUrl(`/api/itp/completions/${completion.id}/attachments`),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      )

      if (!response.ok) {
        throw new Error('Failed to upload photo')
      }

      await fetchData()
      toast({ title: 'Success', description: 'Photo uploaded', variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setUpdatingItem(null)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (error || !lot) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{error || 'Lot not found'}</p>
        </div>
        <Link
          to="/subcontractor-portal/itps"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to ITPs
        </Link>
      </div>
    )
  }

  if (!itpInstance) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/subcontractor-portal/itps"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{lot.lotNumber}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">ITP Checklist</p>
          </div>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No ITP assigned to this lot</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/subcontractor-portal/itps"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{lot.lotNumber}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{itpInstance.template.name}</p>
        </div>
      </div>

      {/* ITP Checklist */}
      <MobileITPChecklist
        lotNumber={lot.lotNumber}
        templateName={itpInstance.template.name}
        checklistItems={itpInstance.template.checklistItems}
        completions={itpInstance.completions}
        onToggleCompletion={handleToggleCompletion}
        onMarkNotApplicable={handleMarkNotApplicable}
        onMarkFailed={handleMarkFailed}
        onUpdateNotes={handleUpdateNotes}
        onAddPhoto={handleAddPhoto}
        updatingItem={updatingItem}
        canCompleteItems={canCompleteItems}
      />
    </div>
  )
}
