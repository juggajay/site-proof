import { useState, memo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { handleApiError } from '@/lib/errorHandling'
import type { NCR } from '../types'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const rejectRectificationSchema = z.object({
  feedback: z.string().min(1, 'Feedback is required'),
})

type RejectRectificationFormData = z.infer<typeof rejectRectificationSchema>

interface RejectRectificationModalProps {
  isOpen: boolean
  ncr: NCR | null
  onClose: () => void
  onSuccess: () => void
}

function RejectRectificationModalInner({
  isOpen,
  ncr,
  onClose,
  onSuccess,
}: RejectRectificationModalProps) {
  const [rejectingRectification, setRejectingRectification] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectRectificationFormData>({
    resolver: zodResolver(rejectRectificationSchema),
    mode: 'onBlur',
    defaultValues: {
      feedback: '',
    },
  })

  const onFormSubmit = async (data: RejectRectificationFormData) => {
    if (!ncr) return

    setRejectingRectification(true)
    try {
      await apiFetch(`/api/ncrs/${ncr.id}/reject-rectification`, {
        method: 'POST',
        body: JSON.stringify({ feedback: data.feedback }),
      })

      toast({
        title: 'Rectification Rejected',
        description: 'NCR has been returned to rectification status and responsible party notified',
      })
      handleClose()
      onSuccess()
    } catch (err) {
      handleApiError(err, 'Failed to reject rectification')
    } finally {
      setRejectingRectification(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!isOpen || !ncr) return null

  return (
    <Modal onClose={handleClose}>
      <ModalHeader>
        <span className="text-red-600">Reject Rectification</span>
      </ModalHeader>
      <ModalBody>
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm font-medium text-gray-800">{ncr.ncrNumber}</p>
          <p className="text-sm text-gray-600 mt-1">{ncr.description}</p>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          The rectification will be rejected and returned to the responsible party for additional work.
          Please provide feedback explaining what needs to be improved.
        </p>

        <form id="reject-rectification-form" onSubmit={handleSubmit(onFormSubmit)}>
          <div className="mb-4">
            <Label>Feedback / Issues Found *</Label>
            <Textarea
              {...register('feedback')}
              placeholder="Describe the issues with the rectification and what needs to be addressed..."
              rows={4}
              className={errors.feedback ? 'border-destructive mt-1' : 'mt-1'}
            />
            {errors.feedback && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.feedback.message}</p>
            )}
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={rejectingRectification}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="reject-rectification-form"
          variant="destructive"
          disabled={rejectingRectification}
        >
          {rejectingRectification ? 'Rejecting...' : 'Reject Rectification'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export const RejectRectificationModal = memo(RejectRectificationModalInner)
