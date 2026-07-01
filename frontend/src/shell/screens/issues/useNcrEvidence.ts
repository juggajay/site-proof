/**
 * useNcrEvidence — read all evidence on one NCR and add photo evidence.
 *
 * READ: GET /api/ncrs/:id/evidence — the same endpoint the desktop evidence view
 * uses; returns { evidence, grouped, count } where each item carries its linked
 * document ({ id, filename, … }). The detail screen renders the `photos` group
 * visually, and exposes certificate/document evidence as signed-url document
 * links.
 *
 * ADD: the existing two-step pipeline, VERBATIM from RectifyNCRModal —
 *   1. POST /api/documents/upload (multipart) → { id }
 *   2. POST /api/ncrs/:id/evidence { documentId, evidenceType: 'photo' }
 * This is the same evidence-add path the offline sync executor follows (#833).
 * The detail screen gates the affordance before upload; the backend remains the
 * authority for the final evidence-link permission check.
 *
 * Online-only: photo upload needs signal. We never fake an offline add here.
 */
import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, authFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { handleApiError } from '@/lib/errorHandling';
import { queryKeys } from '@/lib/queryKeys';

export interface NcrEvidenceDocument {
  id: string;
  filename: string;
  fileUrl?: string | null;
  mimeType?: string | null;
  caption?: string | null;
}

export interface NcrEvidenceItem {
  id: string;
  evidenceType: string;
  document: NcrEvidenceDocument | null;
}

interface NcrEvidenceListResponse {
  evidence: NcrEvidenceItem[];
  grouped: {
    photos: NcrEvidenceItem[];
    certificates: NcrEvidenceItem[];
    documents: NcrEvidenceItem[];
    all: NcrEvidenceItem[];
  };
  count: number;
}

interface UploadedEvidenceDocument {
  id: string;
  filename: string;
}

export function useNcrEvidence(ncrId: string | null, projectId: string | null) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);

  const query = useQuery({
    queryKey: ncrId ? queryKeys.ncrEvidence(ncrId) : ['ncr-evidence', 'none'],
    queryFn: () =>
      apiFetch<NcrEvidenceListResponse>(`/api/ncrs/${encodeURIComponent(ncrId!)}/evidence`),
    enabled: Boolean(ncrId),
  });

  const evidence = query.data?.grouped?.all ?? query.data?.evidence ?? [];
  const photos = query.data?.grouped?.photos ?? [];

  const addPhoto = useCallback(
    async (file: File): Promise<boolean> => {
      if (!ncrId || !projectId || uploadingRef.current) return false;
      uploadingRef.current = true;
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);
        formData.append('documentType', 'photo');
        formData.append('category', 'ncr_evidence');

        const uploadResponse = await authFetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload photo');
        }
        const uploaded = (await uploadResponse.json()) as UploadedEvidenceDocument;

        await apiFetch(`/api/ncrs/${encodeURIComponent(ncrId)}/evidence`, {
          method: 'POST',
          body: JSON.stringify({ documentId: uploaded.id, evidenceType: 'photo' }),
        });

        toast({ variant: 'success', description: 'Photo added to issue' });
        await queryClient.invalidateQueries({ queryKey: queryKeys.ncrEvidence(ncrId) });
        return true;
      } catch (err) {
        handleApiError(err, 'Failed to add photo');
        return false;
      } finally {
        uploadingRef.current = false;
        setUploading(false);
      }
    },
    [ncrId, projectId, queryClient],
  );

  return {
    evidence,
    photos,
    evidenceLoading: query.isLoading,
    uploading,
    addPhoto,
  };
}
