import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { extractErrorMessage } from '@/lib/errorHandling'
import type { Project, GeneralFormData } from '../types'
import { DEFAULT_FORM_DATA } from '../types'

interface GeneralSettingsTabProps {
  projectId: string
  project: Project
  canViewContractValue: boolean
  onProjectUpdate: (project: Project) => void
}

export function GeneralSettingsTab({
  projectId,
  project,
  canViewContractValue,
  onProjectUpdate,
}: GeneralSettingsTabProps) {
  const [formData, setFormData] = useState<GeneralFormData>({ ...DEFAULT_FORM_DATA })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Initialize form data from project
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        code: project.code || '',
        lotPrefix: project.lotPrefix || 'LOT-',
        lotStartingNumber: project.lotStartingNumber || 1,
        ncrPrefix: project.ncrPrefix || 'NCR-',
        ncrStartingNumber: project.ncrStartingNumber || 1,
        chainageStart: project.chainageStart ?? 0,
        chainageEnd: project.chainageEnd ?? 10000,
        workingHoursStart: project.workingHoursStart || '06:00',
        workingHoursEnd: project.workingHoursEnd || '18:00',
      })
    }
  }, [project])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value,
    }))
    // Clear success message when user starts typing
    if (saveSuccess) setSaveSuccess(false)
  }

  const handleSaveSettings = async () => {
    setSaveError('')
    setSaveSuccess(false)

    // Client-side validation
    if (!formData.name.trim()) {
      setSaveError('Project name is required')
      return
    }

    if (formData.lotPrefix.length > 50) {
      setSaveError('Lot prefix must be 50 characters or less')
      return
    }

    if (formData.ncrPrefix.length > 50) {
      setSaveError('NCR prefix must be 50 characters or less')
      return
    }

    if (formData.lotStartingNumber < 0) {
      setSaveError('Lot starting number must be a positive number')
      return
    }

    if (formData.ncrStartingNumber < 0) {
      setSaveError('NCR starting number must be a positive number')
      return
    }

    if (formData.chainageStart < 0) {
      setSaveError('Chainage start must be a non-negative number')
      return
    }

    if (formData.chainageEnd < 0) {
      setSaveError('Chainage end must be a non-negative number')
      return
    }

    if (formData.chainageStart >= formData.chainageEnd) {
      setSaveError('Chainage end must be greater than chainage start')
      return
    }

    setSaving(true)

    try {
      const data = await apiFetch<{ project: Project }>(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          lotPrefix: formData.lotPrefix,
          lotStartingNumber: formData.lotStartingNumber,
          ncrPrefix: formData.ncrPrefix,
          ncrStartingNumber: formData.ncrStartingNumber,
          chainageStart: formData.chainageStart,
          chainageEnd: formData.chainageEnd,
          workingHoursStart: formData.workingHoursStart,
          workingHoursEnd: formData.workingHoursEnd,
        }),
      })
      onProjectUpdate(data.project)
      setSaveSuccess(true)
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      setSaveError(extractErrorMessage(error, 'Failed to save settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Save Status Messages */}
      {saveError && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive mb-4">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700 mb-4">
          Settings saved successfully!
        </div>
      )}

      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">General Settings</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure project name, number, and basic settings.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Project Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="Project name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Project Code</label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="PRJ-001"
            />
          </div>
        </div>
        {(project?.startDate || project?.targetCompletion) && (
          <div className="mt-4 pt-4 border-t grid gap-4 sm:grid-cols-2">
            {project?.startDate && (
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <div className="text-sm text-muted-foreground">
                  {new Date(project.startDate).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>
            )}
            {project?.targetCompletion && (
              <div>
                <label className="block text-sm font-medium mb-1">Target Completion</label>
                <div className="text-sm text-muted-foreground">
                  {new Date(project.targetCompletion).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {canViewContractValue && project?.contractValue && (
          <div className="mt-4 pt-4 border-t">
            <label className="block text-sm font-medium mb-1">Contract Value</label>
            <div className="text-sm text-muted-foreground">
              ${Number(project.contractValue).toLocaleString('en-AU', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </div>
          </div>
        )}
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Lot Numbering</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure lot numbering convention and auto-increment settings.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Lot Prefix</label>
            <input
              type="text"
              name="lotPrefix"
              value={formData.lotPrefix}
              onChange={handleInputChange}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="LOT-"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Starting Number</label>
            <input
              type="number"
              name="lotStartingNumber"
              value={formData.lotStartingNumber}
              onChange={handleInputChange}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="1"
            />
          </div>
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">NCR Numbering</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure non-conformance report numbering convention.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">NCR Prefix</label>
            <input
              type="text"
              name="ncrPrefix"
              value={formData.ncrPrefix}
              onChange={handleInputChange}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="NCR-"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Starting Number</label>
            <input
              type="number"
              name="ncrStartingNumber"
              value={formData.ncrStartingNumber}
              onChange={handleInputChange}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="1"
            />
          </div>
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Chainage Configuration</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure the chainage range for this project. Lot chainages will be constrained to this range.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Chainage Start (m)</label>
            <input
              type="number"
              name="chainageStart"
              value={formData.chainageStart}
              onChange={handleInputChange}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="0"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Chainage End (m)</label>
            <input
              type="number"
              name="chainageEnd"
              value={formData.chainageEnd}
              onChange={handleInputChange}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="10000"
              min="0"
            />
          </div>
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Working Hours</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure the project's working hours for notifications and due date calculations.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="time"
              name="workingHoursStart"
              value={formData.workingHoursStart}
              onChange={handleInputChange}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <input
              type="time"
              name="workingHoursEnd"
              value={formData.workingHoursEnd}
              onChange={handleInputChange}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </>
  )
}
