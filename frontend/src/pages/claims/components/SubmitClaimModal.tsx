import React, { useRef, useState } from 'react';
import { CheckCircle, Loader2, Package } from 'lucide-react';
import type { ClaimPackageOptions } from '@/lib/pdfGenerator';
import type { Claim, SubmitMethod } from '../types';
import { DEFAULT_PACKAGE_OPTIONS } from '../constants';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

interface SubmitClaimModalProps {
  claim: Claim;
  isGeneratingEvidence?: boolean;
  evidencePackageError?: string | null;
  onClose: () => void;
  onSubmitted: (claimId: string, method: SubmitMethod, submittedTo?: string) => Promise<void>;
  onGenerateEvidencePackage: (claimId: string, options: ClaimPackageOptions) => void;
}

export const SubmitClaimModal = React.memo(function SubmitClaimModal({
  claim,
  isGeneratingEvidence = false,
  evidencePackageError = null,
  onClose,
  onSubmitted,
  onGenerateEvidencePackage,
}: SubmitClaimModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submittedTo, setSubmittedTo] = useState('');
  const submittingRef = useRef(false);

  const handleSubmit = async () => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmitted(claim.id, 'download', submittedTo.trim() || undefined);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleGenerateEvidencePackage = () => {
    if (isGeneratingEvidence) return;
    onGenerateEvidencePackage(claim.id, { ...DEFAULT_PACKAGE_OPTIONS });
  };

  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>Submit Claim</ModalHeader>
      <ModalDescription>
        SiteProof doesn't send this claim to your client. Download the evidence package PDF and send
        it yourself, then mark the claim as submitted here to record the date.
      </ModalDescription>
      <ModalBody>
        <p className="text-muted-foreground mb-4 text-sm">
          Marking the claim as submitted records your submission date only. It does not send files,
          emails, or notifications outside SiteProof.
        </p>

        {evidencePackageError && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {evidencePackageError}
          </div>
        )}

        <div className="mb-6">
          <label htmlFor="claim-submitted-to" className="mb-1.5 block text-sm font-medium">
            Submitted to <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id="claim-submitted-to"
            type="text"
            value={submittedTo}
            onChange={(event) => setSubmittedTo(event.target.value)}
            placeholder="e.g. client name or email — recorded on the claim"
            maxLength={200}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          onClick={handleGenerateEvidencePackage}
          disabled={isGeneratingEvidence}
        >
          {isGeneratingEvidence ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Package className="h-4 w-4" />
          )}
          {isGeneratingEvidence ? 'Generating...' : 'Download evidence package (PDF)'}
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          Mark as submitted
        </Button>
      </ModalFooter>
    </Modal>
  );
});
