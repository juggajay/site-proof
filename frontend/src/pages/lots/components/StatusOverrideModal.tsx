import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { RefreshCw } from 'lucide-react'
import { lotStatusColors } from '../constants'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Label } from '@/components/ui/label'

export interface StatusOption {
  value: string
  label: string
}

const statusOverrideSchema = z.object({
  selectedStatus: z.string().min(1, 'Please select a new status'),
  reason: z.string().min(1, 'Reason for override is required'),
})

type StatusOverrideFormData = z.infer<typeof statusOverrideSchema>

interface StatusOverrideModalProps {
  isOpen: boolean
  currentStatus: string
  validStatuses: StatusOption[]
  onClose: () => void
  onSubmit: (newStatus: string, reason: string) => Promise<void>
  isSubmitting: boolean
}

export function StatusOverrideModal({
  isOpen,
  currentStatus,
  validStatuses,
  onClose,
  onSubmit,
  isSubmitting
}: StatusOverrideModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StatusOverrideFormData>({
    resolver: zodResolver(statusOverrideSchema),
    mode: 'onBlur',
    defaultValues: {
      selectedStatus: '',
      reason: '',
    },
  })

  useEffect(() => { if (isOpen) reset() }, [isOpen, reset])

  const onFormSubmit = (data: StatusOverrideFormData) => {
    onSubmit(data.selectedStatus, data.reason)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!isOpen) return null

  // Filter out current status from options
  const availableStatuses = validStatuses.filter(s => s.value !== currentStatus)

  return (
    <Modal onClose={handleClose}>
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 text-purple-600">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-semibold">Override Status</div>
            <p className="text-sm text-muted-foreground font-normal">Manually change the lot status</p>
          </div>
        </div>
      </ModalHeader>
      <ModalBody>
        <form id="status-override-form" onSubmit={handleSubmit(onFormSubmit)}>
          <div className="space-y-4">
            <div>
              <Label>Current Status</Label>
              <div className={`mt-1 px-3 py-2 rounded border ${lotStatusColors[currentStatus] || 'bg-muted text-muted-foreground'}`}>
                {currentStatus.replace('_', ' ')}
              </div>
            </div>

            <div>
              <Label htmlFor="override-status">
                New Status <span className="text-red-500">*</span>
              </Label>
              <NativeSelect
                id="override-status"
                {...register('selectedStatus')}
                className={errors.selectedStatus ? 'border-destructive mt-1' : 'mt-1'}
              >
                <option value="">Select new status...</option>
                {availableStatuses.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </NativeSelect>
              {errors.selectedStatus && (
                <p className="text-sm text-destructive mt-1" role="alert">{errors.selectedStatus.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="override-reason">
                Reason for Override <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="override-reason"
                {...register('reason')}
                placeholder="Explain why you are overriding the status..."
                rows={3}
                className={errors.reason ? 'border-destructive mt-1' : 'mt-1'}
              />
              {errors.reason && (
                <p className="text-sm text-destructive mt-1" role="alert">{errors.reason.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                This reason will be recorded in the lot history for audit purposes.
              </p>
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
          form="status-override-form"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Overriding...' : 'Override Status'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
