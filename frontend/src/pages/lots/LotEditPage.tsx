import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCommercialAccess } from '@/hooks/useCommercialAccess'
import { getAuthToken } from '@/lib/auth'

interface Lot {
  id: string
  lotNumber: string
  description: string | null
  status: string
  activityType: string | null
  chainageStart: number | null
  chainageEnd: number | null
  offset: string | null
  layer: string | null
  areaZone: string | null
  budgetAmount?: number | null
}

const ACTIVITY_TYPES = [
  'Earthworks',
  'Drainage',
  'Pavement',
  'Concrete',
  'Structures',
  'Landscaping',
  'Services',
  'Other',
]

const OFFSET_OPTIONS = ['left', 'right', 'full', 'custom']

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_test', label: 'Awaiting Test' },
  { value: 'hold_point', label: 'Hold Point' },
  { value: 'ncr_raised', label: 'NCR Raised' },
]

export function LotEditPage() {
  const { projectId, lotId } = useParams()
  const navigate = useNavigate()
  const { canViewBudgets } = useCommercialAccess()
  const [lot, setLot] = useState<Lot | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    lotNumber: '',
    description: '',
    activityType: '',
    chainageStart: '',
    chainageEnd: '',
    offset: '',
    layer: '',
    areaZone: '',
    status: '',
    budgetAmount: '',
  })

  useEffect(() => {
    async function fetchLot() {
      if (!lotId) return

      const token = getAuthToken()
      if (!token) {
        navigate('/login')
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/lots/${lotId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.status === 404) {
          setError('Lot not found')
          setLoading(false)
          return
        }

        if (response.status === 403) {
          setError('You do not have access to this lot')
          setLoading(false)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch lot')
        }

        const data = await response.json()
        setLot(data.lot)

        // Populate form with lot data
        setFormData({
          lotNumber: data.lot.lotNumber || '',
          description: data.lot.description || '',
          activityType: data.lot.activityType || '',
          chainageStart: data.lot.chainageStart?.toString() || '',
          chainageEnd: data.lot.chainageEnd?.toString() || '',
          offset: data.lot.offset || '',
          layer: data.lot.layer || '',
          areaZone: data.lot.areaZone || '',
          status: data.lot.status || '',
          budgetAmount: data.lot.budgetAmount?.toString() || '',
        })
      } catch (err) {
        setError('Failed to load lot')
      } finally {
        setLoading(false)
      }
    }

    fetchLot()
  }, [lotId, navigate])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)

    const token = getAuthToken()
    if (!token) {
      navigate('/login')
      return
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    // Build update payload
    const updatePayload: any = {
      lotNumber: formData.lotNumber,
      description: formData.description || null,
      activityType: formData.activityType || null,
      chainageStart: formData.chainageStart ? parseFloat(formData.chainageStart) : null,
      chainageEnd: formData.chainageEnd ? parseFloat(formData.chainageEnd) : null,
      offset: formData.offset || null,
      layer: formData.layer || null,
      areaZone: formData.areaZone || null,
      status: formData.status || null,
    }

    // Only include budget if user has access
    if (canViewBudgets && formData.budgetAmount) {
      updatePayload.budgetAmount = parseFloat(formData.budgetAmount)
    }

    try {
      const response = await fetch(`${apiUrl}/api/lots/${lotId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to update lot')
      }

      // Navigate back to lot detail page
      navigate(`/projects/${projectId}/lots/${lotId}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <div className="text-6xl">!</div>
        <h1 className="text-2xl font-bold text-destructive">Error</h1>
        <p className="text-muted-foreground text-center max-w-md">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Go Back
        </button>
      </div>
    )
  }

  if (!lot) {
    return null
  }

  // Check if lot is in a non-editable state
  const isLocked = lot.status === 'conformed' || lot.status === 'claimed'

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Lot</h1>
          <p className="text-sm text-muted-foreground">
            Editing lot {lot.lotNumber}
          </p>
        </div>
        <button
          onClick={() => navigate(`/projects/${projectId}/lots/${lotId}`)}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          Cancel
        </button>
      </div>

      {/* Locked Warning */}
      {isLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <strong>Note:</strong> This lot is {lot.status} and cannot be edited.
        </div>
      )}

      {/* Save Error */}
      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {saveError}
        </div>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Basic Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="lotNumber" className="block text-sm font-medium mb-1">
                Lot Number *
              </label>
              <input
                type="text"
                id="lotNumber"
                name="lotNumber"
                value={formData.lotNumber}
                onChange={handleInputChange}
                disabled={isLocked}
                required
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                disabled={isLocked}
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              >
                <option value="">Select status</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              disabled={isLocked}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="activityType" className="block text-sm font-medium mb-1">
              Activity Type
            </label>
            <select
              id="activityType"
              name="activityType"
              value={formData.activityType}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
            >
              <option value="">Select activity type</option>
              {ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Location */}
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Location</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="chainageStart" className="block text-sm font-medium mb-1">
                Chainage Start
              </label>
              <input
                type="number"
                id="chainageStart"
                name="chainageStart"
                value={formData.chainageStart}
                onChange={handleInputChange}
                disabled={isLocked}
                step="0.01"
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="chainageEnd" className="block text-sm font-medium mb-1">
                Chainage End
              </label>
              <input
                type="number"
                id="chainageEnd"
                name="chainageEnd"
                value={formData.chainageEnd}
                onChange={handleInputChange}
                disabled={isLocked}
                step="0.01"
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="offset" className="block text-sm font-medium mb-1">
                Offset
              </label>
              <select
                id="offset"
                name="offset"
                value={formData.offset}
                onChange={handleInputChange}
                disabled={isLocked}
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              >
                <option value="">Select offset</option>
                {OFFSET_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="layer" className="block text-sm font-medium mb-1">
                Layer
              </label>
              <input
                type="text"
                id="layer"
                name="layer"
                value={formData.layer}
                onChange={handleInputChange}
                disabled={isLocked}
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="areaZone" className="block text-sm font-medium mb-1">
                Area/Zone
              </label>
              <input
                type="text"
                id="areaZone"
                name="areaZone"
                value={formData.areaZone}
                onChange={handleInputChange}
                disabled={isLocked}
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Commercial (only for users with budget access) */}
        {canViewBudgets && (
          <div className="rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Commercial</h2>

            <div>
              <label htmlFor="budgetAmount" className="block text-sm font-medium mb-1">
                Budget Amount ($)
              </label>
              <input
                type="number"
                id="budgetAmount"
                name="budgetAmount"
                value={formData.budgetAmount}
                onChange={handleInputChange}
                disabled={isLocked}
                step="0.01"
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}/lots/${lotId}`)}
            className="rounded-lg border px-6 py-2 hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLocked || saving}
            className="rounded-lg bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
