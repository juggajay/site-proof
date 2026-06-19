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
import { formatDateKey } from '@/lib/localDate';
import { formatStatusLabel } from '@/lib/statusLabels';
import { uploadDocuments } from '@/pages/documents/documentsUploadData';

interface RecordCertificationModalProps {
  claim: Claim;
  projectId: string;
  onClose: () => void;
  onCertify: (claimId: string, certification: ClaimCertificationFormData) => Promise<void>;
}

export const RecordCertificationModal = React.memo(function RecordCertificationModal({
  claim,
  projectId,
  onClose,
  onCertify,
}: RecordCertificationModalProps) {
  const [certifiedAmount, setCertifiedAmount] = useState(String(claim.totalClaimedAmount));
  const [certificationDate, setCertificationDate] = useState(() => formatDateKey());
  const [variationNotes, setVariationNotes] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [certifying, setCertifying] = useState(false);
  const certifyingRef = useRef(false);

  const parsedCertifiedAmount = useMemo(
    () => parseOptionalNonNegativeDecimalInput(certifiedAmount),
    [certifiedAmount],
  );
  const trimmedVariationNotes = variationNotes.trim();
  const variationNotesTooLong = trimmedVariationNotes.length > CLAIM_VARIATION_NOTES_MAX_LENGTH;
  const hasReducedCertifiedAmount =
    parsedCertifiedAmount !== null && claim.totalClaimedAmount - parsedCertifiedAmount > 0.000001;
  const missingRequiredVariationNotes =
    hasReducedCertifiedAmount && trimmedVariationNotes.length === 0;
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

    if (missingRequiredVariationNotes) {
      setError('Add notes explaining why the certified amount is less than the claimed amount.');
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
      // If a certificate file was attached, upload it first via the existing
      // documents-upload endpoint, then thread the resulting document id into
      // the certify call. The /certify endpoint validates that the id
      // references a document in this project.
      let certificationDocumentId: string | undefined;
      if (certificateFile) {
        const { uploadedDocs, failedUploads } = await uploadDocuments({
          files: [certificateFile],
          projectId,
          form: {
            documentType: 'certificate',
            category: 'certification',
            caption: '',
            lotId: '',
          },
          onProgress: () => {},
        });

        if (failedUploads.length > 0 || uploadedDocs.length === 0) {
          setError(failedUploads[0] || 'Could not upload the certificate. Please try again.');
          return;
        }

        const uploadedId = (uploadedDocs[0] as { id?: string }).id;
        if (!uploadedId) {
          setError('Could not upload the certificate. Please try again.');
          return;
        }
        certificationDocumentId = uploadedId;
      }

      await onCertify(claim.id, {
        certifiedAmount: parsedCertifiedAmount,
        certificationDate: certificationDate || undefined,
        variationNotes: trimmedVariationNotes || undefined,
        certificationDocumentId,
      });
    } finally {
      certifyingRef.current = false;
      setCertifying(false);
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>Record certification received</ModalHeader>
      <ModalDescription>
        Record the certificate or payment schedule received from the principal (or their
        superintendent), including the certified amount and a copy of the certificate. This does not
        certify the claim yourself; it captures the external party&apos;s certification.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-medium">Claim {claim.claimNumber}</p>
                <p className="text-muted-foreground">
                  Claimed {formatCurrency(claim.totalClaimedAmount)}
                </p>
                <p className="font-semibold text-foreground">
                  Current status {formatStatusLabel(claim.status)}
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label>
              Certified Amount <span className="text-destructive">*</span>
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
            <p className="mt-1 text-xs text-muted-foreground">
              The amount certified on the principal&apos;s certificate or payment schedule.
            </p>
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
            <Label>
              Notes / variations from the payment schedule
              {hasReducedCertifiedAmount && <span className="text-destructive"> *</span>}
            </Label>
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
            <div className="mt-1 flex items-start justify-between gap-3 text-xs text-muted-foreground">
              <p>
                {hasReducedCertifiedAmount
                  ? 'Required when the certified amount is less than claimed.'
                  : 'Optional unless the external schedule reduces the amount.'}
              </p>
              <p className="shrink-0 text-right">
                {trimmedVariationNotes.length.toLocaleString()}/
                {CLAIM_VARIATION_NOTES_MAX_LENGTH.toLocaleString()}
              </p>
            </div>
          </div>

          <div>
            <Label>Certificate / payment schedule (PDF or image)</Label>
            <input
              type="file"
              accept=".pdf,image/*"
              id="certification-document-upload"
              className="hidden"
              onChange={(event) => {
                setCertificateFile(event.target.files?.[0] || null);
                if (error) setError(null);
              }}
            />
            <div className="mt-1 flex items-center gap-3">
              <label
                htmlFor="certification-document-upload"
                className="inline-block cursor-pointer rounded-lg bg-muted px-3 py-2 text-sm text-foreground hover:bg-muted/80"
              >
                {certificateFile ? 'Change file' : 'Attach certificate'}
              </label>
              {certificateFile && (
                <span
                  className="truncate text-sm text-muted-foreground"
                  title={certificateFile.name}
                >
                  {certificateFile.name}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Optional. Attach the certificate received from the principal for the audit trail.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleCertify}
          disabled={
            certifying || hasAmountError || variationNotesTooLong || missingRequiredVariationNotes
          }
        >
          {certifying ? 'Recording...' : 'Record Payment Schedule'}
        </Button>
      </ModalFooter>
    </Modal>
  );
});
