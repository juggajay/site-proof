import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { extractErrorMessage } from '@/lib/errorHandling'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
            <Label className="mb-1">Project Name</Label>
            <Input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Project name"
            />
          </div>
          <div>
            <Label className="mb-1">Project Code</Label>
            <Input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              placeholder="PRJ-001"
            />
          </div>
        </div>
        {(project?.startDate || project?.targetCompletion) && (
          <div className="mt-4 pt-4 border-t grid gap-4 sm:grid-cols-2">
            {project?.startDate && (
              <div>
                <Label className="mb-1">Start Date</Label>
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
                <Label className="mb-1">Target Completion</Label>
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
            <Label className="mb-1">Contract Value</Label>
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
            <Label className="mb-1">Lot Prefix</Label>
            <Input
              type="text"
              name="lotPrefix"
              value={formData.lotPrefix}
              onChange={handleInputChange}
              placeholder="LOT-"
            />
          </div>
          <div>
            <Label className="mb-1">Starting Number</Label>
            <Input
              type="number"
              name="lotStartingNumber"
              value={formData.lotStartingNumber}
              onChange={handleInputChange}
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
            <Label className="mb-1">NCR Prefix</Label>
            <Input
              type="text"
              name="ncrPrefix"
              value={formData.ncrPrefix}
              onChange={handleInputChange}
              placeholder="NCR-"
            />
          </div>
          <div>
            <Label className="mb-1">Starting Number</Label>
            <Input
              type="number"
              name="ncrStartingNumber"
              value={formData.ncrStartingNumber}
              onChange={handleInputChange}
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
            <Label className="mb-1">Chainage Start (m)</Label>
            <Input
              type="number"
              name="chainageStart"
              value={formData.chainageStart}
              onChange={handleInputChange}
              placeholder="0"
              min="0"
            />
          </div>
          <div>
            <Label className="mb-1">Chainage End (m)</Label>
            <Input
              type="number"
              name="chainageEnd"
              value={formData.chainageEnd}
              onChange={handleInputChange}
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
            <Label className="mb-1">Start Time</Label>
            <Input
              type="time"
              name="workingHoursStart"
              value={formData.workingHoursStart}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label className="mb-1">End Time</Label>
            <Input
              type="time"
              name="workingHoursEnd"
              value={formData.workingHoursEnd}
              onChange={handleInputChange}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveSettings}
          disabled={saving}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </>
  )
}
