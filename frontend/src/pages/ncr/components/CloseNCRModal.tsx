import { memo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { NCR } from '../types'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const closeNCRSchema = z.object({
  verificationNotes: z.string().optional().default(''),
  lessonsLearned: z.string().optional().default(''),
})

type CloseNCRFormData = z.infer<typeof closeNCRSchema>

interface CloseNCRModalProps {
  isOpen: boolean
  ncr: NCR | null
  onClose: () => void
  onSubmit: (ncrId: string, data: { verificationNotes: string; lessonsLearned: string }) => void
  loading: boolean
}

function CloseNCRModalInner({
  isOpen,
  ncr,
  onClose,
  onSubmit,
  loading,
}: CloseNCRModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CloseNCRFormData>({
    resolver: zodResolver(closeNCRSchema),
    mode: 'onBlur',
    defaultValues: {
      verificationNotes: '',
      lessonsLearned: '',
    },
  })

  const onFormSubmit = (data: CloseNCRFormData) => {
    if (!ncr) return
    onSubmit(ncr.id, { verificationNotes: data.verificationNotes ?? '', lessonsLearned: data.lessonsLearned ?? '' })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!isOpen || !ncr) return null

  return (
    <Modal onClose={handleClose} className="max-w-lg">
      <ModalHeader>Close NCR {ncr.ncrNumber}</ModalHeader>
      <ModalBody>
        {ncr.severity === 'major' && ncr.qmApprovedAt && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
            QM Approval granted by {ncr.qmApprovedBy?.fullName || 'Quality Manager'}
          </div>
        )}

        <form id="close-ncr-form" onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div>
            <Label>Verification Notes</Label>
            <Textarea
              {...register('verificationNotes')}
              className={errors.verificationNotes ? 'border-destructive mt-1' : 'mt-1'}
              rows={3}
              placeholder="Notes about the verification and closure..."
            />
            {errors.verificationNotes && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.verificationNotes.message}</p>
            )}
          </div>
          {/* Feature #474: Lessons Learned Recording */}
          <div>
            <Label>Lessons Learned</Label>
            <Textarea
              {...register('lessonsLearned')}
              className={errors.lessonsLearned ? 'border-destructive mt-1' : 'mt-1'}
              rows={3}
              placeholder="What lessons can be learned from this NCR? How can similar issues be prevented in the future?"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Document insights for continuous improvement and future reference.
            </p>
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
          form="close-ncr-form"
          variant="success"
          disabled={loading}
        >
          {loading ? 'Closing...' : 'Close NCR'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export const CloseNCRModal = memo(CloseNCRModalInner)
