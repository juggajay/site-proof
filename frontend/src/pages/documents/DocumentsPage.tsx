// Feature #248: Documents & Photos management page
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getAuthToken } from '../../lib/auth'
import { AlertTriangle } from 'lucide-react'
import { PDFViewer } from '../../components/ui/PDFViewer'  // Feature #446: React-PDF viewer
import { API_URL } from '../../lib/api'

interface Document {
  id: string
  documentType: string
  category: string | null
  filename: string
  fileUrl: string
  fileSize: number | null
  mimeType: string | null
  uploadedAt: string
  uploadedBy: { id: string; fullName: string; email: string } | null
  caption: string | null
  lot: { id: string; lotNumber: string; description: string } | null
  isFavourite: boolean
}

interface Lot {
  id: string
  lotNumber: string
  description: string
}

const DOCUMENT_TYPES = [
  { id: 'specification', label: 'Specification' },
  { id: 'drawing', label: 'Drawing' },
  { id: 'photo', label: 'Photo' },
  { id: 'certificate', label: 'Certificate' },
  { id: 'report', label: 'Report' },
  { id: 'correspondence', label: 'Correspondence' },
  { id: 'contract', label: 'Contract' },
  { id: 'other', label: 'Other' },
]

const CATEGORIES = [
  { id: 'design', label: 'Design' },
  { id: 'construction', label: 'Construction' },
  { id: 'quality', label: 'Quality' },
  { id: 'safety', label: 'Safety' },
  { id: 'environmental', label: 'Environmental' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'general', label: 'General' },
]

export function DocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [documents, setDocuments] = useState<Document[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Record<string, number>>({})

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedCount, setUploadedCount] = useState(0)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadForm, setUploadForm] = useState({
    documentType: '',
    category: '',
    caption: '',
    lotId: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filters
  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterLot, setFilterLot] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false)

  // Viewer modal state
  const [viewerDoc, setViewerDoc] = useState<Document | null>(null)
  const [viewerZoom, setViewerZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const viewerRef = useRef<HTMLDivElement>(null)

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Image dimension validation state
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const [dimensionWarning, setDimensionWarning] = useState<string | null>(null)
  const MIN_IMAGE_WIDTH = 100
  const MIN_IMAGE_HEIGHT = 100

  useEffect(() => {
    if (projectId) {
      fetchDocuments()
      fetchLots()
    }
  }, [projectId, filterType, filterCategory, filterLot, dateFrom, dateTo])

  const fetchDocuments = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = getAuthToken()
      let url = `${API_URL}/api/documents/${projectId}`
      const params = new URLSearchParams()
      if (filterType) params.append('documentType', filterType)
      if (filterCategory) params.append('category', filterCategory)
      if (filterLot) params.append('lotId', filterLot)
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      if (searchQuery.trim()) params.append('search', searchQuery.trim())
      if (params.toString()) url += `?${params.toString()}`

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents)
        setCategories(data.categories)
      } else {
        setError('Failed to load documents')
      }
    } catch (err) {
      console.error('Error fetching documents:', err)
      setError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const fetchLots = async () => {
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/lots?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setLots(data.lots || [])
      }
    } catch (err) {
      console.error('Error fetching lots:', err)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const fileArray = Array.from(files)
      setSelectedFiles(fileArray)
      setImageDimensions(null)
      setDimensionWarning(null)

      // Auto-detect type from first file
      const firstFile = fileArray[0]
      if (firstFile.type.startsWith('image/')) {
        setUploadForm(prev => ({ ...prev, documentType: 'photo' }))

        // Check image dimensions for single image
        if (fileArray.length === 1) {
          const objectUrl = URL.createObjectURL(firstFile)
          const img = new window.Image()
          img.onload = () => {
            const width = img.naturalWidth
            const height = img.naturalHeight
            setImageDimensions({ width, height })

            if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
              setDimensionWarning(
                `Warning: Image dimensions (${width}x${height}) are below recommended minimum (${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}). Photo may lack detail for documentation.`
              )
            }
            URL.revokeObjectURL(objectUrl)
          }
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
          }
          img.src = objectUrl
        }
      } else if (firstFile.type === 'application/pdf') {
        setUploadForm(prev => ({ ...prev, documentType: 'drawing' }))
      }
    }
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !uploadForm.documentType) {
      alert('Please select file(s) and document type')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setUploadedCount(0)

    const token = getAuthToken()
    const uploadedDocs: Document[] = []
    const failedFiles: string[] = []

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('projectId', projectId || '')
        formData.append('documentType', uploadForm.documentType)
        if (uploadForm.category) formData.append('category', uploadForm.category)
        if (uploadForm.caption && selectedFiles.length === 1) {
          formData.append('caption', uploadForm.caption)
        }
        if (uploadForm.lotId) formData.append('lotId', uploadForm.lotId)

        const res = await fetch(`${API_URL}/api/documents/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        if (res.ok) {
          const newDoc = await res.json()
          uploadedDocs.push(newDoc)
        } else {
          failedFiles.push(file.name)
        }
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err)
        failedFiles.push(file.name)
      }

      // Update progress
      setUploadedCount(i + 1)
      setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100))
    }

    // Add all uploaded docs to the list
    if (uploadedDocs.length > 0) {
      setDocuments(prev => [...uploadedDocs, ...prev])
    }

    // Show results
    if (failedFiles.length > 0) {
      alert(`Uploaded ${uploadedDocs.length} of ${selectedFiles.length} files.\nFailed: ${failedFiles.join(', ')}`)
    }

    // Reset state
    setShowUploadModal(false)
    setSelectedFiles([])
    setUploadForm({ documentType: '', category: '', caption: '', lotId: '' })
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploading(false)
    setUploadProgress(0)
    setUploadedCount(0)
  }

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== documentId))
      } else {
        alert('Failed to delete document')
      }
    } catch (err) {
      console.error('Error deleting document:', err)
      alert('Failed to delete document')
    }
  }

  const toggleFavourite = async (doc: Document) => {
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/documents/${doc.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isFavourite: !doc.isFavourite }),
      })
      if (res.ok) {
        const updated = await res.json()
        setDocuments(prev => prev.map(d => d.id === doc.id ? updated : d))
      } else {
        alert('Failed to update favourite status')
      }
    } catch (err) {
      console.error('Error toggling favourite:', err)
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find(t => t.id === type)?.label || type
  }

  const isImage = (mimeType: string | null) => {
    return mimeType?.startsWith('image/')
  }

  const isPdf = (mimeType: string | null) => {
    return mimeType === 'application/pdf'
  }

  const isExcel = (mimeType: string | null) => {
    return mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
           mimeType === 'application/vnd.ms-excel' ||
           mimeType === 'text/csv'
  }

  const isWord = (mimeType: string | null) => {
    return mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
           mimeType === 'application/msword'
  }

  const canPreview = (mimeType: string | null) => {
    return isImage(mimeType) || isPdf(mimeType)
  }

  const openViewer = (doc: Document) => {
    setViewerDoc(doc)
    setViewerZoom(100)
  }

  const closeViewer = () => {
    setViewerDoc(null)
    setViewerZoom(100)
  }

  const zoomIn = () => setViewerZoom(prev => Math.min(prev + 25, 200))
  const zoomOut = () => setViewerZoom(prev => Math.max(prev - 25, 50))

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!viewerRef.current) return

    try {
      if (!document.fullscreenElement) {
        await viewerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }

  // Listen for fullscreen changes (e.g., when user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set dragging to false if leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const fileArray = Array.from(files)
      setSelectedFiles(fileArray)
      // Auto-detect type from first file
      const firstFile = fileArray[0]
      if (firstFile.type.startsWith('image/')) {
        setUploadForm(prev => ({ ...prev, documentType: 'photo' }))
      } else if (firstFile.type === 'application/pdf') {
        setUploadForm(prev => ({ ...prev, documentType: 'drawing' }))
      }
      setShowUploadModal(true)
    }
  }

  return (
    <div
      ref={dropZoneRef}
      className="space-y-6 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="rounded-xl border-4 border-dashed border-blue-500 bg-white/90 p-12 text-center shadow-2xl">
            <svg className="mx-auto h-16 w-16 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h3 className="mt-4 text-xl font-bold text-blue-700">Drop file here to upload</h3>
            <p className="mt-2 text-blue-600">Release to start uploading your document</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents & Photos</h1>
          <p className="text-muted-foreground">
            Upload and manage project documents and photos
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload Document
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Document Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Types</option>
              {DOCUMENT_TYPES.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Lot</label>
            <select
              value={filterLot}
              onChange={(e) => setFilterLot(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Lots</option>
              {lots.map(lot => (
                <option key={lot.id} value={lot.id}>{lot.lotNumber}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchDocuments()}
              placeholder="Search by filename, caption..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={fetchDocuments}
            className="rounded-md bg-muted px-4 py-2 text-sm hover:bg-muted/80"
          >
            Search
          </button>
          <button
            onClick={() => setShowFavouritesOnly(!showFavouritesOnly)}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm ${
              showFavouritesOnly
                ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                : 'bg-muted hover:bg-muted/80'
            }`}
            title={showFavouritesOnly ? 'Show All' : 'Show Favourites Only'}
          >
            <svg className={`h-4 w-4 ${showFavouritesOnly ? 'fill-yellow-500' : ''}`} fill={showFavouritesOnly ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            Favourites
          </button>
          {(filterType || filterCategory || filterLot || dateFrom || dateTo || searchQuery || showFavouritesOnly) && (
            <button
              onClick={() => {
                setFilterType('')
                setFilterCategory('')
                setFilterLot('')
                setDateFrom('')
                setDateTo('')
                setSearchQuery('')
                setShowFavouritesOnly(false)
              }}
              className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 hover:bg-red-100"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Category Summary */}
      {Object.keys(categories).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(categories).map(([cat, count]) => (
            <span
              key={cat}
              onClick={() => setFilterCategory(cat.toLowerCase())}
              className="cursor-pointer rounded-full bg-muted px-3 py-1 text-sm hover:bg-primary hover:text-primary-foreground"
            >
              {cat}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Documents Grid */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition-colors">
            <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h3 className="mt-4 text-lg font-medium">No documents found</h3>
            <p className="mt-2 text-muted-foreground">
              Drag and drop files here or click "Upload Document" to get started
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {documents
              .filter(doc => !showFavouritesOnly || doc.isFavourite)
              .map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-muted/30">
                {/* Icon or Thumbnail */}
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted overflow-hidden" data-testid={`file-icon-${doc.id}`}>
                  {isImage(doc.mimeType) ? (
                    <img
                      src={`${API_URL}${doc.fileUrl}`}
                      alt={doc.filename}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        // Fallback to image icon if thumbnail fails
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  {isImage(doc.mimeType) ? (
                    <svg className="h-6 w-6 text-blue-500 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="image-icon">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ) : isPdf(doc.mimeType) ? (
                    <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="pdf-icon">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      <text x="9" y="16" fontSize="6" fill="currentColor" fontWeight="bold">PDF</text>
                    </svg>
                  ) : isExcel(doc.mimeType) ? (
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="excel-icon">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                  ) : isWord(doc.mimeType) ? (
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="word-icon">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      <text x="8" y="11" fontSize="5" fill="currentColor" fontWeight="bold">W</text>
                    </svg>
                  ) : (
                    <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="generic-icon">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>

                {/* Document Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{doc.filename}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {getTypeLabel(doc.documentType)}
                    </span>
                    {doc.category && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        {doc.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>{formatDate(doc.uploadedAt)}</span>
                    {doc.uploadedBy && <span>by {doc.uploadedBy.fullName}</span>}
                    {doc.lot && (
                      <span className="text-blue-600">Lot {doc.lot.lotNumber}</span>
                    )}
                  </div>
                  {doc.caption && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">{doc.caption}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleFavourite(doc)}
                    className={`rounded-md p-2 hover:bg-yellow-100 ${doc.isFavourite ? 'text-yellow-500' : 'text-gray-400'}`}
                    title={doc.isFavourite ? 'Remove from Favourites' : 'Add to Favourites'}
                  >
                    <svg className="h-5 w-5" fill={doc.isFavourite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                  {canPreview(doc.mimeType) && (
                    <button
                      onClick={() => openViewer(doc)}
                      className="rounded-md p-2 hover:bg-blue-100 text-blue-600"
                      title="View"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  )}
                  <a
                    href={`${API_URL}${doc.fileUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md p-2 hover:bg-muted"
                    title="Download"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="rounded-md p-2 hover:bg-red-100 text-red-600"
                    title="Delete"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Upload Document</h2>

            <div className="space-y-4">
              {/* File Input with Drag-Drop Zone */}
              <div>
                <label className="block text-sm font-medium mb-2">Select Files</label>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    selectedFiles.length > 0
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const files = e.dataTransfer.files
                    if (files && files.length > 0) {
                      const fileArray = Array.from(files)
                      setSelectedFiles(fileArray)
                      setImageDimensions(null)
                      setDimensionWarning(null)
                      const firstFile = fileArray[0]
                      if (firstFile.type.startsWith('image/')) {
                        setUploadForm(prev => ({ ...prev, documentType: 'photo' }))
                      } else if (firstFile.type === 'application/pdf') {
                        setUploadForm(prev => ({ ...prev, documentType: 'drawing' }))
                      }
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {selectedFiles.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium text-green-700">
                          {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                        </span>
                      </div>
                      <div className="max-h-32 overflow-y-auto text-left">
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm py-1 px-2 hover:bg-green-100 rounded">
                            <span className="truncate text-green-700">{file.name}</span>
                            <span className="text-green-600 ml-2 flex-shrink-0">{formatFileSize(file.size)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-green-600">
                        Total: {formatFileSize(selectedFiles.reduce((sum, f) => sum + f.size, 0))}
                      </p>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">
                        <span className="font-medium text-blue-600">Click to browse</span> or drag and drop
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        PDF, DOC, XLS, JPG, PNG up to 50MB (select multiple files)
                      </p>
                    </>
                  )}
                </div>

                {/* Image dimension info and warning (for single image) */}
                {imageDimensions && selectedFiles.length === 1 && (
                  <p className="mt-2 text-sm text-gray-500">
                    Image dimensions: {imageDimensions.width} x {imageDimensions.height} pixels
                  </p>
                )}
                {dimensionWarning && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>{dimensionWarning}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Document Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Document Type *</label>
                <select
                  value={uploadForm.documentType}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, documentType: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select type...</option>
                  {DOCUMENT_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select category...</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Link to Lot */}
              <div>
                <label className="block text-sm font-medium mb-2">Link to Lot (optional)</label>
                <select
                  value={uploadForm.lotId}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, lotId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No lot selected</option>
                  {lots.map(lot => (
                    <option key={lot.id} value={lot.id}>{lot.lotNumber} - {lot.description}</option>
                  ))}
                </select>
              </div>

              {/* Description/Caption */}
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={uploadForm.caption}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, caption: e.target.value }))}
                  placeholder="Add a description..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-center text-muted-foreground">
                    Uploading {uploadedCount} of {selectedFiles.length} files... {uploadProgress}%
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setSelectedFiles([])
                  setUploadForm({ documentType: '', category: '', caption: '', lotId: '' })
                }}
                disabled={uploading}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || !uploadForm.documentType || uploading}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : selectedFiles.length > 1 ? `Upload ${selectedFiles.length} Files` : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {viewerDoc && (
        <div ref={viewerRef} className="fixed inset-0 z-50 flex flex-col bg-black/90" data-testid="document-viewer-modal">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/50 text-white">
            <div className="flex items-center gap-4">
              <h3 className="font-medium truncate max-w-md">{viewerDoc.filename}</h3>
              <span className="text-sm text-gray-300">
                {formatFileSize(viewerDoc.fileSize)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <button
                onClick={zoomOut}
                disabled={viewerZoom <= 50}
                className="rounded-md p-2 hover:bg-white/20 disabled:opacity-50"
                title="Zoom Out"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              <span className="text-sm w-12 text-center">{viewerZoom}%</span>
              <button
                onClick={zoomIn}
                disabled={viewerZoom >= 200}
                className="rounded-md p-2 hover:bg-white/20 disabled:opacity-50"
                title="Zoom In"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>
              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="rounded-md p-2 hover:bg-white/20"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                data-testid="fullscreen-toggle"
              >
                {isFullscreen ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                )}
              </button>
              {/* Download */}
              <a
                href={`${API_URL}${viewerDoc.fileUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-2 hover:bg-white/20"
                title="Download"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
              {/* Close */}
              <button
                onClick={closeViewer}
                className="rounded-md p-2 hover:bg-white/20 ml-2"
                title="Close"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            {isPdf(viewerDoc.mimeType) ? (
              /* Feature #446: Use React-PDF viewer for better PDF rendering */
              <PDFViewer
                url={`${API_URL}${viewerDoc.fileUrl}`}
                filename={viewerDoc.filename}
                className="w-full h-full max-w-5xl"
              />
            ) : isImage(viewerDoc.mimeType) ? (
              <div
                className="overflow-auto max-h-[90vh]"
                style={{ cursor: 'grab' }}
              >
                <img
                  src={`${API_URL}${viewerDoc.fileUrl}`}
                  alt={viewerDoc.filename}
                  className="rounded shadow-lg transition-transform"
                  style={{
                    transform: `scale(${viewerZoom / 100})`,
                    transformOrigin: 'center',
                    maxWidth: viewerZoom <= 100 ? '100%' : 'none',
                  }}
                  draggable={false}
                />
              </div>
            ) : (
              <div className="text-white text-center">
                <p>Preview not available for this file type</p>
                <a
                  href={`${API_URL}${viewerDoc.fileUrl}`}
                  className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm"
                  download
                >
                  Download File
                </a>
              </div>
            )}
          </div>

          {/* Document Info Footer */}
          <div className="px-4 py-2 bg-black/50 text-white text-sm">
            <div className="flex items-center gap-4">
              {viewerDoc.caption && <span>{viewerDoc.caption}</span>}
              {viewerDoc.uploadedBy && <span>Uploaded by {viewerDoc.uploadedBy.fullName}</span>}
              <span>{formatDate(viewerDoc.uploadedAt)}</span>
              {viewerDoc.lot && <span>Lot {viewerDoc.lot.lotNumber}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
