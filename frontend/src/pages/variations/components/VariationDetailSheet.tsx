import { useState } from 'react';
import { authFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { formatAud } from '@/lib/formatAud';
import { logError } from '@/lib/logger';
import { compressImageForUpload } from '@/lib/offlinePhotoCompression';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/Modal';
import { NativeSelect } from '@/components/ui/native-select';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import type { Variation, VariationEvidencePayload, VariationLot } from '../types';
import { VariationEvidenceList } from './VariationEvidenceList';
import { VariationStatusBadge } from './VariationStatusBadge';

const EVIDENCE_TYPES = [
  { value: 'client_instruction', label: 'Client instruction' },
  { value: 'quote', label: 'Quote' },
  { value: 'approval', label: 'Approval' },
  { value: 'supporting_document', label: 'Supporting document' },
  { value: 'photo', label: 'Photo' },
];

interface VariationDetailSheetProps {
  isOpen: boolean;
  variation: Variation | null;
  lotsById: Map<string, VariationLot>;
  actionLoading: boolean;
  onClose: () => void;
  onEdit: (variation: Variation) => void;
  onSubmitVariation: (variationId: string) => void | Promise<void>;
  onApprove: (variationId: string, approvedAmount: number) => void | Promise<void>;
  onReject: (variationId: string, rejectionReason: string) => void | Promise<void>;
  onDelete: (variationId: string) => void | Promise<void>;
  onAddEvidence: (variationId: string, payload: VariationEvidencePayload) => Promise<void>;
  onRemoveEvidence: (variationId: string, evidenceId: string) => void | Promise<void>;
}

interface UploadedEvidenceDocument {
  id: string;
  filename: string;
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-AU') : '-';
}

function ApproveVariationModal({
  variation,
  loading,
  onClose,
  onApprove,
}: {
  variation: Variation;
  loading: boolean;
  onClose: () => void;
  onApprove: (approvedAmount: number) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState(
    variation.approvedAmount == null ? '' : String(variation.approvedAmount),
  );
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    const parsed = Number(amount);
    if (!amount.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setError('Approved amount must be greater than 0.');
      return;
    }
    setError(null);
    void onApprove(parsed);
  };

  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>Approve Variation</ModalHeader>
      <ModalDescription>
        Confirm the final ex-GST amount approved for {variation.variationNumber}.
      </ModalDescription>
      <ModalBody>
        <div>
          <Label htmlFor="variation-final-approved-amount">Final approved amount</Label>
          <Input
            id="variation-final-approved-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={error ? 'mt-1 border-destructive' : 'mt-1'}
          />
          {error && (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleApprove} disabled={loading}>
          Approve Variation
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function RejectVariationModal({
  loading,
  onClose,
  onReject,
}: {
  loading: boolean;
  onClose: () => void;
  onReject: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleReject = () => {
    if (!reason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setError(null);
    void onReject(reason.trim());
  };

  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>Reject Variation</ModalHeader>
      <ModalDescription>Record why the submitted variation was rejected.</ModalDescription>
      <ModalBody>
        <div>
          <Label htmlFor="variation-rejection-reason">Rejection reason</Label>
          <Textarea
            id="variation-rejection-reason"
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={error ? 'mt-1 border-destructive' : 'mt-1'}
          />
          {error && (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" onClick={handleReject} disabled={loading}>
          Reject Variation
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function DeleteVariationModal({
  variation,
  loading,
  onClose,
  onDelete,
}: {
  variation: Variation;
  loading: boolean;
  onClose: () => void;
  onDelete: () => void | Promise<void>;
}) {
  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>Delete Variation</ModalHeader>
      <ModalDescription>
        Delete {variation.variationNumber}. This cannot be undone.
      </ModalDescription>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => void onDelete()}
          disabled={loading}
        >
          Delete Variation
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export function VariationDetailSheet({
  isOpen,
  variation,
  lotsById,
  actionLoading,
  onClose,
  onEdit,
  onSubmitVariation,
  onApprove,
  onReject,
  onDelete,
  onAddEvidence,
  onRemoveEvidence,
}: VariationDetailSheetProps) {
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'delete' | null>(null);
  const [evidenceType, setEvidenceType] = useState(EVIDENCE_TYPES[0].value);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  if (!variation) return null;

  const lotNumber = variation.lotId
    ? (lotsById.get(variation.lotId)?.lotNumber ?? 'Linked lot')
    : '-';
  const canEdit = variation.status === 'proposed' || variation.status === 'rejected';
  const canDelete = variation.status === 'proposed' || variation.status === 'rejected';
  const canMutateEvidence = variation.status !== 'claimed' && variation.claimedInId === null;

  const handleEvidenceFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingEvidence(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        // Compress images before upload; non-images / failures fall back to the
        // original file (compressImageForUpload never throws).
        formData.append('file', await compressImageForUpload(file));
        formData.append('projectId', variation.projectId);
        formData.append('documentType', 'variation_evidence');
        formData.append('category', 'commercial');
        formData.append('caption', `Variation evidence for ${variation.variationNumber}`);

        const uploadResponse = await authFetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file');
        }

        const uploadData = (await uploadResponse.json()) as UploadedEvidenceDocument;
        await onAddEvidence(variation.id, {
          documentId: uploadData.id,
          evidenceType,
        });
      }

      toast({
        title: 'Evidence uploaded',
        description: 'Variation evidence has been added.',
      });
    } catch (error) {
      logError('Failed to upload variation evidence', error);
      toast({
        title: 'Evidence upload failed',
        description: extractErrorMessage(error, 'Try again or check the selected file.'),
        variant: 'error',
      });
    } finally {
      setUploadingEvidence(false);
    }
  };

  const footer = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
      {variation.status === 'proposed' && (
        <Button
          type="button"
          onClick={() => void onSubmitVariation(variation.id)}
          disabled={actionLoading}
        >
          Submit
        </Button>
      )}
      {variation.status === 'submitted' && (
        <>
          <Button type="button" onClick={() => setDialog('approve')} disabled={actionLoading}>
            Approve
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDialog('reject')}
            disabled={actionLoading}
          >
            Reject
          </Button>
        </>
      )}
      {variation.status === 'rejected' && (
        <Button
          type="button"
          onClick={() => void onSubmitVariation(variation.id)}
          disabled={actionLoading}
        >
          Resubmit
        </Button>
      )}
      {canEdit && (
        <Button
          type="button"
          variant="outline"
          onClick={() => onEdit(variation)}
          disabled={actionLoading}
        >
          Edit
        </Button>
      )}
      {canDelete && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setDialog('delete')}
          disabled={actionLoading}
          className="text-destructive"
        >
          Delete
        </Button>
      )}
      {variation.status === 'approved' && (
        <span className="rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success">
          Ready to claim
        </span>
      )}
      {variation.status === 'claimed' && (
        <span className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">
          {variation.claimedInId ? 'Claimed in progress claim' : 'Claimed'}
        </span>
      )}
    </div>
  );

  return (
    <>
      <ResponsiveSheet
        isOpen={isOpen}
        onClose={onClose}
        title={`${variation.variationNumber} ${variation.title}`}
        footer={footer}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <VariationStatusBadge status={variation.status} />
            <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
              {variation.approvedAmount == null
                ? 'Amount not set'
                : formatAud(variation.approvedAmount)}
            </span>
          </div>

          {variation.description && (
            <p className="whitespace-pre-wrap text-sm text-foreground">{variation.description}</p>
          )}

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">Client ref</dt>
              <dd>{variation.clientReference || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">Lot</dt>
              <dd>{lotNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">Created</dt>
              <dd>{formatDate(variation.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">Updated</dt>
              <dd>{formatDate(variation.updatedAt)}</dd>
            </div>
          </dl>

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium">Status timeline</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Submitted</dt>
                <dd>{formatDate(variation.submittedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Approved</dt>
                <dd>{formatDate(variation.approvedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Rejected</dt>
                <dd>{formatDate(variation.rejectedAt)}</dd>
              </div>
            </dl>
            {variation.rejectionReason && (
              <p className="mt-2 text-sm text-muted-foreground">
                Rejection reason: {variation.rejectionReason}
              </p>
            )}
          </div>

          <VariationEvidenceList
            evidence={variation.evidence}
            canRemove={canMutateEvidence}
            onRemove={(evidenceId) => void onRemoveEvidence(variation.id, evidenceId)}
          />

          {canMutateEvidence && (
            <div className="rounded-lg border p-3">
              <p className="mb-3 text-sm font-medium">Upload evidence</p>
              <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                <div>
                  <Label htmlFor="variation-evidence-type">Evidence type</Label>
                  <NativeSelect
                    id="variation-evidence-type"
                    value={evidenceType}
                    onChange={(event) => setEvidenceType(event.target.value)}
                    className="mt-1"
                  >
                    {EVIDENCE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <Label htmlFor="variation-evidence-file">File</Label>
                  <input
                    id="variation-evidence-file"
                    type="file"
                    multiple
                    disabled={uploadingEvidence}
                    onChange={(event) => void handleEvidenceFiles(event.target.files)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  {uploadingEvidence && (
                    <p className="mt-1 text-sm text-muted-foreground">Uploading evidence...</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </ResponsiveSheet>

      {dialog === 'approve' && (
        <ApproveVariationModal
          variation={variation}
          loading={actionLoading}
          onClose={() => setDialog(null)}
          onApprove={(approvedAmount) => onApprove(variation.id, approvedAmount)}
        />
      )}
      {dialog === 'reject' && (
        <RejectVariationModal
          loading={actionLoading}
          onClose={() => setDialog(null)}
          onReject={(reason) => onReject(variation.id, reason)}
        />
      )}
      {dialog === 'delete' && (
        <DeleteVariationModal
          variation={variation}
          loading={actionLoading}
          onClose={() => setDialog(null)}
          onDelete={() => onDelete(variation.id)}
        />
      )}
    </>
  );
}
