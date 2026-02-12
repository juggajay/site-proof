import { useState, useEffect, memo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getAuthToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Label } from '@/components/ui/label'

const createNCRSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  severity: z.string().min(1, 'Severity is required'),
  specificationReference: z.string().optional().default(''),
  dueDate: z.string().optional().default(''),
})

type CreateNCRFormData = z.infer<typeof createNCRSchema>

interface CreateNCRModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    description: string
    category: string
    severity: string
    specificationReference?: string
    lotIds?: string[]
    dueDate?: string
  }) => void
  loading: boolean
  projectId?: string
}

function CreateNCRModalInner({
  isOpen,
  onClose,
  onSubmit,
  loading,
  projectId,
}: CreateNCRModalProps) {
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([])
  const [lots, setLots] = useState<Array<{ id: string; lotNumber: string; description: string }>>([])
  const [lotsLoading, setLotsLoading] = useState(true)
  const token = getAuthToken()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateNCRFormData>({
    resolver: zodResolver(createNCRSchema),
    mode: 'onBlur',
    defaultValues: {
      description: '',
      category: '',
      severity: 'minor',
      specificationReference: '',
      dueDate: '',
    },
  })

  const severity = watch('severity')

  // Fetch lots for this project
  useEffect(() => {
    const fetchLots = async () => {
      if (!projectId) {
        setLotsLoading(false)
        return
      }
      try {
        const data = await apiFetch<{ lots: Array<{ id: string; lotNumber: string; description: string }> }>(`/api/lots?projectId=${projectId}`)
        setLots(data.lots || [])
      } catch (err) {
        console.error('Failed to fetch lots:', err)
      } finally {
        setLotsLoading(false)
      }
    }
    fetchLots()
  }, [projectId, token])

  const handleLotToggle = (lotId: string) => {
    setSelectedLotIds(prev =>
      prev.includes(lotId)
        ? prev.filter(id => id !== lotId)
        : [...prev, lotId]
    )
  }

  const onFormSubmit = (data: CreateNCRFormData) => {
    onSubmit({
      description: data.description,
      category: data.category,
      severity: data.severity,
      specificationReference: data.specificationReference || undefined,
      lotIds: selectedLotIds.length > 0 ? selectedLotIds : undefined,
      dueDate: data.dueDate || undefined,
    })
  }

  if (!isOpen) return null

  return (
    <Modal onClose={onClose} className="max-w-lg">
      <ModalHeader>Raise Non-Conformance Report</ModalHeader>
      <ModalBody>
        <form id="create-ncr-form" onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="ncr-description">Description *</Label>
            <Textarea
              id="ncr-description"
              {...register('description')}
              className={errors.description ? 'border-destructive mt-1' : 'mt-1'}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.description.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="ncr-category">Category *</Label>
            <NativeSelect
              id="ncr-category"
              {...register('category')}
              className={errors.category ? 'border-destructive mt-1' : 'mt-1'}
            >
              <option value="">Select category</option>
              <option value="materials">Materials</option>
              <option value="workmanship">Workmanship</option>
              <option value="documentation">Documentation</option>
              <option value="process">Process</option>
              <option value="design">Design</option>
              <option value="other">Other</option>
            </NativeSelect>
            {errors.category && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.category.message}</p>
            )}
          </div>
          <div>
            <Label>Affected Lots</Label>
            {lotsLoading ? (
              <p className="text-sm text-muted-foreground">Loading lots...</p>
            ) : lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lots available</p>
            ) : (
              <div className="border rounded-lg max-h-40 overflow-y-auto p-2 space-y-1 mt-1">
                {lots.map((lot) => (
                  <label key={lot.id} className="flex items-center gap-2 p-1 hover:bg-muted/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLotIds.includes(lot.id)}
                      onChange={() => handleLotToggle(lot.id)}
                      className="rounded"
                    />
                    <span className="text-sm">
                      <span className="font-medium">{lot.lotNumber}</span>
                      {lot.description && <span className="text-muted-foreground"> - {lot.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {selectedLotIds.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedLotIds.length} lot{selectedLotIds.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          <div>
            <Label>Severity *</Label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="minor"
                  {...register('severity')}
                />
                <span>Minor</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="major"
                  {...register('severity')}
                />
                <span className="text-red-600 font-medium">Major</span>
              </label>
            </div>
            {errors.severity && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.severity.message}</p>
            )}
            {severity === 'major' && (
              <p className="text-amber-600 text-sm mt-1">
                Major NCRs require Quality Manager approval before closure.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="ncr-spec-reference">Specification Reference</Label>
            <Input
              id="ncr-spec-reference"
              type="text"
              {...register('specificationReference')}
              className={errors.specificationReference ? 'border-destructive mt-1' : 'mt-1'}
              placeholder="e.g., MRTS05, Q6-2021"
            />
          </div>
          <div>
            <Label htmlFor="ncr-due-date">Due Date</Label>
            <Input
              id="ncr-due-date"
              type="date"
              {...register('dueDate')}
              className={errors.dueDate ? 'border-destructive mt-1' : 'mt-1'}
            />
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-ncr-form"
          variant="destructive"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Raise NCR'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export const CreateNCRModal = memo(CreateNCRModalInner)
