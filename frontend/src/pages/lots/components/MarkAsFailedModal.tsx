import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Label } from '@/components/ui/label'

const markAsFailedSchema = z.object({
  description: z.string().min(1, 'NCR Description is required'),
  category: z.string().min(1, 'Category is required'),
  severity: z.string().min(1, 'Severity is required'),
})

type MarkAsFailedFormData = z.infer<typeof markAsFailedSchema>

interface MarkAsFailedModalProps {
  isOpen: boolean
  itemDescription: string
  onClose: () => void
  onSubmit: (description: string, category: string, severity: string) => Promise<void>
  isSubmitting: boolean
}

export function MarkAsFailedModal({
  isOpen,
  itemDescription,
  onClose,
  onSubmit,
  isSubmitting
}: MarkAsFailedModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MarkAsFailedFormData>({
    resolver: zodResolver(markAsFailedSchema),
    mode: 'onBlur',
    defaultValues: {
      description: '',
      category: 'workmanship',
      severity: 'minor',
    },
  })

  useEffect(() => { if (isOpen) reset() }, [isOpen, reset])

  const onFormSubmit = (data: MarkAsFailedFormData) => {
    onSubmit(data.description.trim(), data.category, data.severity)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!isOpen) return null

  return (
    <Modal onClose={handleClose}>
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400">
            <span className="text-xl font-bold">&#10007;</span>
          </div>
          <div>
            <div className="text-lg font-semibold">Mark as Failed</div>
            <p className="text-sm text-muted-foreground font-normal">This will raise an NCR</p>
          </div>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">{itemDescription}</p>
        </div>

        <form id="mark-failed-form" onSubmit={handleSubmit(onFormSubmit)}>
          <div className="space-y-4">
            <div>
              <Label>
                NCR Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                {...register('description')}
                placeholder="Describe the non-conformance..."
                className={errors.description ? 'border-destructive mt-1' : 'mt-1'}
                rows={3}
                autoFocus
              />
              {errors.description && (
                <p className="text-sm text-destructive mt-1" role="alert">{errors.description.message}</p>
              )}
            </div>

            <div>
              <Label>Category</Label>
              <NativeSelect
                {...register('category')}
                className="mt-1"
              >
                <option value="workmanship">Workmanship</option>
                <option value="material">Material</option>
                <option value="design">Design</option>
                <option value="documentation">Documentation</option>
                <option value="process">Process</option>
                <option value="other">Other</option>
              </NativeSelect>
            </div>

            <div>
              <Label>Severity</Label>
              <NativeSelect
                {...register('severity')}
                className="mt-1"
              >
                <option value="minor">Minor</option>
                <option value="major">Major (requires QM approval to close)</option>
              </NativeSelect>
            </div>
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="mark-failed-form"
          variant="destructive"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating NCR...' : 'Mark as Failed & Raise NCR'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
