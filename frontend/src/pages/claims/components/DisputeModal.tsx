import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Modal,
  AlertModalHeader,
  AlertModalDescription,
  ModalBody,
  AlertModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CLAIM_DISPUTE_NOTES_MAX_LENGTH } from '../constants';

interface DisputeModalProps {
  claimId: string;
  onClose: () => void;
  onDisputed: (claimId: string, notes: string) => void | Promise<void>;
}

export const DisputeModal = React.memo(function DisputeModal({
  claimId,
  onClose,
  onDisputed,
}: DisputeModalProps) {
  const [disputeNotes, setDisputeNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [disputing, setDisputing] = useState(false);
  const trimmedDisputeNotes = disputeNotes.trim();
  const disputeNotesTooLong = trimmedDisputeNotes.length > CLAIM_DISPUTE_NOTES_MAX_LENGTH;

  const handleDispute = async () => {
    if (!trimmedDisputeNotes) {
      setError('Please enter dispute notes.');
      return;
    }
    if (disputeNotesTooLong) {
      setError(
        `Dispute notes must be ${CLAIM_DISPUTE_NOTES_MAX_LENGTH.toLocaleString()} characters or less.`,
      );
      return;
    }
    setError(null);
    setDisputing(true);

    try {
      await onDisputed(claimId, trimmedDisputeNotes);
    } finally {
      setDisputing(false);
    }
  };

  return (
    <Modal onClose={onClose} alert className="max-w-md">
      <AlertModalHeader>
        <span className="text-red-600">Mark Claim as Disputed</span>
      </AlertModalHeader>
      <AlertModalDescription>
        Record dispute notes before moving this progress claim into disputed status.
      </AlertModalDescription>
      <ModalBody>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-medium">This action will mark the claim as disputed.</p>
              <p className="mt-1">
                The claim will remain in disputed status until resolved. Please provide details
                about the dispute.
              </p>
            </div>
          </div>

          <div>
            <Label>
              Dispute Notes <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={disputeNotes}
              onChange={(e) => {
                setDisputeNotes(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Describe the reason for the dispute, including any specific items or amounts in question..."
              className="min-h-[120px] resize-none"
              maxLength={CLAIM_DISPUTE_NOTES_MAX_LENGTH}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {trimmedDisputeNotes.length.toLocaleString()}/
              {CLAIM_DISPUTE_NOTES_MAX_LENGTH.toLocaleString()}
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </ModalBody>
      <AlertModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleDispute}
          disabled={disputing || !trimmedDisputeNotes || disputeNotesTooLong}
        >
          {disputing ? 'Marking...' : 'Mark as Disputed'}
        </Button>
      </AlertModalFooter>
    </Modal>
  );
});
