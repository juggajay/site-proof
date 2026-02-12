import React, { useState, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const rejectTestSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
})

type RejectTestFormData = z.infer<typeof rejectTestSchema>

interface RejectTestModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (testId: string, reason: string) => Promise<void>
  rejectingTestId: string | null
}

export const RejectTestModal = React.memo(function RejectTestModal({
  isOpen,
  onClose,
  onSubmit,
  rejectingTestId,
}: RejectTestModalProps) {
  const [rejecting, setRejecting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectTestFormData>({
    resolver: zodResolver(rejectTestSchema),
    mode: 'onBlur',
    defaultValues: { reason: '' },
  })

  useEffect(() => { if (isOpen) reset() }, [isOpen, reset])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const onFormSubmit = useCallback(async (data: RejectTestFormData) => {
    if (!rejectingTestId) return

    setRejecting(true)

    try {
      await onSubmit(rejectingTestId, data.reason.trim())
      reset()
    } catch {
      // Error handled by parent
    } finally {
      setRejecting(false)
    }
  }, [rejectingTestId, onSubmit, reset])

  if (!isOpen) return null

  return (
    <Modal onClose={handleClose} className="max-w-md">
      <ModalHeader>
        <span className="text-red-600">Reject Test Verification</span>
      </ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground mb-4">
          Please provide a reason for rejecting this test result. The engineer will be notified and can re-enter the data.
        </p>
        <form id="reject-test-form" onSubmit={handleSubmit(onFormSubmit)}>
          <div className="mb-4">
            <Label>Rejection Reason *</Label>
            <Textarea
              {...register('reason')}
              placeholder="Enter the reason for rejection (e.g., incorrect values, missing data, doesn't match certificate)"
              rows={4}
              className={errors.reason ? 'border-destructive' : ''}
            />
            {errors.reason && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.reason.message}</p>
            )}
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={handleClose} disabled={rejecting}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          type="submit"
          form="reject-test-form"
          disabled={rejecting}
        >
          {rejecting ? 'Rejecting...' : 'Reject Test'}
        </Button>
      </ModalFooter>
    </Modal>
  )
})
