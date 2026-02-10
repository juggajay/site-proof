import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  FolderOpen,
  AlertCircle,
  FileText,
  ExternalLink,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/lib/api'

interface Document {
  id: string
  filename: string
  fileUrl: string
  category: string
  description?: string
  uploadedAt: string
  uploadedBy?: { fullName: string }
  fileSize?: number
}

interface SubcontractorCompany {
  id: string
  companyName: string
  projectId: string
  projectName: string
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getCategoryIcon(category: string) {
  switch (category.toLowerCase()) {
    case 'drawing':
    case 'drawings':
      return <FileText className="h-4 w-4 text-blue-600 dark:text-blue-300" />
    case 'specification':
    case 'specifications':
      return <FileText className="h-4 w-4 text-purple-600 dark:text-purple-300" />
    case 'safety':
      return <FileText className="h-4 w-4 text-red-600 dark:text-red-300" />
    default:
      return <FileText className="h-4 w-4 text-gray-600 dark:text-gray-300" />
  }
}

export function SubcontractorDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [company, setCompany] = useState<SubcontractorCompany | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // Get company info
        const companyData = await apiFetch<{ company: SubcontractorCompany }>(`/api/subcontractors/my-company`)
        setCompany(companyData.company)

        // Fetch documents for the project (filtered by portal access on backend)
        const docsData = await apiFetch<{ documents: Document[] }>(
          `/api/documents?projectId=${companyData.company.projectId}&subcontractorView=true`
        )
        setDocuments(docsData.documents || [])
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load documents')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Group by category
  const groupedDocs = documents.reduce((acc, doc) => {
    const cat = doc.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(doc)
    return acc
  }, {} as Record<string, Document[]>)

  const categories = Object.keys(groupedDocs).sort()

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
        <Link
          to="/subcontractor-portal"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/subcontractor-portal"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Documents</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{company?.projectName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{documents.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Documents</p>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{categories.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Categories</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div className="p-8 text-center">
            <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No documents available</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Project documents shared with you will appear here
            </p>
          </div>
        </div>
      ) : (
        <>
          {categories.map((category) => (
            <div key={category}>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                {category} ({groupedDocs[category].length})
              </h2>
              <div className="space-y-2">
                {groupedDocs[category].map((doc) => (
                  <DocumentCard key={doc.id} document={doc} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function DocumentCard({ document }: { document: Document }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
              {getCategoryIcon(document.category)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 dark:text-white truncate">{document.filename}</p>
              {document.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{document.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>{new Date(document.uploadedAt).toLocaleDateString()}</span>
                {document.fileSize && (
                  <>
                    <span>·</span>
                    <span>{formatFileSize(document.fileSize)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <a
            href={document.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="View document"
          >
            <ExternalLink className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </a>
        </div>
      </div>
    </div>
  )
}
