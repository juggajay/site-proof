import { lazy, Suspense } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'

// Lazy load the PDF viewer component to reduce initial bundle size
// react-pdf and pdfjs-dist are heavy (~500KB+ combined)
const PDFViewerLazy = lazy(() =>
  import('./PDFViewer').then(m => ({ default: m.PDFViewer }))
)

const PDFViewerInlineLazy = lazy(() =>
  import('./PDFViewer').then(m => ({ default: m.PDFViewerInline }))
)

interface PDFViewerProps {
  url: string
  filename?: string
  onClose?: () => void
  className?: string
}

interface PDFViewerInlineProps {
  url: string
  className?: string
}

export function LazyPDFViewer(props: PDFViewerProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col bg-gray-900 min-h-[400px]">
          <div className="flex items-center justify-between bg-gray-800 px-4 py-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800 p-4">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="text-gray-600 dark:text-gray-300">Loading PDF viewer...</span>
            </div>
          </div>
        </div>
      }
    >
      <PDFViewerLazy {...props} />
    </Suspense>
  )
}

export function LazyPDFViewerInline(props: PDFViewerInlineProps) {
  return (
    <Suspense
      fallback={
        <div className={`bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center p-4 ${props.className || ''}`}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <PDFViewerInlineLazy {...props} />
    </Suspense>
  )
}
