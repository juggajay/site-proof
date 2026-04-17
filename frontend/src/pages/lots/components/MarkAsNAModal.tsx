import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const markAsNASchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
})

type MarkAsNAFormData = z.infer<typeof markAsNASchema>

interface MarkAsNAModalProps {
  isOpen: boolean
  itemDescription: string
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
  isSubmitting: boolean
}

export function MarkAsNAModal({
  isOpen,
  itemDescription,
  onClose,
  onSubmit,
  isSubmitting
}: MarkAsNAModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MarkAsNAFormData>({
    resolver: zodResolver(markAsNASchema),
    mode: 'onBlur',
    defaultValues: { reason: '' },
  })

  useEffect(() => { if (isOpen) reset() }, [isOpen, reset])

  const onFormSubmit = (data: MarkAsNAFormData) => {
    onSubmit(data.reason)
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
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground">
            <span className="text-xl font-bold">&mdash;</span>
          </div>
          <div>
            <div className="text-lg font-semibold">Mark as Not Applicable</div>
            <p className="text-sm text-muted-foreground font-normal">This item will be skipped</p>
          </div>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">{itemDescription}</p>
        </div>

        <form id="mark-na-form" onSubmit={handleSubmit(onFormSubmit)}>
          <div className="mb-4">
            <Label>
              Reason for N/A <span className="text-red-500">*</span>
            </Label>
            <Textarea
              {...register('reason')}
              placeholder="Enter reason why this item is not applicable..."
              className={errors.reason ? 'border-destructive mt-1' : 'mt-1'}
              rows={3}
              autoFocus
            />
            {errors.reason && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.reason.message}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              A reason is required to mark an item as N/A
            </p>
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
          form="mark-na-form"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Mark as N/A'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
