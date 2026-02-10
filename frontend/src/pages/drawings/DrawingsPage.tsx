// Feature #250: Drawing Register management page
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getAuthToken } from '../../lib/auth'
import { apiFetch } from '@/lib/api'

interface Drawing {
  id: string
  drawingNumber: string
  title: string | null
  revision: string | null
  issueDate: string | null
  status: string
  createdAt: string
  document: {
    id: string
    filename: string
    fileUrl: string
    fileSize: number | null
    mimeType: string | null
    uploadedAt: string
    uploadedBy: { id: string; fullName: string; email: string } | null
  }
  supersededBy: { id: string; drawingNumber: string; revision: string } | null
  supersedes: { id: string; drawingNumber: string; revision: string }[]
}

interface Stats {
  total: number
  preliminary: number
  forConstruction: number
  asBuilt: number
}

const API_URL = import.meta.env.VITE_API_URL || ''

// Helper to construct document URLs - handles both relative paths and full Supabase URLs
const getDocumentUrl = (fileUrl: string | null | undefined): string => {
  if (!fileUrl) return ''
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl
  }
  return `${API_URL}${fileUrl}`
}

const DRAWING_STATUSES = [
  { id: 'preliminary', label: 'Preliminary', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'for_construction', label: 'For Construction', color: 'bg-blue-100 text-blue-800' },
  { id: 'as_built', label: 'As-Built', color: 'bg-green-100 text-green-800' },
]

export function DrawingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadForm, setUploadForm] = useState({
    drawingNumber: '',
    title: '',
    revision: '',
    issueDate: '',
    status: 'preliminary',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Revision modal state
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [revisionDrawing, setRevisionDrawing] = useState<Drawing | null>(null)
  const [revisionForm, setRevisionForm] = useState({
    revision: '',
    title: '',
    issueDate: '',
    status: 'for_construction',
  })
  const revisionFileInputRef = useRef<HTMLInputElement>(null)
  const [revisionFile, setRevisionFile] = useState<File | null>(null)

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Download current set state
  const [downloadingCurrentSet, setDownloadingCurrentSet] = useState(false)

  useEffect(() => {
    if (projectId) {
      fetchDrawings()
    }
  }, [projectId, filterStatus])

  const fetchDrawings = async () => {
    setLoading(true)
    setError(null)
    try {
      let path = `/api/drawings/${projectId}`
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      if (searchQuery.trim()) params.append('search', searchQuery.trim())
      if (params.toString()) path += `?${params.toString()}`

      const data = await apiFetch<any>(path)
      setDrawings(data.drawings)
      setStats(data.stats)
    } catch (err) {
      console.error('Error fetching drawings:', err)
      setError('Failed to load drawings')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.drawingNumber) {
      alert('Please select a file and enter a drawing number')
      return
    }

    setUploading(true)

    try {
      const token = getAuthToken()
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('projectId', projectId || '')
      formData.append('drawingNumber', uploadForm.drawingNumber)
      if (uploadForm.title) formData.append('title', uploadForm.title)
      if (uploadForm.revision) formData.append('revision', uploadForm.revision)
      if (uploadForm.issueDate) formData.append('issueDate', uploadForm.issueDate)
      formData.append('status', uploadForm.status)

      const res = await fetch(`${API_URL}/api/drawings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (res.ok) {
        const newDrawing = await res.json()
        setDrawings(prev => [newDrawing, ...prev])
        setShowUploadModal(false)
        setSelectedFile(null)
        setUploadForm({ drawingNumber: '', title: '', revision: '', issueDate: '', status: 'preliminary' })
        if (fileInputRef.current) fileInputRef.current.value = ''
        fetchDrawings() // Refresh stats
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to upload drawing')
      }
    } catch (err) {
      console.error('Error uploading drawing:', err)
      alert('Failed to upload drawing')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (drawingId: string) => {
    if (!confirm('Are you sure you want to delete this drawing?')) return

    try {
      await apiFetch(`/api/drawings/${drawingId}`, { method: 'DELETE' })
      setDrawings(prev => prev.filter(d => d.id !== drawingId))
      fetchDrawings() // Refresh stats
    } catch (err) {
      console.error('Error deleting drawing:', err)
      alert('Failed to delete drawing')
    }
  }

  const openRevisionModal = (drawing: Drawing) => {
    setRevisionDrawing(drawing)
    setRevisionForm({
      revision: '',
      title: drawing.title || '',
      issueDate: '',
      status: 'for_construction',
    })
    setRevisionFile(null)
    setShowRevisionModal(true)
  }

  const handleRevisionUpload = async () => {
    if (!revisionFile || !revisionForm.revision || !revisionDrawing) {
      alert('Please select a file and enter a new revision')
      return
    }

    setUploading(true)

    try {
      const token = getAuthToken()
      const formData = new FormData()
      formData.append('file', revisionFile)
      if (revisionForm.title) formData.append('title', revisionForm.title)
      formData.append('revision', revisionForm.revision)
      if (revisionForm.issueDate) formData.append('issueDate', revisionForm.issueDate)
      formData.append('status', revisionForm.status)

      const res = await fetch(`${API_URL}/api/drawings/${revisionDrawing.id}/supersede`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (res.ok) {
        setShowRevisionModal(false)
        setRevisionFile(null)
        setRevisionDrawing(null)
        if (revisionFileInputRef.current) revisionFileInputRef.current.value = ''
        fetchDrawings() // Refresh to show new revision and mark old as superseded
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to upload new revision')
      }
    } catch (err) {
      console.error('Error uploading revision:', err)
      alert('Failed to upload revision')
    } finally {
      setUploading(false)
    }
  }

  const handleStatusChange = async (drawingId: string, newStatus: string) => {
    try {
      const updated = await apiFetch<any>(`/api/drawings/${drawingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      setDrawings(prev => prev.map(d => d.id === drawingId ? updated : d))
      fetchDrawings() // Refresh stats
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Failed to update status')
    }
  }

  // Download current set - downloads all current (non-superseded) drawings
  const downloadCurrentSet = async () => {
    setDownloadingCurrentSet(true)
    try {
      const data = await apiFetch<any>(`/api/drawings/${projectId}/current-set`)
      if (data.drawings.length === 0) {
        alert('No current drawings to download')
        return
      }

      // Download each file (for a real production app, you'd want to create a ZIP)
      // For now, we'll open each file in a new tab
      for (const drawing of data.drawings) {
        const link = document.createElement('a')
          link.href = getDocumentUrl(drawing.fileUrl)
          link.download = `${drawing.drawingNumber}_Rev${drawing.revision || '0'}_${drawing.filename}`
          link.target = '_blank'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 300))
        }

        alert(`Downloaded ${data.drawings.length} current drawing(s)`)
    } catch (err) {
      console.error('Error downloading current set:', err)
      alert('Failed to download current drawings')
    } finally {
      setDownloadingCurrentSet(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getStatusInfo = (status: string) => {
    return DRAWING_STATUSES.find(s => s.id === status) || { id: status, label: status, color: 'bg-gray-100 text-gray-800' }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Drawing Register</h1>
          <p className="text-muted-foreground">
            Manage project drawings and revisions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadCurrentSet}
            disabled={downloadingCurrentSet || drawings.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            title="Download all current (non-superseded) drawings"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloadingCurrentSet ? 'Downloading...' : 'Download Current Set'}
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Drawing
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Drawings</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.preliminary}</div>
            <div className="text-sm text-muted-foreground">Preliminary</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.forConstruction}</div>
            <div className="text-sm text-muted-foreground">For Construction</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold text-green-600">{stats.asBuilt}</div>
            <div className="text-sm text-muted-foreground">As-Built</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              {DRAWING_STATUSES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchDrawings()}
              placeholder="Search by drawing number or title..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={fetchDrawings}
            className="rounded-md bg-muted px-4 py-2 text-sm hover:bg-muted/80"
          >
            Search
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Drawings Table */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading drawings...</div>
        ) : drawings.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium">No drawings found</h3>
            <p className="mt-2 text-muted-foreground">
              Upload your first drawing to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Drawing No.</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Revision</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Issue Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">File</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {drawings.map((drawing) => {
                  const statusInfo = getStatusInfo(drawing.status)
                  return (
                    <tr key={drawing.id} className={`hover:bg-muted/30 ${drawing.supersededBy ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="font-medium">{drawing.drawingNumber}</span>
                        {drawing.supersededBy && (
                          <span className="ml-2 text-xs text-orange-600">(Superseded)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{drawing.title || '-'}</td>
                      <td className="px-4 py-3 text-sm">{drawing.revision || '-'}</td>
                      <td className="px-4 py-3 text-sm">{formatDate(drawing.issueDate)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={drawing.status}
                          onChange={(e) => handleStatusChange(drawing.id, e.target.value)}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}
                        >
                          {DRAWING_STATUSES.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[150px]" title={drawing.document.filename}>
                            {drawing.document.filename}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({formatFileSize(drawing.document.fileSize)})
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <a
                            href={getDocumentUrl(drawing.document.fileUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md p-2 hover:bg-muted"
                            title="Download"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </a>
                          {!drawing.supersededBy && (
                            <button
                              onClick={() => openRevisionModal(drawing)}
                              className="rounded-md p-2 hover:bg-blue-100 text-blue-600"
                              title="Upload New Revision"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(drawing.id)}
                            className="rounded-md p-2 hover:bg-red-100 text-red-600"
                            title="Delete"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Add Drawing</h2>

            <div className="space-y-4">
              {/* File Input */}
              <div>
                <label className="block text-sm font-medium mb-2">Select File *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.tiff,.tif"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {selectedFile && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>

              {/* Drawing Number */}
              <div>
                <label className="block text-sm font-medium mb-2">Drawing Number *</label>
                <input
                  type="text"
                  value={uploadForm.drawingNumber}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, drawingNumber: e.target.value }))}
                  placeholder="e.g., DWG-001"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Site Plan"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Revision */}
              <div>
                <label className="block text-sm font-medium mb-2">Revision</label>
                <input
                  type="text"
                  value={uploadForm.revision}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, revision: e.target.value }))}
                  placeholder="e.g., A, B, 01"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Issue Date */}
              <div>
                <label className="block text-sm font-medium mb-2">Issue Date</label>
                <input
                  type="date"
                  value={uploadForm.issueDate}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, issueDate: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={uploadForm.status}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {DRAWING_STATUSES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setSelectedFile(null)
                  setUploadForm({ drawingNumber: '', title: '', revision: '', issueDate: '', status: 'preliminary' })
                }}
                disabled={uploading}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !uploadForm.drawingNumber || uploading}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {showRevisionModal && revisionDrawing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-2">Upload New Revision</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Creating new revision for: <strong>{revisionDrawing.drawingNumber}</strong>
              {revisionDrawing.revision && ` (Current: Rev ${revisionDrawing.revision})`}
            </p>

            <div className="space-y-4">
              {/* File Input */}
              <div>
                <label className="block text-sm font-medium mb-2">Select File *</label>
                <input
                  ref={revisionFileInputRef}
                  type="file"
                  onChange={(e) => setRevisionFile(e.target.files?.[0] || null)}
                  accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.tiff,.tif"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {revisionFile && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Selected: {revisionFile.name} ({formatFileSize(revisionFile.size)})
                  </p>
                )}
              </div>

              {/* New Revision */}
              <div>
                <label className="block text-sm font-medium mb-2">New Revision *</label>
                <input
                  type="text"
                  value={revisionForm.revision}
                  onChange={(e) => setRevisionForm(prev => ({ ...prev, revision: e.target.value }))}
                  placeholder="e.g., B, C, 02"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={revisionForm.title}
                  onChange={(e) => setRevisionForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Issue Date */}
              <div>
                <label className="block text-sm font-medium mb-2">Issue Date</label>
                <input
                  type="date"
                  value={revisionForm.issueDate}
                  onChange={(e) => setRevisionForm(prev => ({ ...prev, issueDate: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={revisionForm.status}
                  onChange={(e) => setRevisionForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {DRAWING_STATUSES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <strong>Note:</strong> The previous revision ({revisionDrawing.revision || 'original'}) will be marked as superseded.
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRevisionModal(false)
                  setRevisionFile(null)
                  setRevisionDrawing(null)
                }}
                disabled={uploading}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRevisionUpload}
                disabled={!revisionFile || !revisionForm.revision || uploading}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload Revision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
