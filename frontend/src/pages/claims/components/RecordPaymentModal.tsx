import React, { useMemo, useRef, useState } from 'react';
import { DollarSign } from 'lucide-react';
import type { Claim, ClaimPaymentFormData } from '../types';
import { formatCurrency } from '../utils';
import { CLAIM_PAYMENT_NOTES_MAX_LENGTH, CLAIM_PAYMENT_REFERENCE_MAX_LENGTH } from '../constants';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseOptionalNonNegativeDecimalInput } from '@/lib/numericInput';

interface RecordPaymentModalProps {
  claim: Claim;
  onClose: () => void;
  onRecordPayment: (claimId: string, payment: ClaimPaymentFormData) => Promise<void>;
}

export const RecordPaymentModal = React.memo(function RecordPaymentModal({
  claim,
  onClose,
  onRecordPayment,
}: RecordPaymentModalProps) {
  const outstandingAmount = Math.max(0, (claim.certifiedAmount ?? 0) - (claim.paidAmount ?? 0));
  const [paymentAmount, setPaymentAmount] = useState(() =>
    outstandingAmount > 0 ? String(outstandingAmount) : '',
  );
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);

  const parsedPaymentAmount = useMemo(
    () => parseOptionalNonNegativeDecimalInput(paymentAmount),
    [paymentAmount],
  );
  const paymentReferenceTooLong =
    paymentReference.trim().length > CLAIM_PAYMENT_REFERENCE_MAX_LENGTH;
  const paymentNotesTooLong = paymentNotes.trim().length > CLAIM_PAYMENT_NOTES_MAX_LENGTH;
  const hasAmountError =
    parsedPaymentAmount === null ||
    parsedPaymentAmount <= 0 ||
    parsedPaymentAmount - outstandingAmount > 0.000001;

  const handleRecordPayment = async () => {
    if (recordingRef.current) return;

    if (hasAmountError || parsedPaymentAmount === null) {
      setError(
        `Enter a payment amount greater than $0 and no more than ${formatCurrency(outstandingAmount)}.`,
      );
      return;
    }

    if (paymentReferenceTooLong) {
      setError(
        `Payment reference must be ${CLAIM_PAYMENT_REFERENCE_MAX_LENGTH.toLocaleString()} characters or less.`,
      );
      return;
    }

    if (paymentNotesTooLong) {
      setError(
        `Payment notes must be ${CLAIM_PAYMENT_NOTES_MAX_LENGTH.toLocaleString()} characters or less.`,
      );
      return;
    }

    recordingRef.current = true;
    setRecording(true);
    setError(null);
    try {
      await onRecordPayment(claim.id, {
        paidAmount: parsedPaymentAmount,
        paymentDate: paymentDate || undefined,
        paymentReference: paymentReference.trim() || undefined,
        paymentNotes: paymentNotes.trim() || undefined,
      });
    } finally {
      recordingRef.current = false;
      setRecording(false);
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>Record Payment</ModalHeader>
      <ModalDescription>
        Record a payment against the certified amount for this progress claim.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-green-100 p-2 text-green-700">
                <DollarSign className="h-5 w-5" />
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-medium">Claim {claim.claimNumber}</p>
                <p className="text-muted-foreground">
                  Certified {formatCurrency(claim.certifiedAmount)} / Paid{' '}
                  {formatCurrency(claim.paidAmount)}
                </p>
                <p className="font-semibold text-foreground">
                  Outstanding {formatCurrency(outstandingAmount)}
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label>
              Payment Amount <span className="text-red-500">*</span>
            </Label>
            <Input
              inputMode="decimal"
              value={paymentAmount}
              aria-label="Payment Amount"
              onChange={(event) => {
                setPaymentAmount(event.target.value);
                if (error) setError(null);
              }}
              aria-invalid={hasAmountError}
            />
          </div>

          <div>
            <Label>Payment Date</Label>
            <Input
              type="date"
              value={paymentDate}
              aria-label="Payment Date"
              onChange={(event) => setPaymentDate(event.target.value)}
            />
          </div>

          <div>
            <Label>Payment Reference</Label>
            <Input
              value={paymentReference}
              aria-label="Payment Reference"
              onChange={(event) => {
                setPaymentReference(event.target.value);
                if (error) setError(null);
              }}
              maxLength={CLAIM_PAYMENT_REFERENCE_MAX_LENGTH}
            />
          </div>

          <div>
            <Label>Payment Notes</Label>
            <Textarea
              value={paymentNotes}
              aria-label="Payment Notes"
              onChange={(event) => {
                setPaymentNotes(event.target.value);
                if (error) setError(null);
              }}
              className="min-h-[96px] resize-none"
              maxLength={CLAIM_PAYMENT_NOTES_MAX_LENGTH}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleRecordPayment}
          disabled={
            recording ||
            hasAmountError ||
            paymentReferenceTooLong ||
            paymentNotesTooLong ||
            outstandingAmount <= 0
          }
        >
          {recording ? 'Recording...' : 'Record Payment'}
        </Button>
      </ModalFooter>
    </Modal>
  );
});
