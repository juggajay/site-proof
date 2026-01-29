// Feature #446: React-PDF document viewer component
import { useState, useCallback, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, Maximize2, Minimize2 } from 'lucide-react'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set up the worker using CDN - most reliable for production builds
// pdfjs.version gives us the exact version bundled with react-pdf
// Note: File is .js not .mjs for pdfjs-dist 3.x
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface PDFViewerProps {
  url: string
  filename?: string
  onClose?: () => void
  className?: string
}

export function PDFViewer({ url, filename, onClose: _onClose, className = '' }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFitWidth, setIsFitWidth] = useState(true)

  // Touch gesture state for mobile pinch-to-zoom
  const containerRef = useRef<HTMLDivElement>(null)
  const [touchStartDistance, setTouchStartDistance] = useState<number | null>(null)
  const [touchStartScale, setTouchStartScale] = useState(1.0)

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('Error loading PDF:', error)
    setLoading(false)
    setError('Unable to view PDF. The file may be loading - try again in a moment or download to view.')
  }, [])

  // Touch handlers for pinch-to-zoom on mobile
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setTouchStartDistance(getTouchDistance(e.touches))
      setTouchStartScale(scale)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistance) {
      const currentDistance = getTouchDistance(e.touches)
      const scaleChange = currentDistance / touchStartDistance
      const newScale = Math.min(Math.max(touchStartScale * scaleChange, 0.5), 3.0)
      setScale(newScale)
      setIsFitWidth(false)
    }
  }

  const handleTouchEnd = () => {
    setTouchStartDistance(null)
  }

  // Double-tap to reset zoom
  const lastTap = useRef<number>(0)
  const handleDoubleTap = () => {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      // Double tap - toggle between fit width and 100%
      if (scale === 1.0) {
        setIsFitWidth(true)
        setScale(1.0)
      } else {
        setScale(1.0)
        setIsFitWidth(false)
      }
    }
    lastTap.current = now
  }

  // Track container width for fit-width mode
  const [containerWidth, setContainerWidth] = useState(350)
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 32)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1))
  }

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1))
  }

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0))
    setIsFitWidth(false)
  }

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5))
    setIsFitWidth(false)
  }

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const toggleFitWidth = () => {
    setIsFitWidth(!isFitWidth)
    if (!isFitWidth) {
      setScale(1.0)
    }
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

          {/* Fit Width Toggle */}
          <button
            onClick={toggleFitWidth}
            className={`rounded p-1.5 hover:bg-gray-700 ${isFitWidth ? 'bg-gray-600' : ''}`}
            title={isFitWidth ? "Exit fit width" : "Fit to width"}
            aria-label={isFitWidth ? "Exit fit width" : "Fit to width"}
          >
            {isFitWidth ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
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

      {/* PDF Content - with touch gesture support */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4 bg-gray-100 dark:bg-gray-800 touch-pan-x touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleDoubleTap}
      >
        {loading && (
          <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-300 mt-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <span>Loading PDF...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-4 text-center p-6 mt-10">
            <div className="rounded-full bg-red-100 p-4">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-red-600 font-medium">{error}</p>
              <p className="text-gray-500 text-sm mt-1">Double-tap to retry or download the file</p>
            </div>
            <a
              href={url}
              download={filename || 'document.pdf'}
              className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary/90 flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </div>
        )}

        {!error && (
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading=""
            error=""
            className="flex justify-center"
            options={{
              // Use standard fetch with CORS mode
              cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
              cMapPacked: true,
            }}
          >
            <Page
              pageNumber={pageNumber}
              scale={isFitWidth ? undefined : scale}
              width={isFitWidth ? containerWidth : undefined}
              rotate={rotation}
              loading=""
              className="shadow-lg"
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>
        )}
      </div>

      {/* Mobile hint - only shown on touch devices */}
      <div className="md:hidden bg-gray-700 px-3 py-1.5 text-center text-xs text-gray-300">
        Pinch to zoom • Double-tap to reset • Swipe to pan
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
                <Document
                  file={url}
                  loading=""
                  error=""
                  onLoadError={() => {/* Silently ignore thumbnail errors */}}
                >
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
