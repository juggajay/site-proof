import { useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, FileText, Plus, CheckCircle } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { getAuthToken } from '@/lib/auth'
import type {
  ITPAttachment,
  ITPChecklistItem,
  ITPCompletion,
  ITPInstance,
  LotTab,
} from '../types'

interface PhotosTabProps {
  itpInstance: ITPInstance | null
  lotId: string
  onTabChange: (tab: LotTab) => void
  onItpInstanceUpdate: (instance: ITPInstance) => void
}

interface ITPPhoto {
  attachment: ITPAttachment
  checklistItem: ITPChecklistItem
  completion: ITPCompletion
}

export function PhotosTab({
  itpInstance,
  lotId,
  onTabChange,
  onItpInstanceUpdate,
}: PhotosTabProps) {
  // Photo viewer state
  const [selectedPhoto, setSelectedPhoto] = useState<ITPAttachment | null>(null)
  const [photoZoom, setPhotoZoom] = useState(1)

  // Batch photo selection state
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [showBatchCaptionModal, setShowBatchCaptionModal] = useState(false)
  const [batchCaption, setBatchCaption] = useState('')
  const [applyingBatchCaption, setApplyingBatchCaption] = useState(false)

  // Add to Evidence modal state
  const [showAddToEvidenceModal, setShowAddToEvidenceModal] = useState(false)
  const [selectedEvidenceItem, setSelectedEvidenceItem] = useState<string | null>(null)
  const [addingToEvidence, setAddingToEvidence] = useState(false)

  // Collect all photos from ITP completions
  const itpPhotos: ITPPhoto[] = []
  if (itpInstance) {
    itpInstance.completions.forEach(completion => {
      if (completion.attachments && completion.attachments.length > 0) {
        const checklistItem = itpInstance.template.checklistItems.find(
          item => item.id === completion.checklistItemId
        )
        if (checklistItem) {
          completion.attachments.forEach(attachment => {
            itpPhotos.push({ attachment, checklistItem, completion })
          })
        }
      }
    })
  }

  // Helper function to toggle photo selection
  const togglePhotoSelection = (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPhotos(prev => {
      const newSet = new Set(prev)
      if (newSet.has(photoId)) {
        newSet.delete(photoId)
      } else {
        newSet.add(photoId)
      }
      return newSet
    })
  }

  // Helper function to select/deselect all photos
  const toggleSelectAll = () => {
    if (selectedPhotos.size === itpPhotos.length) {
      setSelectedPhotos(new Set())
    } else {
      setSelectedPhotos(new Set(itpPhotos.map(p => p.attachment.document.id)))
    }
  }

  // Refresh ITP data helper
  const refreshItpData = async () => {
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const itpRes = await fetch(`${apiUrl}/api/itp/instances/lot/${lotId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (itpRes.ok) {
      const data = await itpRes.json()
      onItpInstanceUpdate(data.instance)
    }
  }

  // Function to apply batch caption to selected photos
  const applyBatchCaptionToPhotos = async () => {
    if (selectedPhotos.size === 0 || !batchCaption.trim()) return

    setApplyingBatchCaption(true)
    try {
      const token = getAuthToken()
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const updatePromises = Array.from(selectedPhotos).map(documentId =>
        fetch(`${apiUrl}/api/documents/${documentId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ caption: batchCaption.trim() })
        })
      )

      const results = await Promise.all(updatePromises)
      const failed = results.filter(r => !r.ok)

      if (failed.length > 0) {
        toast({
          title: 'Partial Success',
          description: `Updated ${results.length - failed.length} of ${results.length} photos`,
          variant: 'warning'
        })
      } else {
        toast({
          title: 'Success',
          description: `Caption applied to ${selectedPhotos.size} photo${selectedPhotos.size !== 1 ? 's' : ''}`,
        })
      }

      // Refresh ITP data to show updated captions
      await refreshItpData()

      // Clear selections and close modal
      setSelectedPhotos(new Set())
      setBatchCaption('')
      setShowBatchCaptionModal(false)
    } catch (error) {
      console.error('Error applying batch caption:', error)
      toast({
        title: 'Error',
        description: 'Failed to apply caption to photos',
        variant: 'error'
      })
    } finally {
      setApplyingBatchCaption(false)
    }
  }

  // Function to add selected photos to an ITP checklist item as evidence
  const addPhotosToEvidence = async () => {
    if (selectedPhotos.size === 0 || !selectedEvidenceItem) return

    setAddingToEvidence(true)
    try {
      const token = getAuthToken()
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      // First, ensure there's a completion for this checklist item
      let completionId: string | null = null
      const existingCompletion = itpInstance?.completions?.find(
        c => c.checklistItemId === selectedEvidenceItem
      )

      if (existingCompletion) {
        completionId = existingCompletion.id
      } else {
        // Create a pending completion first
        const createRes = await fetch(`${apiUrl}/api/itp/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            itpInstanceId: itpInstance?.id,
            checklistItemId: selectedEvidenceItem,
            isCompleted: false,
            notes: ''
          })
        })
        if (createRes.ok) {
          const data = await createRes.json()
          completionId = data.completion.id
        }
      }

      if (!completionId) {
        throw new Error('Could not find or create completion')
      }

      // Now add each selected photo as an attachment
      const attachmentPromises = Array.from(selectedPhotos).map(async (documentId) => {
        // Find the document details
        const photoDoc = itpPhotos.find(p => p.attachment.document.id === documentId)
        if (!photoDoc) return null

        const res = await fetch(`${apiUrl}/api/itp/completions/${completionId}/attachments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            filename: photoDoc.attachment.document.filename,
            fileUrl: photoDoc.attachment.document.fileUrl,
            caption: photoDoc.attachment.document.caption || `Evidence photo added ${new Date().toLocaleString()}`
          })
        })
        return res.ok
      })

      const results = await Promise.all(attachmentPromises)
      const successCount = results.filter(r => r === true).length

      if (successCount > 0) {
        toast({
          title: 'Success',
          description: `Added ${successCount} photo${successCount !== 1 ? 's' : ''} as evidence`,
        })

        // Refresh ITP data
        await refreshItpData()
      } else {
        toast({
          title: 'Error',
          description: 'Failed to add photos as evidence',
          variant: 'error'
        })
      }

      // Clear selections and close modal
      setSelectedPhotos(new Set())
      setSelectedEvidenceItem(null)
      setShowAddToEvidenceModal(false)
    } catch (error) {
      console.error('Error adding photos to evidence:', error)
      toast({
        title: 'Error',
        description: 'Failed to add photos as evidence',
        variant: 'error'
      })
    } finally {
      setAddingToEvidence(false)
    }
  }

  // Empty state
  if (itpPhotos.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Photos</h2>
        </div>
        <div className="rounded-lg border p-6 text-center">
          <div className="text-4xl mb-2">📷</div>
          <h3 className="text-lg font-semibold mb-2">No Photos</h3>
          <p className="text-muted-foreground">
            No photos have been uploaded for this lot yet. Add photos to ITP checklist items to document work progress.
          </p>
          <button
            onClick={() => onTabChange('itp')}
            className="mt-4 rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
          >
            Go to ITP Checklist
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Photos</h2>
      </div>

      <div className="space-y-4">
        {/* Header with selection controls */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {itpPhotos.length} photo{itpPhotos.length !== 1 ? 's' : ''} attached to ITP checklist items
          </p>
          <div className="flex items-center gap-2">
            {/* Select All checkbox */}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPhotos.size === itpPhotos.length && itpPhotos.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300"
              />
              Select All
            </label>
            {/* Bulk Caption button - only show when photos selected */}
            {selectedPhotos.size > 0 && (
              <>
                <button
                  onClick={() => setShowBatchCaptionModal(true)}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 flex items-center gap-1"
                >
                  <FileText className="h-4 w-4" />
                  Bulk Caption ({selectedPhotos.size})
                </button>
                <button
                  onClick={() => setShowAddToEvidenceModal(true)}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add to Evidence ({selectedPhotos.size})
                </button>
              </>
            )}
          </div>
        </div>

        {/* Photo grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {itpPhotos.map(({ attachment, checklistItem }) => {
            const isSelected = selectedPhotos.has(attachment.document.id)
            return (
              <div
                key={attachment.id}
                className={`relative group cursor-pointer rounded-lg border overflow-hidden transition-colors ${
                  isSelected ? 'border-primary border-2 ring-2 ring-primary/20' : 'hover:border-primary'
                }`}
                onClick={() => setSelectedPhoto(attachment)}
              >
                {/* Selection checkbox */}
                <div
                  className="absolute top-2 left-2 z-10"
                  onClick={(e) => togglePhotoSelection(attachment.document.id, e)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="h-5 w-5 rounded border-2 border-white bg-white/80 cursor-pointer"
                  />
                </div>
                <img
                  src={attachment.document.fileUrl}
                  alt={attachment.document.caption || attachment.document.filename}
                  className="w-full h-40 object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium">View</span>
                </div>
                {/* Caption badge if exists */}
                {attachment.document.caption && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
                    Captioned
                  </div>
                )}
                {/* ITP Reference Badge */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-xs text-white truncate flex items-center gap-1">
                    <span>📋</span>
                    <span className="font-medium">ITP {checklistItem.order}:</span>
                    <span className="truncate">{checklistItem.description}</span>
                  </p>
                  {attachment.document.caption && (
                    <p className="text-xs text-white/80 truncate mt-0.5">
                      📝 {attachment.document.caption}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Batch Caption Modal */}
        {showBatchCaptionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">Bulk Caption Photos</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Apply caption to {selectedPhotos.size} selected photo{selectedPhotos.size !== 1 ? 's' : ''}
              </p>
              <textarea
                value={batchCaption}
                onChange={(e) => setBatchCaption(e.target.value)}
                placeholder="Enter caption for all selected photos..."
                className="w-full h-24 rounded-lg border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setShowBatchCaptionModal(false)
                    setBatchCaption('')
                  }}
                  className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
                  disabled={applyingBatchCaption}
                >
                  Cancel
                </button>
                <button
                  onClick={applyBatchCaptionToPhotos}
                  disabled={!batchCaption.trim() || applyingBatchCaption}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {applyingBatchCaption ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Applying...
                    </>
                  ) : (
                    'Apply Caption'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add to Evidence Modal */}
        {showAddToEvidenceModal && itpInstance?.template?.checklistItems && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Add Photos to Evidence</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select an ITP checklist item to attach {selectedPhotos.size} photo{selectedPhotos.size !== 1 ? 's' : ''} as evidence
              </p>
              <div className="space-y-2 mb-4">
                {itpInstance.template.checklistItems.map((item: ITPChecklistItem) => {
                  const completion = itpInstance.completions?.find(c => c.checklistItemId === item.id)
                  const isSelected = selectedEvidenceItem === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedEvidenceItem(item.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                          : 'hover:border-primary hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {item.order}. {item.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.evidenceRequired !== 'none' ? `Requires: ${item.evidenceRequired}` : 'No evidence required'}
                            {(completion?.attachments?.length ?? 0) > 0 && ` • ${completion?.attachments?.length ?? 0} attached`}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="h-5 w-5 text-green-500 ml-2 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAddToEvidenceModal(false)
                    setSelectedEvidenceItem(null)
                  }}
                  className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
                  disabled={addingToEvidence}
                >
                  Cancel
                </button>
                <button
                  onClick={addPhotosToEvidence}
                  disabled={!selectedEvidenceItem || addingToEvidence}
                  className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {addingToEvidence ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Adding...
                    </>
                  ) : (
                    'Add to Evidence'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Photo Viewer Modal with Prev/Next Navigation and Zoom */}
      <PhotoViewerModal
        selectedPhoto={selectedPhoto}
        photoZoom={photoZoom}
        itpInstance={itpInstance}
        onClose={() => {
          setSelectedPhoto(null)
          setPhotoZoom(1)
        }}
        onPhotoChange={(photo) => {
          setSelectedPhoto(photo)
          setPhotoZoom(1)
        }}
        onZoomChange={setPhotoZoom}
      />
    </div>
  )
}

// Photo Viewer Modal Component
interface PhotoViewerModalProps {
  selectedPhoto: ITPAttachment | null
  photoZoom: number
  itpInstance: ITPInstance | null
  onClose: () => void
  onPhotoChange: (photo: ITPAttachment) => void
  onZoomChange: (zoom: number) => void
}

function PhotoViewerModal({
  selectedPhoto,
  photoZoom,
  itpInstance,
  onClose,
  onPhotoChange,
  onZoomChange,
}: PhotoViewerModalProps) {
  if (!selectedPhoto) return null

  // Collect all photos for navigation
  const allPhotos: ITPAttachment[] = []
  if (itpInstance) {
    itpInstance.completions.forEach(completion => {
      if (completion.attachments && completion.attachments.length > 0) {
        completion.attachments.forEach(attachment => {
          allPhotos.push(attachment)
        })
      }
    })
  }

  const currentIndex = allPhotos.findIndex(p => p.id === selectedPhoto.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < allPhotos.length - 1

  const goToPrev = () => {
    if (hasPrev) {
      onPhotoChange(allPhotos[currentIndex - 1])
    }
  }

  const goToNext = () => {
    if (hasNext) {
      onPhotoChange(allPhotos[currentIndex + 1])
    }
  }

  const handleZoomIn = () => {
    onZoomChange(Math.min(photoZoom + 0.5, 4))
  }

  const handleZoomOut = () => {
    onZoomChange(Math.max(photoZoom - 0.5, 0.5))
  }

  const handleResetZoom = () => {
    onZoomChange(1)
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') goToPrev()
        else if (e.key === 'ArrowRight') goToNext()
        else if (e.key === 'Escape') onClose()
        else if (e.key === '+' || e.key === '=') handleZoomIn()
        else if (e.key === '-') handleZoomOut()
        else if (e.key === '0') handleResetZoom()
      }}
      tabIndex={0}
      data-testid="photo-lightbox"
    >
      {/* Previous Button */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); goToPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full p-3 text-white transition-colors z-10"
          title="Previous photo"
          data-testid="photo-lightbox-prev"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next Button */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); goToNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full p-3 text-white transition-colors z-10"
          title="Next photo"
          data-testid="photo-lightbox-next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Zoom Controls */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-lg p-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleZoomOut}
          className="bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Zoom out"
          disabled={photoZoom <= 0.5}
          data-testid="photo-lightbox-zoom-out"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <span className="text-white text-sm min-w-[60px] text-center" data-testid="photo-lightbox-zoom-level">
          {Math.round(photoZoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Zoom in"
          disabled={photoZoom >= 4}
          data-testid="photo-lightbox-zoom-in"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        {photoZoom !== 1 && (
          <button
            onClick={handleResetZoom}
            className="bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors ml-1"
            title="Reset zoom"
            data-testid="photo-lightbox-zoom-reset"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="relative max-w-4xl max-h-[90vh] p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors z-10"
          data-testid="photo-lightbox-close"
        >
          ✕
        </button>
        <div className="flex items-center justify-center min-h-[60vh]">
          <img
            src={selectedPhoto.document.fileUrl}
            alt={selectedPhoto.document.caption || selectedPhoto.document.filename}
            className="max-w-full max-h-[80vh] object-contain rounded-lg transition-transform duration-200"
            style={{ transform: `scale(${photoZoom})` }}
            data-testid="photo-lightbox-image"
          />
        </div>
        <div className="mt-3 text-white text-center">
          <p className="font-medium">{selectedPhoto.document.caption || selectedPhoto.document.filename}</p>
          {allPhotos.length > 1 && (
            <p className="text-sm text-white/50 mt-1">
              {currentIndex + 1} of {allPhotos.length}
            </p>
          )}
          {selectedPhoto.document.uploadedBy && (
            <p className="text-sm text-white/70 mt-1">
              Uploaded by {selectedPhoto.document.uploadedBy.fullName || selectedPhoto.document.uploadedBy.email}
              {selectedPhoto.document.uploadedAt && ` on ${new Date(selectedPhoto.document.uploadedAt).toLocaleDateString()}`}
            </p>
          )}
          {/* Show ITP item reference */}
          {itpInstance && (() => {
            const completion = itpInstance.completions.find(c =>
              c.attachments?.some(a => a.id === selectedPhoto.id)
            )
            if (completion) {
              const checklistItem = itpInstance.template.checklistItems.find(
                item => item.id === completion.checklistItemId
              )
              if (checklistItem) {
                return (
                  <p className="text-sm bg-primary/30 px-3 py-1 rounded mt-2 inline-block">
                    📋 ITP Item: {checklistItem.order}. {checklistItem.description}
                  </p>
                )
              }
            }
            return null
          })()}
          {/* GPS Location Map */}
          {selectedPhoto.document.gpsLatitude && selectedPhoto.document.gpsLongitude && (
            <div className="mt-4" data-testid="photo-gps-map">
              <div className="flex items-center gap-2 text-white/70 text-sm mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>Photo Location</span>
                <span className="text-white/50">
                  ({Number(selectedPhoto.document.gpsLatitude).toFixed(6)}, {Number(selectedPhoto.document.gpsLongitude).toFixed(6)})
                </span>
              </div>
              <div className="rounded-lg overflow-hidden border border-white/20">
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(selectedPhoto.document.gpsLongitude) - 0.005}%2C${Number(selectedPhoto.document.gpsLatitude) - 0.003}%2C${Number(selectedPhoto.document.gpsLongitude) + 0.005}%2C${Number(selectedPhoto.document.gpsLatitude) + 0.003}&layer=mapnik&marker=${selectedPhoto.document.gpsLatitude}%2C${selectedPhoto.document.gpsLongitude}`}
                  width="300"
                  height="200"
                  style={{ border: 0 }}
                  title="Photo location map"
                  loading="lazy"
                />
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${selectedPhoto.document.gpsLatitude},${selectedPhoto.document.gpsLongitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
                onClick={(e) => e.stopPropagation()}
              >
                Open in Google Maps →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
