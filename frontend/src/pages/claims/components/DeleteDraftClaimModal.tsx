import React, { useRef, useState } from 'react';
import type { Claim } from '../types';
import { formatCurrency } from '../utils';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

interface DeleteDraftClaimModalProps {
  claim: Claim;
  onClose: () => void;
  onDelete: (claimId: string) => Promise<void>;
}

export const DeleteDraftClaimModal = React.memo(function DeleteDraftClaimModal({
  claim,
  onClose,
  onDelete,
}: DeleteDraftClaimModalProps) {
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);

  const handleDelete = async () => {
    if (deletingRef.current) return;

    deletingRef.current = true;
    setDeleting(true);
    try {
      await onDelete(claim.id);
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>Delete draft claim</ModalHeader>
      <ModalDescription>
        Delete this draft progress claim and release its lots so they can be claimed again.
      </ModalDescription>
      <ModalBody>
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <div className="font-medium">Claim {claim.claimNumber}</div>
          <div className="mt-1 text-muted-foreground">
            {formatCurrency(claim.totalClaimedAmount)} across {claim.lotCount} lot
            {claim.lotCount === 1 ? '' : 's'}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete draft'}
        </Button>
      </ModalFooter>
    </Modal>
  );
});
