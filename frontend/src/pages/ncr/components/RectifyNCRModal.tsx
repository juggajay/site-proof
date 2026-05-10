import { useRef, useState, memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch, authFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { handleApiError } from '@/lib/errorHandling';
import type { NCR } from '../types';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const rectifyNCRSchema = z.object({
  rectificationNotes: z.string().trim().optional().default(''),
});

type RectifyNCRFormData = z.infer<typeof rectifyNCRSchema>;

interface RectifyNCRModalProps {
  isOpen: boolean;
  ncr: NCR | null;
  projectId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadedEvidenceDocument {
  id: string;
  filename: string;
}

function RectifyNCRModalInner({
  isOpen,
  ncr,
  projectId,
  onClose,
  onSuccess,
}: RectifyNCRModalProps) {
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [submittingRectification, setSubmittingRectification] = useState(false);
  const submittingRectificationRef = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RectifyNCRFormData>({
    resolver: zodResolver(rectifyNCRSchema),
    mode: 'onBlur',
    defaultValues: {
      rectificationNotes: '',
    },
  });

  const handleEvidenceUpload = async (file: File, evidenceType: string) => {
    if (!ncr) return;

    setUploadingEvidence(true);
    try {
      const uploadProjectId = ncr.project?.id || projectId;
      if (!uploadProjectId) {
        throw new Error('Project is required to upload evidence');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', uploadProjectId);
      formData.append('documentType', evidenceType === 'photo' ? 'photo' : 'ncr_evidence');
      formData.append('category', 'ncr_evidence');
      formData.append('caption', `NCR evidence for ${ncr.ncrNumber}`);

      const uploadResponse = await authFetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      const uploadData = (await uploadResponse.json()) as UploadedEvidenceDocument;

      await apiFetch(`/api/ncrs/${encodeURIComponent(ncr.id)}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          documentId: uploadData.id,
          evidenceType,
        }),
      });

      toast({
        title: 'Evidence Uploaded',
        description: `${file.name} has been added as ${evidenceType} evidence`,
      });

      setEvidenceFiles((prev) => [...prev, file]);
    } catch (err) {
      handleApiError(err, 'Failed to upload evidence');
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleSubmitRectification = async (data: RectifyNCRFormData) => {
    if (!ncr || submittingRectificationRef.current) return;

    submittingRectificationRef.current = true;
    setSubmittingRectification(true);
    try {
      await apiFetch(`/api/ncrs/${encodeURIComponent(ncr.id)}/submit-for-verification`, {
        method: 'POST',
        body: JSON.stringify({ rectificationNotes: data.rectificationNotes?.trim() || undefined }),
      });

      toast({
        title: 'Rectification Submitted',
        description: 'NCR has been submitted for verification',
      });
      handleClose();
      onSuccess();
    } catch (err) {
      handleApiError(err, 'Failed to submit rectification');
    } finally {
      submittingRectificationRef.current = false;
      setSubmittingRectification(false);
    }
  };

  const handleClose = () => {
    reset();
    setEvidenceFiles([]);
    onClose();
  };

  if (!isOpen || !ncr) return null;

  return (
    <Modal onClose={handleClose} className="max-w-lg">
      <ModalHeader>Submit Rectification Evidence</ModalHeader>
      <ModalBody>
        <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-sm font-medium text-primary">{ncr.ncrNumber}</p>
          <p className="text-sm text-primary mt-1">{ncr.description}</p>
        </div>

        {/* Evidence Upload Section */}
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground mb-2">Upload Evidence</p>

          {/* Photo Evidence */}
          <div className="mb-3">
            <Label>Photos (Rectification Evidence)</Label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files) {
                  Array.from(files).forEach((file) => handleEvidenceUpload(file, 'photo'));
                }
              }}
              disabled={uploadingEvidence}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>

          {/* Re-test Certificate */}
          <div className="mb-3">
            <Label>Re-test Certificates (PDF)</Label>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files) {
                  Array.from(files).forEach((file) =>
                    handleEvidenceUpload(file, 'retest_certificate'),
                  );
                }
              }}
              disabled={uploadingEvidence}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>

          {uploadingEvidence && <p className="text-sm text-amber-600">Uploading evidence...</p>}

          {/* Uploaded files list */}
          {evidenceFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Uploaded Evidence:</p>
              {evidenceFiles.map((file, index) => (
                <p key={index} className="text-xs text-green-600">
                  &#10003; {file.name}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Notes Section */}
        <form id="rectify-ncr-form" onSubmit={handleSubmit(handleSubmitRectification)}>
          <div className="mb-4">
            <Label>Rectification Notes</Label>
            <Textarea
              {...register('rectificationNotes')}
              placeholder="Describe the corrective actions taken..."
              rows={4}
              className={errors.rectificationNotes ? 'border-destructive mt-1' : 'mt-1'}
            />
            {errors.rectificationNotes && (
              <p className="text-sm text-destructive mt-1" role="alert">
                {errors.rectificationNotes.message}
              </p>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Please upload at least one piece of evidence (photo or re-test
              certificate) before submitting for verification.
            </p>
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={submittingRectification}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="rectify-ncr-form"
          disabled={submittingRectification || evidenceFiles.length === 0}
          title={
            evidenceFiles.length === 0
              ? 'Please upload at least one piece of evidence'
              : 'Submit for verification'
          }
        >
          {submittingRectification ? 'Submitting...' : 'Submit for Verification'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export const RectifyNCRModal = memo(RectifyNCRModalInner);
