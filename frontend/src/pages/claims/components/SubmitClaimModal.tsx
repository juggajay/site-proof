import React, { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import type { Claim, SubmitMethod } from '../types';
import { CLAIM_SUBMISSION_OPTIONS } from '../submissionOptions';
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
  onClose: () => void;
  onSubmitted: (claimId: string, method: SubmitMethod) => Promise<void>;
}

export const SubmitClaimModal = React.memo(function SubmitClaimModal({
  claim,
  onClose,
  onSubmitted,
}: SubmitClaimModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async (method: SubmitMethod) => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmitted(claim.id, method);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>Submit Claim</ModalHeader>
      <ModalDescription>
        Download the claim package and mark this progress claim as submitted.
      </ModalDescription>
      <ModalBody>
        <p className="text-muted-foreground mb-6">
          Download the claim package, then submit it through your client channel.
        </p>

        <div className="space-y-3">
          {CLAIM_SUBMISSION_OPTIONS.map((option) => (
            <button
              key={option.method}
              onClick={() => handleSubmit(option.method)}
              disabled={submitting}
              className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              <div className="p-2 bg-green-100 rounded-lg">
                <Download className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-sm text-muted-foreground">{option.description}</div>
              </div>
            </button>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
});
