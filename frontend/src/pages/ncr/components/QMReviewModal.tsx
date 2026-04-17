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

const qmReviewSchema = z.object({
  qmReviewComments: z.string().optional().default(''),
})

type QMReviewFormData = z.infer<typeof qmReviewSchema>

interface QMReviewModalProps {
  isOpen: boolean
  ncr: NCR | null
  onClose: () => void
  onSuccess: () => void
}

function QMReviewModalInner({
  isOpen,
  ncr,
  onClose,
  onSuccess,
}: QMReviewModalProps) {
  const [submittingReview, setSubmittingReview] = useState(false)

  const {
    register,
    getValues,
    reset,
  } = useForm<QMReviewFormData>({
    resolver: zodResolver(qmReviewSchema),
    mode: 'onBlur',
    defaultValues: {
      qmReviewComments: '',
    },
  })

  const handleQmReview = async (action: 'accept' | 'request_revision') => {
    if (!ncr) return

    const { qmReviewComments } = getValues()
    setSubmittingReview(true)
    try {
      const data = await apiFetch<{ message: string }>(`/api/ncrs/${ncr.id}/qm-review`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          comments: qmReviewComments || undefined,
        }),
      })

      toast({
        title: action === 'accept' ? 'Response Accepted' : 'Revision Requested',
        description: data.message,
      })
      handleClose()
      onSuccess()
    } catch (err) {
      handleApiError(err, 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!isOpen || !ncr) return null

  return (
    <Modal onClose={handleClose} className="max-w-lg">
      <ModalHeader>Review NCR Response</ModalHeader>
      <ModalBody>
        <div className="mb-4 p-3 bg-muted/50 border border-border rounded-lg">
          <p className="text-sm font-medium text-foreground">{ncr.ncrNumber}</p>
          <p className="text-sm text-muted-foreground mt-1">{ncr.description}</p>
        </div>

        {/* Show submitted response details */}
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground mb-2">Submitted Response:</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <p className="text-amber-800">The responsible party has submitted a response. Review the root cause analysis and proposed corrective action.</p>
          </div>
        </div>

        <div className="mb-4">
          <Label>Review Comments (optional)</Label>
          <Textarea
            {...register('qmReviewComments')}
            placeholder="Add feedback or comments..."
            rows={3}
            className="mt-1"
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={submittingReview}
        >
          Cancel
        </Button>
        <Button
          onClick={() => handleQmReview('request_revision')}
          disabled={submittingReview}
          variant="outline"
        >
          {submittingReview ? 'Processing...' : 'Request Revision'}
        </Button>
        <Button
          onClick={() => handleQmReview('accept')}
          disabled={submittingReview}
          variant="success"
        >
          {submittingReview ? 'Processing...' : 'Accept Response'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export const QMReviewModal = memo(QMReviewModalInner)
