import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { PhotoViewerModal } from '@/pages/lots/components/PhotoViewerModal';
import type { ITPAttachment } from '@/pages/lots/types';

// A photo Document row as returned by GET /api/documents/:projectId. The list
// response strips `fileUrl` (backend-mediated access only) — SecureDocumentImage
// and the signed-url flow work off `id` alone.
interface DiaryPhotoDocument {
  id: string;
  filename: string;
  caption: string | null;
  uploadedAt: string;
  uploadedBy: { id: string; fullName: string | null; email: string } | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  lot: { id: string; lotNumber: string; description?: string | null } | null;
}

interface DiaryPhotosSectionProps {
  projectId?: string;
  selectedDate: string;
}

/**
 * "Today's photos" — the day's project photos captured in the field (ITP
 * evidence, docket photos, standalone captures), surfaced in the diary at zero
 * extra effort. Reuses the documents list endpoint with a date filter; subbie
 * scoping is enforced server-side by applyDocumentReadScope.
 *
 * ponytail: reuses PhotoViewerModal (with itpInstance=null) instead of a new
 * lightbox, and the existing thumbnail pipeline (variant="thumb").
 */
export function DiaryPhotosSection({ projectId, selectedDate }: DiaryPhotosSectionProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<ITPAttachment | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: [...queryKeys.documents(projectId ?? ''), 'diary-photos', selectedDate] as const,
    queryFn: () => {
      const params = new URLSearchParams({
        documentType: 'photo',
        dateFrom: selectedDate,
        dateTo: selectedDate,
        limit: '100',
      });
      return apiFetch<{ documents?: DiaryPhotoDocument[] }>(
        `/api/documents/${encodeURIComponent(projectId ?? '')}?${params.toString()}`,
      );
    },
    enabled: !!projectId,
  });

  // Map to the ITPAttachment shape PhotoViewerModal + the grid tiles expect.
  const photos: ITPAttachment[] = useMemo(
    () =>
      (data?.documents ?? []).map((doc) => ({
        id: doc.id,
        documentId: doc.id,
        document: {
          id: doc.id,
          filename: doc.filename,
          fileUrl: null,
          caption: doc.caption,
          uploadedAt: doc.uploadedAt,
          uploadedBy: doc.uploadedBy
            ? {
                id: doc.uploadedBy.id,
                fullName: doc.uploadedBy.fullName || doc.uploadedBy.email,
                email: doc.uploadedBy.email,
              }
            : null,
          gpsLatitude: doc.gpsLatitude,
          gpsLongitude: doc.gpsLongitude,
        },
      })),
    [data?.documents],
  );

  const lotNumberByDocId = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of data?.documents ?? []) {
      if (doc.lot) map.set(doc.id, doc.lot.lotNumber);
    }
    return map;
  }, [data?.documents]);

  if (!projectId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="diary-photos-loading">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <p
        className="py-8 text-center text-sm text-muted-foreground"
        data-testid="diary-photos-error"
      >
        Couldn&apos;t load photos for this day.
      </p>
    );
  }

  if (photos.length === 0) {
    return (
      <p
        className="py-8 text-center text-sm text-muted-foreground"
        data-testid="diary-photos-empty"
      >
        No photos captured on this day.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="diary-photos-section">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((attachment) => {
          const lotNumber = lotNumberByDocId.get(attachment.document.id);
          return (
            <div
              key={attachment.id}
              className="group relative cursor-pointer overflow-hidden rounded-lg border transition-colors hover:border-primary"
              onClick={() => setSelectedPhoto(attachment)}
            >
              <SecureDocumentImage
                documentId={attachment.document.id}
                fileUrl={attachment.document.fileUrl}
                alt={attachment.document.caption || attachment.document.filename}
                className="h-40 w-full object-cover"
                variant="thumb"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-sm font-medium text-white">View</span>
              </div>
              {(lotNumber || attachment.document.caption) && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  {lotNumber && (
                    <p className="truncate text-xs font-medium text-white">Lot {lotNumber}</p>
                  )}
                  {attachment.document.caption && (
                    <p className="truncate text-xs text-white/80">{attachment.document.caption}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <PhotoViewerModal
        selectedPhoto={selectedPhoto}
        photoZoom={photoZoom}
        itpInstance={null}
        allPhotos={photos}
        onClose={() => {
          setSelectedPhoto(null);
          setPhotoZoom(1);
        }}
        onPhotoChange={(photo) => {
          setSelectedPhoto(photo);
          setPhotoZoom(1);
        }}
        onZoomChange={setPhotoZoom}
      />
    </div>
  );
}
