import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { handleApiError } from '@/lib/errorHandling'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import type { Lot } from '../lotsPageTypes'

// Lot number length constraints
const LOT_NUMBER_MIN_LENGTH = 3
const LOT_NUMBER_MAX_LENGTH = 50

// Chainage min/max constraints
const CHAINAGE_MIN = 0
const CHAINAGE_MAX = 999999

const createLotSchema = z.object({
  lotNumber: z.string()
    .min(1, 'Lot Number is required')
    .min(LOT_NUMBER_MIN_LENGTH, `Lot Number must be at least ${LOT_NUMBER_MIN_LENGTH} characters`)
    .max(LOT_NUMBER_MAX_LENGTH, `Lot Number must be at most ${LOT_NUMBER_MAX_LENGTH} characters`),
  description: z.string(),
  activityType: z.string(),
  chainageStart: z.string(),
  chainageEnd: z.string(),
  assignedSubcontractorId: z.string(),
  canCompleteITP: z.boolean(),
  itpRequiresVerification: z.boolean(),
}).refine(data => {
  if (data.chainageStart && data.chainageEnd) {
    const startNum = parseInt(data.chainageStart)
    const endNum = parseInt(data.chainageEnd)
    if (!isNaN(startNum) && !isNaN(endNum) && endNum < startNum) {
      return false
    }
  }
  return true
}, {
  message: 'Chainage End must be greater than or equal to Chainage Start',
  path: ['chainageEnd'],
}).refine(data => {
  if (data.chainageStart) {
    const startNum = parseInt(data.chainageStart)
    if (!isNaN(startNum) && (startNum < CHAINAGE_MIN || startNum > CHAINAGE_MAX)) {
      return false
    }
  }
  return true
}, {
  message: `Chainage Start must be between ${CHAINAGE_MIN} and ${CHAINAGE_MAX}`,
  path: ['chainageStart'],
}).refine(data => {
  if (data.chainageEnd) {
    const endNum = parseInt(data.chainageEnd)
    if (!isNaN(endNum) && (endNum < CHAINAGE_MIN || endNum > CHAINAGE_MAX)) {
      return false
    }
  }
  return true
}, {
  message: `Chainage End must be between ${CHAINAGE_MIN} and ${CHAINAGE_MAX}`,
  path: ['chainageEnd'],
})

type CreateLotFormData = z.infer<typeof createLotSchema>

interface CreateLotModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (lot: Lot) => void
  projectId: string
}

export function CreateLotModal({ isOpen, onClose, onSuccess, projectId }: CreateLotModalProps) {
  const [creating, setCreating] = useState(false)

  // ITP template suggestion state
  const [itpTemplates, setItpTemplates] = useState<{ id: string; name: string; activityType: string }[]>([])
  const [suggestedTemplate, setSuggestedTemplate] = useState<{ id: string; name: string } | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Subcontractors
  const [subcontractors, setSubcontractors] = useState<{ id: string; companyName: string }[]>([])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CreateLotFormData>({
    resolver: zodResolver(createLotSchema),
    mode: 'onBlur',
    defaultValues: {
      lotNumber: '',
      description: '',
      activityType: 'Earthworks',
      chainageStart: '',
      chainageEnd: '',
      assignedSubcontractorId: '',
      canCompleteITP: false,
      itpRequiresVerification: true,
    },
  })

  const activityType = watch('activityType')
  const assignedSubcontractorId = watch('assignedSubcontractorId')
  const canCompleteITP = watch('canCompleteITP')

  // Update suggested ITP template when activity type changes
  useEffect(() => {
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
  }, [activityType, itpTemplates])

  // Fetch data when modal opens
  useEffect(() => {
    if (!isOpen) return

    // Reset form
    reset({
      lotNumber: '',
      description: '',
      activityType: 'Earthworks',
      chainageStart: '',
      chainageEnd: '',
      assignedSubcontractorId: '',
      canCompleteITP: false,
      itpRequiresVerification: true,
    })
    setSuggestedTemplate(null)
    setSelectedTemplateId('')

    const fetchData = async () => {
      try {
        const [lotData, itpData, subData] = await Promise.all([
          apiFetch<{ suggestedNumber?: string }>(`/api/lots/suggest-number?projectId=${projectId}`),
          apiFetch<{ templates: any[] }>(`/api/itp/templates?projectId=${projectId}&includeGlobal=true`),
          apiFetch<{ subcontractors: { id: string; companyName: string }[] }>(`/api/subcontractors/for-project/${projectId}`),
        ])

        if (lotData.suggestedNumber) {
          setValue('lotNumber', lotData.suggestedNumber)
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
  }, [isOpen, projectId, reset, setValue])

  const handleClose = () => {
    setSuggestedTemplate(null)
    setSelectedTemplateId('')
    reset()
    onClose()
  }

  const onFormSubmit = async (formData: CreateLotFormData) => {
    if (creating) return

    setCreating(true)

    try {
      const data = await apiFetch<{ lot: Lot }>('/api/lots', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          lotNumber: formData.lotNumber,
          description: formData.description || null,
          activityType: formData.activityType,
          chainageStart: formData.chainageStart ? parseInt(formData.chainageStart) : null,
          chainageEnd: formData.chainageEnd ? parseInt(formData.chainageEnd) : null,
          itpTemplateId: selectedTemplateId || null,
          assignedSubcontractorId: formData.assignedSubcontractorId || null,
          canCompleteITP: formData.assignedSubcontractorId ? formData.canCompleteITP : undefined,
          itpRequiresVerification: formData.assignedSubcontractorId ? formData.itpRequiresVerification : undefined,
        }),
      })

      const createdLot: Lot = {
        ...data.lot,
        activityType: formData.activityType,
        chainageStart: formData.chainageStart ? parseInt(formData.chainageStart) : null,
        chainageEnd: formData.chainageEnd ? parseInt(formData.chainageEnd) : null,
      }

      const assignedTemplate = selectedTemplateId
        ? itpTemplates.find(t => t.id === selectedTemplateId)
        : null

      toast({
        title: 'Lot Created',
        description: assignedTemplate
          ? `Lot ${formData.lotNumber} created with ITP template "${assignedTemplate.name}"`
          : `Lot ${formData.lotNumber} has been created successfully`,
        variant: 'success',
      })

      onSuccess(createdLot)
    } catch (err) {
      handleApiError(err, 'Failed to create lot')
      setError('root', { message: 'Failed to create lot' })
    } finally {
      setCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal onClose={handleClose} className="max-w-lg">
      <ModalHeader>Create New Lot</ModalHeader>
      <ModalBody>
        <form id="create-lot-form" onSubmit={handleSubmit(onFormSubmit)}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="lot-number">
              Lot Number <span className="text-red-500">*</span>
              <span className="text-xs text-gray-500 ml-2">({LOT_NUMBER_MIN_LENGTH}-{LOT_NUMBER_MAX_LENGTH} chars)</span>
            </Label>
            <Input
              id="lot-number"
              type="text"
              {...register('lotNumber')}
              maxLength={LOT_NUMBER_MAX_LENGTH}
              className={errors.lotNumber ? 'border-destructive mt-1' : 'mt-1'}
              placeholder="e.g., LOT-001"
            />
            {errors.lotNumber && (
              <p className="text-sm text-red-600 mt-1" role="alert" aria-live="assertive">{errors.lotNumber.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="lot-description">
              Description
            </Label>
            <Input
              id="lot-description"
              type="text"
              {...register('description')}
              className="mt-1"
              placeholder="Optional description"
            />
          </div>

          <div>
            <Label htmlFor="lot-activity">
              Activity Type
            </Label>
            <NativeSelect
              id="lot-activity"
              {...register('activityType')}
              className="mt-1"
            >
              <option value="Earthworks">Earthworks</option>
              <option value="Concrete">Concrete</option>
              <option value="Drainage">Drainage</option>
              <option value="Pavement">Pavement</option>
              <option value="Structures">Structures</option>
              <option value="Utilities">Utilities</option>
            </NativeSelect>
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
            <Label htmlFor="lot-itp-template">
              ITP Template (Optional)
            </Label>
            <NativeSelect
              id="lot-itp-template"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="mt-1"
            >
              <option value="">No ITP template</option>
              {itpTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.activityType})
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="chainage-start">
                Chainage Start
              </Label>
              <Input
                id="chainage-start"
                type="number"
                {...register('chainageStart')}
                min={CHAINAGE_MIN}
                max={CHAINAGE_MAX}
                className={errors.chainageStart ? 'border-destructive mt-1' : 'mt-1'}
                placeholder="e.g., 0"
              />
              {errors.chainageStart && (
                <p className="text-sm text-red-600 mt-1" role="alert" aria-live="assertive">{errors.chainageStart.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="chainage-end">
                Chainage End
              </Label>
              <Input
                id="chainage-end"
                type="number"
                {...register('chainageEnd')}
                min={CHAINAGE_MIN}
                max={CHAINAGE_MAX}
                className={errors.chainageEnd ? 'border-destructive mt-1' : 'mt-1'}
                placeholder="e.g., 100"
              />
              {errors.chainageEnd && (
                <p className="text-sm text-red-600 mt-1" role="alert" aria-live="assertive">{errors.chainageEnd.message}</p>
              )}
            </div>
          </div>

          {/* Subcontractor assignment */}
          {subcontractors.length > 0 && (
            <div>
              <Label htmlFor="lot-subcontractor">
                Assign to Subcontractor (Optional)
              </Label>
              <NativeSelect
                id="lot-subcontractor"
                {...register('assignedSubcontractorId')}
                className="mt-1"
              >
                <option value="">No subcontractor assigned</option>
                {subcontractors.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.companyName}
                  </option>
                ))}
              </NativeSelect>

              {/* ITP permissions - only show when subcontractor is selected */}
              {assignedSubcontractorId && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-gray-700">ITP Permissions</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="can-complete-itp"
                      {...register('canCompleteITP')}
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
                      {...register('itpRequiresVerification')}
                      disabled={!canCompleteITP}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                    />
                    <label htmlFor="itp-requires-verification" className={`text-sm ${canCompleteITP ? 'text-gray-700' : 'text-gray-400'}`}>
                      Require verification (recommended)
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={creating}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-lot-form"
          disabled={creating}
        >
          {creating ? 'Creating...' : 'Create Lot'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
