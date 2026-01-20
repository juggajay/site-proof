// Feature #446: React-PDF document viewer component
import { useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download } from 'lucide-react'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set up the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFViewerProps {
  url: string
  filename?: string
  onClose?: () => void
  className?: string
}

export function PDFViewer({ url, filename, onClose, className = '' }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('Error loading PDF:', error)
    setLoading(false)
    setError('Failed to load PDF document')
  }, [])

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1))
  }

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1))
  }

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0))
  }

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5))
  }

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 1 && value <= (numPages || 1)) {
      setPageNumber(value)
    }
  }

  return (
    <div className={`flex flex-col bg-gray-900 ${className}`} data-testid="pdf-viewer">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 text-white">
        <div className="flex items-center gap-2">
          {/* Page Navigation */}
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="rounded p-1.5 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-1 text-sm">
            <input
              type="number"
              value={pageNumber}
              onChange={handlePageInputChange}
              min={1}
              max={numPages || 1}
              className="w-12 rounded bg-gray-700 px-2 py-1 text-center text-white"
              aria-label="Current page"
            />
            <span className="text-gray-400">/ {numPages || '-'}</span>
          </div>

          <button
            onClick={goToNextPage}
            disabled={pageNumber >= (numPages || 1)}
            className="rounded p-1.5 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="rounded p-1.5 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>

          <span className="min-w-[50px] text-center text-sm">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className="rounded p-1.5 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </button>

          {/* Rotate */}
          <button
            onClick={rotate}
            className="rounded p-1.5 hover:bg-gray-700"
            title="Rotate clockwise"
            aria-label="Rotate clockwise"
          >
            <RotateCw className="h-5 w-5" />
          </button>

          {/* Download */}
          <a
            href={url}
            download={filename || 'document.pdf'}
            className="rounded p-1.5 hover:bg-gray-700"
            title="Download PDF"
            aria-label="Download PDF"
          >
            <Download className="h-5 w-5" />
          </a>
        </div>

        {/* Filename */}
        {filename && (
          <div className="hidden md:block truncate max-w-xs text-sm text-gray-300">
            {filename}
          </div>
        )}
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800">
        {loading && (
          <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-300">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <span>Loading PDF...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 text-red-600">
            <span>{error}</span>
            <a
              href={url}
              download
              className="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
            >
              Download instead
            </a>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
          error=""
          className="flex justify-center"
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            rotate={rotation}
            loading=""
            className="shadow-lg"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>

      {/* Page Thumbnails (optional - shown at bottom for multi-page PDFs) */}
      {numPages && numPages > 1 && (
        <div className="bg-gray-800 px-4 py-2 overflow-x-auto">
          <div className="flex gap-2 justify-center">
            {Array.from({ length: Math.min(numPages, 10) }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setPageNumber(page)}
                className={`flex-shrink-0 rounded border-2 transition ${
                  page === pageNumber
                    ? 'border-primary'
                    : 'border-transparent hover:border-gray-500'
                }`}
              >
                <Document file={url} loading="">
                  <Page
                    pageNumber={page}
                    scale={0.1}
                    width={60}
                    loading=""
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
              </button>
            ))}
            {numPages > 10 && (
              <span className="flex items-center text-gray-400 text-sm">
                +{numPages - 10} more pages
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Simple inline viewer for embedding in other components
export function PDFViewerInline({ url, className = '' }: { url: string; className?: string }) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className={`bg-gray-100 dark:bg-gray-800 rounded ${className}`}>
      {error ? (
        <div className="flex items-center justify-center p-4 text-red-600">
          Failed to load PDF
        </div>
      ) : (
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() => setError('Failed to load')}
          loading={
            <div className="flex items-center justify-center p-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            </div>
          }
        >
          <Page
            pageNumber={1}
            width={300}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      )}
      {numPages && numPages > 1 && (
        <div className="text-center text-xs text-gray-500 py-1">
          {numPages} pages
        </div>
      )}
    </div>
  )
}
