import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import type { Claim, ClaimCertificationFormData } from '../types';
import { CLAIM_VARIATION_NOTES_MAX_LENGTH } from '../constants';
import { formatCurrency } from '../utils';
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

interface RecordCertificationModalProps {
  claim: Claim;
  onClose: () => void;
  onCertify: (claimId: string, certification: ClaimCertificationFormData) => Promise<void>;
}

export const RecordCertificationModal = React.memo(function RecordCertificationModal({
  claim,
  onClose,
  onCertify,
}: RecordCertificationModalProps) {
  const [certifiedAmount, setCertifiedAmount] = useState(String(claim.totalClaimedAmount));
  const [certificationDate, setCertificationDate] = useState(
    () => new Date().toISOString().split('T')[0],
  );
  const [variationNotes, setVariationNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [certifying, setCertifying] = useState(false);
  const certifyingRef = useRef(false);

  const parsedCertifiedAmount = useMemo(
    () => parseOptionalNonNegativeDecimalInput(certifiedAmount),
    [certifiedAmount],
  );
  const variationNotesTooLong = variationNotes.trim().length > CLAIM_VARIATION_NOTES_MAX_LENGTH;
  const hasAmountError =
    parsedCertifiedAmount === null ||
    parsedCertifiedAmount < 0 ||
    parsedCertifiedAmount - claim.totalClaimedAmount > 0.000001;

  const handleCertify = async () => {
    if (certifyingRef.current) return;

    if (hasAmountError || parsedCertifiedAmount === null) {
      setError(`Enter a certified amount from $0 to ${formatCurrency(claim.totalClaimedAmount)}.`);
      return;
    }

    if (variationNotesTooLong) {
      setError(
        `Variation notes must be ${CLAIM_VARIATION_NOTES_MAX_LENGTH.toLocaleString()} characters or less.`,
      );
      return;
    }

    certifyingRef.current = true;
    setCertifying(true);
    setError(null);
    try {
      await onCertify(claim.id, {
        certifiedAmount: parsedCertifiedAmount,
        certificationDate: certificationDate || undefined,
        variationNotes: variationNotes.trim() || undefined,
      });
    } finally {
      certifyingRef.current = false;
      setCertifying(false);
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>Certify Claim</ModalHeader>
      <ModalDescription>
        Record the certified amount before this progress claim is eligible for payment.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-medium">Claim {claim.claimNumber}</p>
                <p className="text-muted-foreground">
                  Claimed {formatCurrency(claim.totalClaimedAmount)}
                </p>
                <p className="font-semibold text-foreground">
                  Current status {claim.status.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label>
              Certified Amount <span className="text-red-500">*</span>
            </Label>
            <Input
              inputMode="decimal"
              value={certifiedAmount}
              aria-label="Certified Amount"
              onChange={(event) => {
                setCertifiedAmount(event.target.value);
                if (error) setError(null);
              }}
              aria-invalid={hasAmountError}
            />
          </div>

          <div>
            <Label>Certification Date</Label>
            <Input
              type="date"
              value={certificationDate}
              aria-label="Certification Date"
              onChange={(event) => setCertificationDate(event.target.value)}
            />
          </div>

          <div>
            <Label>Variation Notes</Label>
            <Textarea
              value={variationNotes}
              aria-label="Variation Notes"
              onChange={(event) => {
                setVariationNotes(event.target.value);
                if (error) setError(null);
              }}
              className="min-h-[96px] resize-none"
              maxLength={CLAIM_VARIATION_NOTES_MAX_LENGTH}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {variationNotes.trim().length.toLocaleString()}/
              {CLAIM_VARIATION_NOTES_MAX_LENGTH.toLocaleString()}
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleCertify}
          disabled={certifying || hasAmountError || variationNotesTooLong}
        >
          {certifying ? 'Certifying...' : 'Certify Claim'}
        </Button>
      </ModalFooter>
    </Modal>
  );
});
