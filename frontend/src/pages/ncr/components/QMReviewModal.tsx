import { useRef, useState, memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { handleApiError } from '@/lib/errorHandling';
import type { NCR } from '../types';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const qmReviewSchema = z.object({
  qmReviewComments: z.string().trim().optional().default(''),
});

type QMReviewFormData = z.infer<typeof qmReviewSchema>;

interface QMReviewModalProps {
  isOpen: boolean;
  ncr: NCR | null;
  onClose: () => void;
  onSuccess: () => void;
}

function QMReviewModalInner({ isOpen, ncr, onClose, onSuccess }: QMReviewModalProps) {
  const [submittingReview, setSubmittingReview] = useState(false);
  const submittingReviewRef = useRef(false);

  const { register, getValues, reset } = useForm<QMReviewFormData>({
    resolver: zodResolver(qmReviewSchema),
    mode: 'onBlur',
    defaultValues: {
      qmReviewComments: '',
    },
  });

  const handleQmReview = async (action: 'accept' | 'request_revision') => {
    if (!ncr || submittingReviewRef.current) return;

    const { qmReviewComments } = getValues();
    submittingReviewRef.current = true;
    setSubmittingReview(true);
    try {
      const data = await apiFetch<{ message: string }>(
        `/api/ncrs/${encodeURIComponent(ncr.id)}/qm-review`,
        {
          method: 'POST',
          body: JSON.stringify({
            action,
            comments: qmReviewComments?.trim() || undefined,
          }),
        },
      );

      toast({
        title: action === 'accept' ? 'Response Accepted' : 'Revision Requested',
        description: data.message,
      });
      handleClose();
      onSuccess();
    } catch (err) {
      handleApiError(err, 'Failed to submit review');
    } finally {
      submittingReviewRef.current = false;
      setSubmittingReview(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen || !ncr) return null;

  return (
    <Modal onClose={handleClose} className="max-w-lg">
      <ModalHeader>Review NCR Response</ModalHeader>
      <ModalBody>
        <div className="mb-4 p-3 bg-muted/50 border border-border rounded-lg">
          <p className="text-sm font-medium text-foreground">{ncr.ncrNumber}</p>
          <p className="text-sm text-muted-foreground mt-1">{ncr.description}</p>
        </div>

        {/* Show the submitted response details so the QM reviews the actual
            root cause and corrective action, not a boilerplate placeholder. */}
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground mb-2">Submitted Response:</p>
          {ncr.rootCauseCategory || ncr.rootCauseDescription || ncr.proposedCorrectiveAction ? (
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm space-y-3">
              {ncr.rootCauseCategory && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Root cause category</p>
                  <p className="text-foreground whitespace-pre-wrap">{ncr.rootCauseCategory}</p>
                </div>
              )}
              {ncr.rootCauseDescription && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Root cause analysis</p>
                  <p className="text-foreground whitespace-pre-wrap">{ncr.rootCauseDescription}</p>
                </div>
              )}
              {ncr.proposedCorrectiveAction && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Proposed corrective action
                  </p>
                  <p className="text-foreground whitespace-pre-wrap">
                    {ncr.proposedCorrectiveAction}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">
                No response details were captured for this NCR.
              </p>
            </div>
          )}
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
        <Button type="button" variant="outline" onClick={handleClose} disabled={submittingReview}>
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
  );
}

export const QMReviewModal = memo(QMReviewModalInner);
