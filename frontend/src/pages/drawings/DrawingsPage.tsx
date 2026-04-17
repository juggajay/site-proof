// Feature #250: Drawing Register management page
import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAuthToken } from '../../lib/auth'
import { apiFetch } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import { createMutationErrorHandler } from '@/lib/errorHandling'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'

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
  { id: 'for_construction', label: 'For Construction', color: 'bg-primary/10 text-primary' },
  { id: 'as_built', label: 'As-Built', color: 'bg-green-100 text-green-800' },
]

export function DrawingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
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
  const [committedSearch, setCommittedSearch] = useState('')

  // Download current set state
  const [downloadingCurrentSet, setDownloadingCurrentSet] = useState(false)

  const triggerSearch = () => setCommittedSearch(searchQuery.trim())

  // Build query path
  const drawingsQueryPath = (() => {
    let path = `/api/drawings/${projectId}`
    const params = new URLSearchParams()
    if (filterStatus) params.append('status', filterStatus)
    if (committedSearch) params.append('search', committedSearch)
    if (params.toString()) path += `?${params.toString()}`
    return path
  })()

  const { data: drawingsData, isLoading: loading, error: drawingsError } = useQuery({
    queryKey: [...queryKeys.drawings(projectId!), filterStatus, committedSearch] as const,
    queryFn: () => apiFetch<any>(drawingsQueryPath),
    enabled: !!projectId,
  })

  const drawings: Drawing[] = drawingsData?.drawings || []
  const stats: Stats | null = drawingsData?.stats || null
  const error = drawingsError ? 'Failed to load drawings' : null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  // Upload drawing mutation (FormData)
  const uploadDrawingMutation = useMutation({
    mutationFn: async ({ file, form }: { file: File; form: typeof uploadForm }) => {
      const token = getAuthToken()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', projectId || '')
      formData.append('drawingNumber', form.drawingNumber)
      if (form.title) formData.append('title', form.title)
      if (form.revision) formData.append('revision', form.revision)
      if (form.issueDate) formData.append('issueDate', form.issueDate)
      formData.append('status', form.status)

      const res = await fetch(`${API_URL}/api/drawings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to upload drawing')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings(projectId!) })
      setShowUploadModal(false)
      setSelectedFile(null)
      setUploadForm({ drawingNumber: '', title: '', revision: '', issueDate: '', status: 'preliminary' })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: createMutationErrorHandler('Failed to upload drawing'),
  })

  const handleUpload = () => {
    if (!selectedFile || !uploadForm.drawingNumber) {
      alert('Please select a file and enter a drawing number')
      return
    }
    uploadDrawingMutation.mutate({ file: selectedFile, form: uploadForm })
  }

  // Delete drawing mutation
  const deleteDrawingMutation = useMutation({
    mutationFn: (drawingId: string) =>
      apiFetch(`/api/drawings/${drawingId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings(projectId!) })
    },
    onError: createMutationErrorHandler('Failed to delete drawing'),
  })

  const handleDelete = (drawingId: string) => {
    if (!confirm('Are you sure you want to delete this drawing?')) return
    deleteDrawingMutation.mutate(drawingId)
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

  // Revision upload mutation (FormData)
  const revisionUploadMutation = useMutation({
    mutationFn: async ({ drawingId, file, form }: { drawingId: string; file: File; form: typeof revisionForm }) => {
      const token = getAuthToken()
      const formData = new FormData()
      formData.append('file', file)
      if (form.title) formData.append('title', form.title)
      formData.append('revision', form.revision)
      if (form.issueDate) formData.append('issueDate', form.issueDate)
      formData.append('status', form.status)

      const res = await fetch(`${API_URL}/api/drawings/${drawingId}/supersede`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to upload new revision')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings(projectId!) })
      setShowRevisionModal(false)
      setRevisionFile(null)
      setRevisionDrawing(null)
      if (revisionFileInputRef.current) revisionFileInputRef.current.value = ''
    },
    onError: createMutationErrorHandler('Failed to upload revision'),
  })

  const handleRevisionUpload = () => {
    if (!revisionFile || !revisionForm.revision || !revisionDrawing) {
      alert('Please select a file and enter a new revision')
      return
    }
    revisionUploadMutation.mutate({ drawingId: revisionDrawing.id, file: revisionFile, form: revisionForm })
  }

  // Status change mutation
  const statusChangeMutation = useMutation({
    mutationFn: ({ drawingId, newStatus }: { drawingId: string; newStatus: string }) =>
      apiFetch<any>(`/api/drawings/${drawingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings(projectId!) })
    },
    onError: createMutationErrorHandler('Failed to update status'),
  })

  const handleStatusChange = (drawingId: string, newStatus: string) => {
    statusChangeMutation.mutate({ drawingId, newStatus })
  }

  const uploading = uploadDrawingMutation.isPending || revisionUploadMutation.isPending

  // Download current set - downloads all current (non-superseded) drawings
  const downloadCurrentSet = async () => {
    setDownloadingCurrentSet(true)
    try {
      const data = await apiFetch<any>(`/api/drawings/${projectId}/current-set`)
      if (data.drawings.length === 0) {
        alert('No current drawings to download')
        return
      }

      for (const drawing of data.drawings) {
        const link = document.createElement('a')
          link.href = getDocumentUrl(drawing.fileUrl)
          link.download = `${drawing.drawingNumber}_Rev${drawing.revision || '0'}_${drawing.filename}`
          link.target = '_blank'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
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
    return DRAWING_STATUSES.find(s => s.id === status) || { id: status, label: status, color: 'bg-muted text-foreground' }
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
          <Button
            variant="outline"
            onClick={downloadCurrentSet}
            disabled={downloadingCurrentSet || drawings.length === 0}
            title="Download all current (non-superseded) drawings"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloadingCurrentSet ? 'Downloading...' : 'Download Current Set'}
          </Button>
          <Button onClick={() => setShowUploadModal(true)}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Drawing
          </Button>
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
            <div className="text-2xl font-bold text-primary">{stats.forConstruction}</div>
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
            <Label className="mb-1">Status</Label>
            <NativeSelect
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              {DRAWING_STATUSES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex-1">
            <Label className="mb-1">Search</Label>
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
              placeholder="Search by drawing number or title..."
            />
          </div>
          <Button variant="secondary" onClick={triggerSearch}>
            Search
          </Button>
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
                        <NativeSelect
                          value={drawing.status}
                          onChange={(e) => handleStatusChange(drawing.id, e.target.value)}
                          className={`rounded-full px-3 py-1 text-xs font-medium h-auto ${statusInfo.color}`}
                        >
                          {DRAWING_STATUSES.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </NativeSelect>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openRevisionModal(drawing)}
                              className="text-primary hover:bg-primary/10 h-8 w-8"
                              title="Upload New Revision"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(drawing.id)}
                            className="text-red-600 hover:bg-red-100 h-8 w-8"
                            title="Delete"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
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
        <Modal onClose={() => { setShowUploadModal(false); setSelectedFile(null); setUploadForm({ drawingNumber: '', title: '', revision: '', issueDate: '', status: 'preliminary' }) }} className="max-w-lg">
          <ModalHeader>Add Drawing</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {/* File Input */}
              <div>
                <Label className="mb-2">Select File *</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.tiff,.tif"
                />
                {selectedFile && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>

              {/* Drawing Number */}
              <div>
                <Label className="mb-2">Drawing Number *</Label>
                <Input
                  type="text"
                  value={uploadForm.drawingNumber}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, drawingNumber: e.target.value }))}
                  placeholder="e.g., DWG-001"
                />
              </div>

              {/* Title */}
              <div>
                <Label className="mb-2">Title</Label>
                <Input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Site Plan"
                />
              </div>

              {/* Revision */}
              <div>
                <Label className="mb-2">Revision</Label>
                <Input
                  type="text"
                  value={uploadForm.revision}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, revision: e.target.value }))}
                  placeholder="e.g., A, B, 01"
                />
              </div>

              {/* Issue Date */}
              <div>
                <Label className="mb-2">Issue Date</Label>
                <Input
                  type="date"
                  value={uploadForm.issueDate}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, issueDate: e.target.value }))}
                />
              </div>

              {/* Status */}
              <div>
                <Label className="mb-2">Status</Label>
                <NativeSelect
                  value={uploadForm.status}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, status: e.target.value }))}
                >
                  {DRAWING_STATUSES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadModal(false)
                setSelectedFile(null)
                setUploadForm({ drawingNumber: '', title: '', revision: '', issueDate: '', status: 'preliminary' })
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !uploadForm.drawingNumber || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Revision Modal */}
      {showRevisionModal && revisionDrawing && (
        <Modal onClose={() => { setShowRevisionModal(false); setRevisionFile(null); setRevisionDrawing(null) }} className="max-w-lg">
          <ModalHeader>Upload New Revision</ModalHeader>
          <ModalBody>
            <p className="text-sm text-muted-foreground mb-4">
              Creating new revision for: <strong>{revisionDrawing.drawingNumber}</strong>
              {revisionDrawing.revision && ` (Current: Rev ${revisionDrawing.revision})`}
            </p>

            <div className="space-y-4">
              {/* File Input */}
              <div>
                <Label className="mb-2">Select File *</Label>
                <Input
                  ref={revisionFileInputRef}
                  type="file"
                  onChange={(e) => setRevisionFile(e.target.files?.[0] || null)}
                  accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.tiff,.tif"
                />
                {revisionFile && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Selected: {revisionFile.name} ({formatFileSize(revisionFile.size)})
                  </p>
                )}
              </div>

              {/* New Revision */}
              <div>
                <Label className="mb-2">New Revision *</Label>
                <Input
                  type="text"
                  value={revisionForm.revision}
                  onChange={(e) => setRevisionForm(prev => ({ ...prev, revision: e.target.value }))}
                  placeholder="e.g., B, C, 02"
                />
              </div>

              {/* Title */}
              <div>
                <Label className="mb-2">Title</Label>
                <Input
                  type="text"
                  value={revisionForm.title}
                  onChange={(e) => setRevisionForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              {/* Issue Date */}
              <div>
                <Label className="mb-2">Issue Date</Label>
                <Input
                  type="date"
                  value={revisionForm.issueDate}
                  onChange={(e) => setRevisionForm(prev => ({ ...prev, issueDate: e.target.value }))}
                />
              </div>

              {/* Status */}
              <div>
                <Label className="mb-2">Status</Label>
                <NativeSelect
                  value={revisionForm.status}
                  onChange={(e) => setRevisionForm(prev => ({ ...prev, status: e.target.value }))}
                >
                  {DRAWING_STATUSES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </NativeSelect>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <strong>Note:</strong> The previous revision ({revisionDrawing.revision || 'original'}) will be marked as superseded.
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRevisionModal(false)
                setRevisionFile(null)
                setRevisionDrawing(null)
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevisionUpload}
              disabled={!revisionFile || !revisionForm.revision || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload Revision'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  )
}
