import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  FolderOpen,
  AlertCircle,
  FileText,
  ExternalLink,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/lib/api'
import { extractErrorMessage } from '@/lib/errorHandling'

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
      return <FileText className="h-4 w-4 text-primary" />
    case 'specification':
    case 'specifications':
      return <FileText className="h-4 w-4 text-purple-600 dark:text-purple-300" />
    case 'safety':
      return <FileText className="h-4 w-4 text-red-600 dark:text-red-300" />
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />
  }
}

export function SubcontractorDocumentsPage() {
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: queryKeys.portalCompanies,
    queryFn: async () => {
      const res = await apiFetch<{ company: SubcontractorCompany }>('/api/subcontractors/my-company')
      return res.company
    },
  })

  const { data: documents = [], isLoading: docsLoading, error } = useQuery({
    queryKey: queryKeys.portalDocuments,
    queryFn: async () => {
      const res = await apiFetch<{ documents: Document[] }>(
        `/api/documents?projectId=${company!.projectId}&subcontractorView=true`
      )
      return res.documents || []
    },
    enabled: !!company?.projectId,
  })

  const loading = companyLoading || docsLoading

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
          <p>{extractErrorMessage(error, 'Failed to load documents')}</p>
        </div>
        <Link
          to="/subcontractor-portal"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-border rounded-lg hover:bg-muted/50 transition-colors text-foreground"
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
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground">{company?.projectName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded-lg bg-card p-3">
          <p className="text-2xl font-bold text-foreground">{documents.length}</p>
          <p className="text-xs text-muted-foreground">Total Documents</p>
        </div>
        <div className="border border-border rounded-lg bg-card p-3">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{categories.length}</p>
          <p className="text-xs text-muted-foreground">Categories</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="border border-border rounded-lg bg-card">
          <div className="p-8 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No documents available</p>
            <p className="text-sm text-muted-foreground">
              Project documents shared with you will appear here
            </p>
          </div>
        </div>
      ) : (
        <>
          {categories.map((category) => (
            <div key={category}>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
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
    <div className="border border-border rounded-lg bg-card">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
              {getCategoryIcon(document.category)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">{document.filename}</p>
              {document.description && (
                <p className="text-sm text-muted-foreground line-clamp-1">{document.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
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
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="View document"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
      </div>
    </div>
  )
}
