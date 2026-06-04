import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { Button } from '@/components/ui/button';
import type { ITPAttachment, ITPInstance } from '../types';
import { PhotoLocationMap } from './PhotoLocationMap';

// Photo Viewer Modal Component
export interface PhotoViewerModalProps {
  selectedPhoto: ITPAttachment | null;
  photoZoom: number;
  itpInstance: ITPInstance | null;
  onClose: () => void;
  onPhotoChange: (photo: ITPAttachment) => void;
  onZoomChange: (zoom: number) => void;
}

export function PhotoViewerModal({
  selectedPhoto,
  photoZoom,
  itpInstance,
  onClose,
  onPhotoChange,
  onZoomChange,
}: PhotoViewerModalProps) {
  if (!selectedPhoto) return null;

  // Collect all photos for navigation
  const allPhotos: ITPAttachment[] = [];
  if (itpInstance) {
    itpInstance.completions.forEach((completion) => {
      if (completion.attachments && completion.attachments.length > 0) {
        completion.attachments.forEach((attachment) => {
          allPhotos.push(attachment);
        });
      }
    });
  }

  const currentIndex = allPhotos.findIndex((p) => p.id === selectedPhoto.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allPhotos.length - 1;

  const goToPrev = () => {
    if (hasPrev) {
      onPhotoChange(allPhotos[currentIndex - 1]);
    }
  };

  const goToNext = () => {
    if (hasNext) {
      onPhotoChange(allPhotos[currentIndex + 1]);
    }
  };

  const handleZoomIn = () => {
    onZoomChange(Math.min(photoZoom + 0.5, 4));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(photoZoom - 0.5, 0.5));
  };

  const handleResetZoom = () => {
    onZoomChange(1);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') goToPrev();
        else if (e.key === 'ArrowRight') goToNext();
        else if (e.key === 'Escape') onClose();
        else if (e.key === '+' || e.key === '=') handleZoomIn();
        else if (e.key === '-') handleZoomOut();
        else if (e.key === '0') handleResetZoom();
      }}
      tabIndex={0}
      data-testid="photo-lightbox"
    >
      {/* Previous Button */}
      {hasPrev && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full text-white z-10"
          title="Previous photo"
          data-testid="photo-lightbox-prev"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      )}

      {/* Next Button */}
      {hasNext && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full text-white z-10"
          title="Next photo"
          data-testid="photo-lightbox-next"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}

      {/* Zoom Controls */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-lg p-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          className="bg-white/20 hover:bg-white/40 rounded-full text-white"
          title="Zoom out"
          disabled={photoZoom <= 0.5}
          data-testid="photo-lightbox-zoom-out"
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
        <span
          className="text-white text-sm min-w-[60px] text-center"
          data-testid="photo-lightbox-zoom-level"
        >
          {Math.round(photoZoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomIn}
          className="bg-white/20 hover:bg-white/40 rounded-full text-white"
          title="Zoom in"
          disabled={photoZoom >= 4}
          data-testid="photo-lightbox-zoom-in"
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        {photoZoom !== 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleResetZoom}
            className="bg-white/20 hover:bg-white/40 rounded-full text-white ml-1"
            title="Reset zoom"
            data-testid="photo-lightbox-zoom-reset"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div
        className="relative max-w-4xl max-h-[90vh] p-4 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 rounded-full text-white z-10"
          data-testid="photo-lightbox-close"
        >
          ✕
        </Button>
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
                      📋 ITP Item: {checklistItem.order}. {checklistItem.description}
                    </p>
                  );
                }
              }
              return null;
            })()}
          <PhotoLocationMap
            gpsLatitude={selectedPhoto.document.gpsLatitude}
            gpsLongitude={selectedPhoto.document.gpsLongitude}
            openLabel="Open in Google Maps →"
          />
        </div>
      </div>
    </div>
  );
}
