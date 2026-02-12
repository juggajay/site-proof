import { memo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { NCR } from '../types'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Label } from '@/components/ui/label'

const respondNCRSchema = z.object({
  rootCauseCategory: z.string().min(1, 'Root cause category is required'),
  rootCauseDescription: z.string().min(1, 'Root cause description is required'),
  proposedCorrectiveAction: z.string().min(1, 'Proposed corrective action is required'),
})

type RespondNCRFormData = z.infer<typeof respondNCRSchema>

interface RespondNCRModalProps {
  isOpen: boolean
  ncr: NCR | null
  onClose: () => void
  onSubmit: (ncrId: string, data: {
    rootCauseCategory: string
    rootCauseDescription: string
    proposedCorrectiveAction: string
  }) => void
  loading: boolean
}

function RespondNCRModalInner({
  isOpen,
  ncr,
  onClose,
  onSubmit,
  loading,
}: RespondNCRModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RespondNCRFormData>({
    resolver: zodResolver(respondNCRSchema),
    mode: 'onBlur',
    defaultValues: {
      rootCauseCategory: '',
      rootCauseDescription: '',
      proposedCorrectiveAction: '',
    },
  })

  const onFormSubmit = (data: RespondNCRFormData) => {
    if (!ncr) return
    onSubmit(ncr.id, data)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!isOpen || !ncr) return null

  return (
    <Modal onClose={handleClose} className="max-w-lg">
      <ModalHeader>Respond to NCR {ncr.ncrNumber}</ModalHeader>
      <ModalBody>
        <div className="mb-4 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-sm">
          <span className="font-medium">Issue:</span> {ncr.description}
        </div>

        <form id="respond-ncr-form" onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="root-cause-category">Root Cause Category *</Label>
            <NativeSelect
              id="root-cause-category"
              {...register('rootCauseCategory')}
              className={errors.rootCauseCategory ? 'border-destructive mt-1' : 'mt-1'}
            >
              <option value="">Select root cause category</option>
              <option value="human_error">Human Error</option>
              <option value="equipment">Equipment</option>
              <option value="materials">Materials</option>
              <option value="process">Process</option>
              <option value="training">Training</option>
              <option value="other">Other</option>
            </NativeSelect>
            {errors.rootCauseCategory && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.rootCauseCategory.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="root-cause-description">Root Cause Description *</Label>
            <Textarea
              id="root-cause-description"
              {...register('rootCauseDescription')}
              className={errors.rootCauseDescription ? 'border-destructive mt-1' : 'mt-1'}
              rows={3}
              placeholder="Describe the root cause of this non-conformance..."
            />
            {errors.rootCauseDescription && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.rootCauseDescription.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="proposed-corrective-action">Proposed Corrective Action *</Label>
            <Textarea
              id="proposed-corrective-action"
              {...register('proposedCorrectiveAction')}
              className={errors.proposedCorrectiveAction ? 'border-destructive mt-1' : 'mt-1'}
              rows={3}
              placeholder="Describe the proposed corrective action to address this issue..."
            />
            {errors.proposedCorrectiveAction && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.proposedCorrectiveAction.message}</p>
            )}
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="respond-ncr-form"
          disabled={loading}
        >
          {loading ? 'Submitting...' : 'Submit Response'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export const RespondNCRModal = memo(RespondNCRModalInner)
