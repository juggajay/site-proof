import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { extractErrorMessage } from '@/lib/errorHandling';
import { TEST_REJECTION_REASON_MAX_LENGTH } from '../constants';

const rejectTestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(
      TEST_REJECTION_REASON_MAX_LENGTH,
      `Reason must be ${TEST_REJECTION_REASON_MAX_LENGTH.toLocaleString()} characters or less`,
    ),
});

type RejectTestFormData = z.infer<typeof rejectTestSchema>;

interface RejectTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (testId: string, reason: string) => Promise<void>;
  rejectingTestId: string | null;
}

export const RejectTestModal = React.memo(function RejectTestModal({
  isOpen,
  onClose,
  onSubmit,
  rejectingTestId,
}: RejectTestModalProps) {
  const [rejecting, setRejecting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const rejectingRef = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RejectTestFormData>({
    resolver: zodResolver(rejectTestSchema),
    mode: 'onBlur',
    defaultValues: { reason: '' },
  });
  const reason = watch('reason') || '';
  const reasonLength = reason.trim().length;

  useEffect(() => {
    if (isOpen) {
      reset();
      setFormError(null);
    }
  }, [isOpen, reset]);

  const handleClose = useCallback(() => {
    reset();
    setFormError(null);
    onClose();
  }, [onClose, reset]);

  const onFormSubmit = useCallback(
    async (data: RejectTestFormData) => {
      if (!rejectingTestId || rejectingRef.current) return;

      rejectingRef.current = true;
      setRejecting(true);
      setFormError(null);

      try {
        await onSubmit(rejectingTestId, data.reason);
        reset();
      } catch (err) {
        setFormError(extractErrorMessage(err, 'Failed to reject test.'));
      } finally {
        rejectingRef.current = false;
        setRejecting(false);
      }
    },
    [rejectingTestId, onSubmit, reset],
  );

  if (!isOpen) return null;

  return (
    <Modal onClose={handleClose} className="max-w-md">
      <ModalHeader>
        <span className="text-red-600">Reject Test Verification</span>
      </ModalHeader>
      <ModalDescription>
        Provide rejection feedback and return this test result for correction.
      </ModalDescription>
      <ModalBody>
        {formError && (
          <div
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {formError}
          </div>
        )}
        <p className="text-sm text-muted-foreground mb-4">
          Please provide a reason for rejecting this test result. The engineer will be notified and
          can re-enter the data.
        </p>
        <form id="reject-test-form" onSubmit={handleSubmit(onFormSubmit)}>
          <div className="mb-4">
            <Label>Rejection Reason *</Label>
            <Textarea
              {...register('reason')}
              placeholder="Enter the reason for rejection (e.g., incorrect values, missing data, doesn't match certificate)"
              rows={4}
              className={errors.reason ? 'border-destructive' : ''}
              maxLength={TEST_REJECTION_REASON_MAX_LENGTH}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {reasonLength.toLocaleString()}/{TEST_REJECTION_REASON_MAX_LENGTH.toLocaleString()}
            </p>
            {errors.reason && (
              <p className="text-sm text-destructive mt-1" role="alert">
                {errors.reason.message}
              </p>
            )}
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={handleClose} disabled={rejecting}>
          Cancel
        </Button>
        <Button variant="destructive" type="submit" form="reject-test-form" disabled={rejecting}>
          {rejecting ? 'Rejecting...' : 'Reject Test'}
        </Button>
      </ModalFooter>
    </Modal>
  );
});
