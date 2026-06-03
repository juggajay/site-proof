import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import type { ITPInstance, ITPAttachment } from '../types';
import { PhotoLocationMap } from './PhotoLocationMap';

// Photo Lightbox component
export interface PhotoLightboxProps {
  selectedPhoto: ITPAttachment;
  allPhotos: ITPAttachment[];
  itpInstance: ITPInstance | null;
  photoZoom: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export function PhotoLightbox({
  selectedPhoto,
  allPhotos,
  itpInstance,
  photoZoom,
  onClose,
  onPrev,
  onNext,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: PhotoLightboxProps) {
  const currentIndex = allPhotos.findIndex((p) => p.id === selectedPhoto.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allPhotos.length - 1;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onPrev();
        else if (e.key === 'ArrowRight') onNext();
        else if (e.key === 'Escape') onClose();
        else if (e.key === '+' || e.key === '=') onZoomIn();
        else if (e.key === '-') onZoomOut();
        else if (e.key === '0') onResetZoom();
      }}
      tabIndex={0}
      data-testid="photo-lightbox"
    >
      {/* Previous Button */}
      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full p-3 text-white transition-colors z-10"
          title="Previous photo"
          data-testid="photo-lightbox-prev"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next Button */}
      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full p-3 text-white transition-colors z-10"
          title="Next photo"
          data-testid="photo-lightbox-next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Zoom Controls */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-lg p-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onZoomOut}
          className="bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Zoom out"
          disabled={photoZoom <= 0.5}
          data-testid="photo-lightbox-zoom-out"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <span
          className="text-white text-sm min-w-[60px] text-center"
          data-testid="photo-lightbox-zoom-level"
        >
          {Math.round(photoZoom * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          className="bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Zoom in"
          disabled={photoZoom >= 4}
          data-testid="photo-lightbox-zoom-in"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        {photoZoom !== 1 && (
          <button
            onClick={onResetZoom}
            className="bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors ml-1"
            title="Reset zoom"
            data-testid="photo-lightbox-zoom-reset"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        )}
      </div>

      <div
        className="relative max-w-4xl max-h-[90vh] p-4 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors z-10"
          data-testid="photo-lightbox-close"
        >
          X
        </button>
        <div className="flex items-center justify-center min-h-[60vh]">
          <SecureDocumentImage
            documentId={selectedPhoto.document.id}
            fileUrl={selectedPhoto.document.fileUrl}
            alt={selectedPhoto.document.caption || selectedPhoto.document.filename}
            className="max-w-full max-h-[80vh] object-contain rounded-lg transition-transform duration-200"
            style={{ transform: `scale(${photoZoom})` }}
            data-testid="photo-lightbox-image"
          />
        </div>
        <div className="mt-3 text-white text-center">
          <p className="font-medium">
            {selectedPhoto.document.caption || selectedPhoto.document.filename}
          </p>
          {allPhotos.length > 1 && (
            <p className="text-sm text-white/50 mt-1">
              {currentIndex + 1} of {allPhotos.length}
            </p>
          )}
          {selectedPhoto.document.uploadedBy && (
            <p className="text-sm text-white/70 mt-1">
              Uploaded by{' '}
              {selectedPhoto.document.uploadedBy.fullName ||
                selectedPhoto.document.uploadedBy.email}
              {selectedPhoto.document.uploadedAt &&
                ` on ${new Date(selectedPhoto.document.uploadedAt).toLocaleDateString('en-AU')}`}
            </p>
          )}
          {/* Show ITP item reference */}
          {itpInstance &&
            (() => {
              const completion = itpInstance.completions.find((c) =>
                c.attachments?.some((a) => a.id === selectedPhoto.id),
              );
              if (completion) {
                const checklistItem = itpInstance.template.checklistItems.find(
                  (item) => item.id === completion.checklistItemId,
                );
                if (checklistItem) {
                  return (
                    <p className="text-sm bg-primary/30 px-3 py-1 rounded mt-2 inline-block">
                      ITP Item: {checklistItem.order}. {checklistItem.description}
                    </p>
                  );
                }
              }
              return null;
            })()}
          <PhotoLocationMap
            gpsLatitude={selectedPhoto.document.gpsLatitude}
            gpsLongitude={selectedPhoto.document.gpsLongitude}
          />
        </div>
      </div>
    </div>
  );
}
