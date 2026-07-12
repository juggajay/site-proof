import { useState } from 'react';
import { Check, Upload, X } from 'lucide-react';
import { authFetch } from '@/lib/api';
import { compressImageForUpload } from '@/lib/offlinePhotoCompression';
import { toast } from '@/components/ui/toaster';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateKey } from '@/lib/localDate';
import type { HoldPoint } from '../types';

interface UploadedEvidenceDocument {
  id: string;
  filename: string;
}

export interface BatchRequestReleaseSubmitData {
  scheduledDate: string;
  scheduledTime: string;
  recipientEmail: string;
  recipientName: string;
  sharedEvidenceDocumentIds: string[];
}

interface BatchRequestReleaseModalProps {
  holdPoints: HoldPoint[];
  projectId: string;
  requesting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: BatchRequestReleaseSubmitData) => void;
}

async function getUploadErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: string | { message?: string };
      message?: string;
    };
    if (typeof data.error === 'string') return data.error;
    if (typeof data.error === 'object' && data.error?.message) return data.error.message;
    return data.message || 'Evidence upload failed';
  } catch (_error) {
    return 'Evidence upload failed';
  }
}

export function BatchRequestReleaseModal({
  holdPoints,
  projectId,
  requesting,
  error,
  onClose,
  onSubmit,
}: BatchRequestReleaseModalProps) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [uploadedEvidenceDocuments, setUploadedEvidenceDocuments] = useState<
    UploadedEvidenceDocument[]
  >([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const lotNumber = holdPoints[0]?.lotNumber || 'Selected lot';
  const lotId = holdPoints[0]?.lotId;
  const sharedEvidenceDocumentIds = uploadedEvidenceDocuments.map((document) => document.id);
  const canSubmit =
    holdPoints.length > 0 &&
    scheduledDate.trim() &&
    scheduledTime.trim() &&
    recipientEmail.trim() &&
    !requesting &&
    !uploadingEvidence;

  const handleEvidenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length === 0) return;

    if (!lotId) {
      setUploadError('Unable to determine the lot for this evidence upload.');
      return;
    }

    setUploadingEvidence(true);
    setUploadError(null);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', await compressImageForUpload(file));
        formData.append('projectId', projectId);
        formData.append('lotId', lotId);
        formData.append('documentType', 'hold_point_request_evidence');
        formData.append('category', 'itp_evidence');
        formData.append('caption', `Batch release request evidence - ${lotNumber}`);

        const response = await authFetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(await getUploadErrorMessage(response));
        }

        const uploadedDocument = (await response.json()) as {
          id?: string;
          filename?: string;
        };
        if (!uploadedDocument.id) {
          throw new Error('Evidence upload did not return a document id');
        }

        setUploadedEvidenceDocuments((current) => [
          ...current,
          {
            id: uploadedDocument.id!,
            filename: uploadedDocument.filename || file.name,
          },
        ]);
      }
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Evidence upload failed';
      setUploadError(message);
      toast({
        title: 'Evidence upload failed',
        description: message,
        variant: 'error',
      });
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (uploadingEvidence) {
      toast({
        title: 'Evidence upload in progress',
        description: 'Wait for the upload to finish before sending the batch request.',
        variant: 'warning',
      });
      return;
    }

    onSubmit({
      scheduledDate,
      scheduledTime,
      recipientEmail: recipientEmail.trim(),
      recipientName: recipientName.trim(),
      sharedEvidenceDocumentIds,
    });
  };

  const removeEvidenceDocument = (documentId: string) => {
    setUploadedEvidenceDocuments((current) =>
      current.filter((document) => document.id !== documentId),
    );
  };

  const footer = (
    <>
      <Button type="button" variant="outline" onClick={onClose} disabled={requesting}>
        Cancel
      </Button>
      <Button type="submit" form="batch-request-release-form" disabled={!canSubmit}>
        {requesting ? 'Sending...' : 'Send batch request'}
      </Button>
    </>
  );

  return (
    <ResponsiveSheet
      open={true}
      onClose={onClose}
      title="Batch Request Release"
      footer={footer}
      className="max-w-xl"
    >
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="text-sm text-muted-foreground">Lot</div>
        <div className="font-medium">{lotNumber}</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {holdPoints.length} hold point{holdPoints.length === 1 ? '' : 's'} selected
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      <form id="batch-request-release-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="batch-request-release-scheduled-date">Scheduled Date</Label>
            <Input
              id="batch-request-release-scheduled-date"
              type="date"
              value={scheduledDate}
              min={formatDateKey()}
              onChange={(event) => setScheduledDate(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="batch-request-release-scheduled-time">Scheduled Time</Label>
            <Input
              id="batch-request-release-scheduled-time"
              type="time"
              value={scheduledTime}
              onChange={(event) => setScheduledTime(event.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="batch-request-release-recipient-email">Recipient Email</Label>
          <Input
            id="batch-request-release-recipient-email"
            type="email"
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
            placeholder="inspector@example.com"
            required
          />
        </div>

        <div>
          <Label htmlFor="batch-request-release-recipient-name">Recipient Name</Label>
          <Input
            id="batch-request-release-recipient-name"
            type="text"
            value={recipientName}
            onChange={(event) => setRecipientName(event.target.value)}
            placeholder="Site Reviewer"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="batch-request-release-evidence">Shared Evidence</Label>
          <div className="rounded-lg border border-dashed border-border bg-muted p-3">
            <div className="flex items-center gap-3">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <Input
                id="batch-request-release-evidence"
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv"
                onChange={handleEvidenceUpload}
                disabled={uploadingEvidence || requesting}
                className="min-h-[44px] bg-background"
              />
            </div>
            {uploadingEvidence && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Uploading...</span>
              </div>
            )}
            {uploadError && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {uploadError}
              </p>
            )}
            {uploadedEvidenceDocuments.length > 0 && (
              <ul className="mt-3 space-y-2">
                {uploadedEvidenceDocuments.map((document) => (
                  <li
                    key={document.id}
                    className="flex items-center justify-between gap-2 rounded bg-success/10 px-2 py-1 text-sm text-success"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Check className="h-4 w-4 shrink-0" />
                      <span className="truncate">Uploaded: {document.filename}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-success hover:bg-success/10"
                      aria-label={`Remove ${document.filename}`}
                      onClick={() => removeEvidenceDocument(document.id)}
                      disabled={requesting}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Selected hold points</div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {holdPoints.map((holdPoint) => (
              <li key={holdPoint.id}>
                {holdPoint.sequenceNumber}. {holdPoint.description}
              </li>
            ))}
          </ul>
        </div>
      </form>
    </ResponsiveSheet>
  );
}
