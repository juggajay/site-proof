import type { RefObject } from 'react';
import { LazyPDFViewer } from '@/components/ui/LazyPDFViewer'; // Feature #446: React-PDF viewer (lazy loaded)
import { Button } from '@/components/ui/button';
import {
  formatDocumentDate as formatDate,
  formatDocumentFileSize as formatFileSize,
  isImageDocument as isImage,
  isPdfDocument as isPdf,
} from '../documentsDisplayData';

// Minimal structural shape the viewer needs. A full page `Document` is
// assignable to this, so the page can pass `viewerDoc` directly.
interface DocumentViewerDoc {
  filename: string;
  fileSize: number | null;
  mimeType: string | null;
  caption: string | null;
  uploadedAt: string;
  uploadedBy: { fullName: string } | null;
  lot: { lotNumber: string } | null;
}

interface DocumentViewerModalProps {
  doc: DocumentViewerDoc;
  url: string;
  urlLoading: boolean;
  error: string | null;
  zoom: number;
  isFullscreen: boolean;
  viewerRef: RefObject<HTMLDivElement>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFullscreen: () => void;
  onDownload: () => void;
  onClose: () => void;
  onRetry: () => void;
}

export function DocumentViewerModal({
  doc,
  url,
  urlLoading,
  error,
  zoom,
  isFullscreen,
  viewerRef,
  onZoomIn,
  onZoomOut,
  onToggleFullscreen,
  onDownload,
  onClose,
  onRetry,
}: DocumentViewerModalProps) {
  return (
    <div
      ref={viewerRef}
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      data-testid="document-viewer-modal"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 text-white">
        <div className="flex items-center gap-4">
          <h3 className="font-medium truncate max-w-md">{doc.filename}</h3>
          <span className="text-sm text-muted-foreground">{formatFileSize(doc.fileSize)}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomOut}
            disabled={zoom <= 50}
            className="hover:bg-white/20 text-white"
            title="Zoom Out"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
              />
            </svg>
          </Button>
          <span className="text-sm w-12 text-center">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomIn}
            disabled={zoom >= 200}
            className="hover:bg-white/20 text-white"
            title="Zoom In"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
              />
            </svg>
          </Button>
          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFullscreen}
            className="hover:bg-white/20 text-white"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            data-testid="fullscreen-toggle"
          >
            {isFullscreen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                />
              </svg>
            )}
          </Button>
          {/* Download */}
          <button
            type="button"
            onClick={onDownload}
            className="rounded-md p-2 hover:bg-white/20"
            title="Download"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-white/20 text-white ml-2"
            title="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {urlLoading ? (
          <div className="text-white" role="status">
            Loading secure preview...
          </div>
        ) : error ? (
          <div className="text-center text-white" role="alert">
            <p>{error}</p>
            <Button type="button" className="mt-4" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : isPdf(doc.mimeType) && url ? (
          /* Feature #446: Use React-PDF viewer for better PDF rendering (lazy loaded) */
          <LazyPDFViewer url={url} filename={doc.filename} className="w-full h-full max-w-5xl" />
        ) : isImage(doc.mimeType) && url ? (
          <div className="overflow-auto max-h-[90vh]" style={{ cursor: 'grab' }}>
            <img
              src={url}
              alt={doc.filename}
              className="rounded shadow-lg transition-transform"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'center',
                maxWidth: zoom <= 100 ? '100%' : 'none',
              }}
              draggable={false}
            />
          </div>
        ) : (
          <div className="text-white text-center">
            <p>Preview not available for this file type</p>
            <button
              type="button"
              onClick={onDownload}
              className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm"
            >
              Download File
            </button>
          </div>
        )}
      </div>

      {/* Document Info Footer */}
      <div className="px-4 py-2 bg-black/50 text-white text-sm">
        <div className="flex items-center gap-4">
          {doc.caption && <span>{doc.caption}</span>}
          {doc.uploadedBy && <span>Uploaded by {doc.uploadedBy.fullName}</span>}
          <span>{formatDate(doc.uploadedAt)}</span>
          {doc.lot && <span>Lot {doc.lot.lotNumber}</span>}
        </div>
      </div>
    </div>
  );
}
