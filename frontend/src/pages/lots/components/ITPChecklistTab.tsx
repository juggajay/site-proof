/**
 * ITPChecklistTab Component
 * Displays the ITP (Inspection and Test Plan) checklist for a lot.
 * Extracted from LotDetailPage.tsx for better maintainability.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, WifiOff, CloudOff, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Printer } from 'lucide-react'
import { MobileITPChecklist } from '@/components/foreman/MobileITPChecklist'
import type {
  ITPInstance,
  ITPTemplate,
  ITPAttachment,
  ITPCompletion,
  Lot,
} from '../types'

// Props for the ITP checklist item row
interface ITPChecklistItemRowProps {
  item: ITPInstance['template']['checklistItems'][0]
  completion: ITPCompletion | undefined
  projectId: string
  updatingCompletion: string | null
  onToggleCompletion: (checklistItemId: string, isCompleted: boolean, notes: string) => void
  onUpdateNotes: (checklistItemId: string, notes: string) => void
  onAddPhoto: (completionId: string, checklistItemId: string, event: React.ChangeEvent<HTMLInputElement>) => void
  onMarkAsNA: (checklistItemId: string, itemDescription: string) => void
  onMarkAsFailed: (checklistItemId: string, itemDescription: string) => void
  onPhotoClick: (photo: ITPAttachment) => void
  setItpInstance: React.Dispatch<React.SetStateAction<ITPInstance | null>>
}

function ITPChecklistItemRow({
  item,
  completion,
  projectId,
  updatingCompletion,
  onToggleCompletion,
  onUpdateNotes,
  onAddPhoto,
  onMarkAsNA,
  onMarkAsFailed,
  onPhotoClick,
  setItpInstance,
}: ITPChecklistItemRowProps) {
  const isCompleted = completion?.isCompleted || false
  const isNotApplicable = completion?.isNotApplicable || false
  const isFailed = completion?.isFailed || false
  const notes = completion?.notes || ''

  return (
    <div className={`p-4 ${isNotApplicable ? 'bg-gray-50 dark:bg-gray-900/30' : ''} ${isFailed ? 'bg-red-50 dark:bg-red-900/30' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => !isNotApplicable && !isFailed && onToggleCompletion(item.id, isCompleted, notes)}
          disabled={updatingCompletion === item.id || isNotApplicable || isFailed}
          aria-label={isFailed ? 'Failed' : isNotApplicable ? 'Not Applicable' : isCompleted ? `Mark "${item.description}" as incomplete` : `Mark "${item.description}" as complete`}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isFailed
              ? 'bg-red-500 border-red-500 text-white cursor-not-allowed'
              : isNotApplicable
              ? 'bg-gray-400 border-gray-400 text-white cursor-not-allowed'
              : isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-primary'
          } ${updatingCompletion === item.id ? 'opacity-50' : ''}`}
        >
          {isFailed ? <span className="text-[10px] font-bold" aria-hidden="true">X</span> : isNotApplicable ? <span className="text-[10px] font-bold" aria-hidden="true">-</span> : isCompleted && <span className="text-xs" aria-hidden="true">&#10003;</span>}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Point type indicator: S=Standard, W=Witness, H=Hold */}
            <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded ${
              item.pointType === 'hold_point'
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : item.pointType === 'witness'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }`} title={item.pointType === 'hold_point' ? 'Hold Point' : item.pointType === 'witness' ? 'Witness Point' : 'Standard Point'}>
              {item.pointType === 'hold_point' ? 'H' : item.pointType === 'witness' ? 'W' : 'S'}
            </span>
            <span className={`font-medium ${isCompleted || isNotApplicable ? 'line-through text-muted-foreground' : ''}`}>
              {item.order}. {item.description}
            </span>
            {/* N/A Badge */}
            {isNotApplicable && (
              <span className="text-xs bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded font-medium">N/A</span>
            )}
            {item.isHoldPoint && (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Hold Point</span>
            )}
            {/* Responsible party badge */}
            <span className={`text-xs px-2 py-0.5 rounded ${
              item.responsibleParty === 'superintendent'
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                : item.responsibleParty === 'subcontractor'
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                : item.responsibleParty === 'contractor'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-muted'
            }`}>
              {item.responsibleParty === 'superintendent' ? 'Superintendent' :
               item.responsibleParty === 'subcontractor' ? 'Subcontractor' :
               item.responsibleParty === 'contractor' ? 'Contractor' :
               item.category || 'General'}
            </span>
            {/* Evidence required icons */}
            {item.evidenceRequired === 'photo' && (
              <span className="inline-flex items-center text-green-600 dark:text-green-400" title="Photo required">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </span>
            )}
            {(item.evidenceRequired === 'test' || item.testType) && (
              <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400" title={item.testType ? `Test required: ${item.testType}` : 'Test required'}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z" clipRule="evenodd" />
                </svg>
                {item.testType && (
                  <span className="text-xs">{item.testType}</span>
                )}
              </span>
            )}
            {item.evidenceRequired === 'document' && (
              <span className="inline-flex items-center text-blue-600 dark:text-blue-400" title="Document required">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>
          {/* Acceptance Criteria (Feature #632) */}
          {item.acceptanceCriteria && (
            <div className="mt-2 text-sm bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-md p-2">
              <span className="font-medium text-blue-700 dark:text-blue-300">Acceptance Criteria:</span>
              <span className="ml-1 text-blue-600 dark:text-blue-400">{item.acceptanceCriteria}</span>
            </div>
          )}
          <div className="mt-2">
            <input
              type="text"
              placeholder="Add notes..."
              value={notes}
              onChange={(e) => {
                // Optimistic update
                setItpInstance(prev => {
                  if (!prev) return prev
                  const existingIndex = prev.completions.findIndex(c => c.checklistItemId === item.id)
                  const newCompletions = [...prev.completions]
                  if (existingIndex >= 0) {
                    newCompletions[existingIndex] = { ...newCompletions[existingIndex], notes: e.target.value }
                  } else {
                    newCompletions.push({
                      id: '',
                      checklistItemId: item.id,
                      isCompleted: false,
                      notes: e.target.value,
                      completedAt: null,
                      completedBy: null,
                      isVerified: false,
                      verifiedAt: null,
                      verifiedBy: null,
                      attachments: []
                    })
                  }
                  return { ...prev, completions: newCompletions }
                })
              }}
              onBlur={(e) => onUpdateNotes(item.id, e.target.value)}
              className="w-full px-2 py-1 text-sm border rounded bg-transparent"
            />
          </div>
          {completion?.completedBy && (
            <p className="text-xs text-muted-foreground mt-1">
              Completed by {completion.completedBy.fullName || completion.completedBy.email}
              {completion.completedAt && ` on ${new Date(completion.completedAt).toLocaleDateString()}`}
            </p>
          )}

          {/* Witness Point Details (if this is a witness point and has witness data) */}
          {item.pointType === 'witness' && completion?.witnessPresent !== undefined && completion?.witnessPresent !== null && (
            <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Witness Details:
              </p>
              {completion.witnessPresent ? (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Witness present: {completion.witnessName || 'Name not recorded'}
                  {completion.witnessCompany && ` (${completion.witnessCompany})`}
                </p>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Witness not present (notification given)
                </p>
              )}
            </div>
          )}

          {/* Photo Attachments Section */}
          <div className="mt-3 pt-2 border-t border-gray-100">
            {/* Display existing attachments */}
            {completion?.attachments && completion.attachments.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <span>Photos ({completion.attachments.length})</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {completion.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative group cursor-pointer"
                      onClick={() => onPhotoClick(attachment)}
                    >
                      <img
                        src={attachment.document.fileUrl}
                        alt={attachment.document.caption || attachment.document.filename}
                        className="w-16 h-16 object-cover rounded border hover:border-primary transition-colors"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                        <span className="text-white text-xs">View</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Photo Button */}
            {completion?.id && !isNotApplicable && (
              <label className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 cursor-pointer">
                <span>Add Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onAddPhoto(completion.id, item.id, e)}
                />
              </label>
            )}
            {!completion?.id && !isNotApplicable && (
              <span className="text-xs text-muted-foreground italic">
                Complete the item first to attach photos
              </span>
            )}

            {/* Mark as N/A and Mark as Failed Buttons - only show for pending items */}
            {!isCompleted && !isNotApplicable && !isFailed && (
              <div className="flex items-center gap-2 ml-3">
                <button
                  onClick={() => onMarkAsNA(item.id, item.description)}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  title="Mark this item as Not Applicable"
                >
                  <span>-</span>
                  <span>Mark as N/A</span>
                </button>
                <button
                  onClick={() => onMarkAsFailed(item.id, item.description)}
                  className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                  title="Mark this item as Failed and raise an NCR"
                >
                  <span>X</span>
                  <span>Mark as Failed</span>
                </button>
              </div>
            )}

            {/* Show N/A reason */}
            {isNotApplicable && notes && (
              <p className="text-xs text-gray-500 mt-1">
                <span className="font-medium">Reason:</span> {notes}
              </p>
            )}

            {/* Show Failed status with NCR link */}
            {isFailed && (
              <p className="text-xs text-red-600 mt-1">
                <span className="font-medium">Failed</span>
                {notes && `: ${notes}`}
                {completion?.linkedNcr && (
                  <a
                    href={`/projects/${projectId}/ncr`}
                    className="ml-2 underline hover:text-red-800"
                  >
                    View NCR {completion.linkedNcr.ncrNumber}
                  </a>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Photo Lightbox component
interface PhotoLightboxProps {
  selectedPhoto: ITPAttachment
  allPhotos: ITPAttachment[]
  itpInstance: ITPInstance | null
  photoZoom: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
}

function PhotoLightbox({
  selectedPhoto,
  allPhotos,
  itpInstance,
  photoZoom,
  onClose,
  onPrev,
  onNext,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: PhotoLightboxProps) {
  const currentIndex = allPhotos.findIndex(p => p.id === selectedPhoto.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < allPhotos.length - 1

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onPrev()
        else if (e.key === 'ArrowRight') onNext()
        else if (e.key === 'Escape') onClose()
        else if (e.key === '+' || e.key === '=') onZoomIn()
        else if (e.key === '-') onZoomOut()
        else if (e.key === '0') onResetZoom()
      }}
      tabIndex={0}
      data-testid="photo-lightbox"
    >
      {/* Previous Button */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev() }}
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
          onClick={(e) => { e.stopPropagation(); onNext() }}
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
          onClick={onZoomOut}
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
          onClick={onZoomIn}
          className="bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Zoom in"
          disabled={photoZoom >= 4}
          data-testid="photo-lightbox-zoom-in"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        {photoZoom !== 1 && (
          <button
            onClick={onResetZoom}
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
          X
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
                    ITP Item: {checklistItem.order}. {checklistItem.description}
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
                Open in Google Maps
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Main ITPChecklistTab props
export interface ITPChecklistTabProps {
  lot: Lot
  projectId: string
  itpInstance: ITPInstance | null
  setItpInstance: React.Dispatch<React.SetStateAction<ITPInstance | null>>
  templates: ITPTemplate[]
  loadingItp: boolean
  isOnline: boolean
  isOfflineData: boolean
  offlinePendingCount: number
  isMobile: boolean
  updatingCompletion: string | null
  canCompleteITPItems: boolean
  // Handlers
  onToggleCompletion: (checklistItemId: string, currentlyCompleted: boolean, existingNotes: string | null, forceComplete?: boolean, witnessData?: { witnessPresent: boolean; witnessName?: string; witnessCompany?: string }) => Promise<void>
  onUpdateNotes: (checklistItemId: string, notes: string) => Promise<void>
  onMarkAsNA: (checklistItemId: string, reason: string) => Promise<void>
  onMarkAsFailed: (checklistItemId: string, reason: string) => Promise<void>
  onAddPhoto: (checklistItemId: string, file: File) => Promise<void>
  onAddPhotoDesktop: (completionId: string, checklistItemId: string, event: React.ChangeEvent<HTMLInputElement>) => void
  onAssignTemplate: (templateId: string) => Promise<void>
  assigningTemplate: boolean
  // Modal state setters
  onOpenNaModal: (data: { checklistItemId: string; itemDescription: string }) => void
  onOpenFailedModal: (data: { checklistItemId: string; itemDescription: string }) => void
}

export function ITPChecklistTab({
  lot,
  projectId,
  itpInstance,
  setItpInstance,
  templates,
  loadingItp,
  isOnline,
  isOfflineData,
  offlinePendingCount,
  isMobile,
  updatingCompletion,
  canCompleteITPItems,
  onToggleCompletion,
  onUpdateNotes,
  onMarkAsNA,
  onMarkAsFailed,
  onAddPhoto,
  onAddPhotoDesktop,
  onAssignTemplate,
  assigningTemplate,
  onOpenNaModal,
  onOpenFailedModal,
}: ITPChecklistTabProps) {
  const navigate = useNavigate()

  // Local state for ITP tab
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false)
  const [itpStatusFilter, setItpStatusFilter] = useState<'all' | 'pending' | 'completed' | 'na' | 'failed'>('all')
  const [expandedItpCategories, setExpandedItpCategories] = useState<Set<string>>(new Set())
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<ITPAttachment | null>(null)
  const [photoZoom, setPhotoZoom] = useState(1)

  // Photo navigation handlers
  const getAllPhotos = (): ITPAttachment[] => {
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
    return allPhotos
  }

  const handlePrevPhoto = () => {
    if (!selectedPhoto) return
    const allPhotos = getAllPhotos()
    const currentIndex = allPhotos.findIndex(p => p.id === selectedPhoto.id)
    if (currentIndex > 0) {
      setSelectedPhoto(allPhotos[currentIndex - 1])
      setPhotoZoom(1)
    }
  }

  const handleNextPhoto = () => {
    if (!selectedPhoto) return
    const allPhotos = getAllPhotos()
    const currentIndex = allPhotos.findIndex(p => p.id === selectedPhoto.id)
    if (currentIndex < allPhotos.length - 1) {
      setSelectedPhoto(allPhotos[currentIndex + 1])
      setPhotoZoom(1)
    }
  }

  const handleClosePhoto = () => {
    setSelectedPhoto(null)
    setPhotoZoom(1)
  }

  if (loadingItp) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Mobile ITP Checklist
  if (itpInstance && isMobile) {
    return (
      <MobileITPChecklist
        lotNumber={lot?.lotNumber || ''}
        templateName={itpInstance.template.name}
        checklistItems={itpInstance.template.checklistItems}
        completions={itpInstance.completions}
        onToggleCompletion={async (checklistItemId, isCompleted, notes) => {
          await onToggleCompletion(checklistItemId, !isCompleted, notes)
        }}
        onMarkNotApplicable={onMarkAsNA}
        onMarkFailed={onMarkAsFailed}
        onUpdateNotes={onUpdateNotes}
        onAddPhoto={onAddPhoto}
        updatingItem={updatingCompletion}
        canCompleteItems={canCompleteITPItems}
      />
    )
  }

  // Desktop ITP Checklist
  if (itpInstance) {
    const totalItems = itpInstance.template.checklistItems.length
    const completedItems = itpInstance.completions.filter(c => c.isCompleted).length
    const naItems = itpInstance.completions.filter(c => c.isNotApplicable).length
    const finishedItems = completedItems + naItems
    const percentage = totalItems > 0 ? Math.round((finishedItems / totalItems) * 100) : 0

    // Group items by category
    const categorizedItems: Record<string, typeof itpInstance.template.checklistItems> = {}
    itpInstance.template.checklistItems.forEach(item => {
      const category = item.category || 'General'
      if (!categorizedItems[category]) categorizedItems[category] = []
      categorizedItems[category].push(item)
    })
    const categories = Object.keys(categorizedItems)

    return (
      <>
        <div className="rounded-lg border p-4">
          {/* Offline indicator */}
          {(isOfflineData || !isOnline || offlinePendingCount > 0) && (
            <div className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              !isOnline ? 'bg-amber-50 text-amber-800 border border-amber-200' :
              isOfflineData ? 'bg-blue-50 text-blue-800 border border-blue-200' :
              'bg-green-50 text-green-800 border border-green-200'
            }`}>
              {!isOnline ? (
                <>
                  <WifiOff className="h-4 w-4" />
                  <span>Offline Mode - Changes will sync when online</span>
                  {offlinePendingCount > 0 && (
                    <span className="ml-auto bg-amber-200 px-2 py-0.5 rounded-full text-xs font-medium">
                      {offlinePendingCount} pending
                    </span>
                  )}
                </>
              ) : isOfflineData ? (
                <>
                  <CloudOff className="h-4 w-4" />
                  <span>Showing cached data</span>
                </>
              ) : offlinePendingCount > 0 ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>{offlinePendingCount} changes pending sync</span>
                </>
              ) : null}
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">ITP Progress</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{itpInstance.template.name}</span>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors print:hidden"
                title="Print ITP Checklist"
              >
                <Printer className="h-4 w-4" />
                <span>Print Checklist</span>
              </button>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${percentage}%` }}></div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {finishedItems} of {totalItems} checklist items completed ({percentage}%)
            {naItems > 0 && <span className="text-gray-500"> - {naItems} N/A</span>}
          </p>
        </div>

        {/* Status filter dropdown */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="itp-status-filter" className="text-sm font-medium text-muted-foreground">
              Filter by status:
            </label>
            <select
              id="itp-status-filter"
              value={itpStatusFilter}
              onChange={(e) => setItpStatusFilter(e.target.value as typeof itpStatusFilter)}
              className="text-sm border rounded-md px-2 py-1 bg-background"
            >
              <option value="all">All Items</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="na">N/A</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showIncompleteOnly}
              onChange={(e) => setShowIncompleteOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Show incomplete only</span>
          </label>
        </div>

        {/* Categorized checklist items */}
        <div className="rounded-lg border">
          <div className="divide-y">
            {categories.map(category => {
              const categoryItems = categorizedItems[category]
              const isExpanded = expandedItpCategories.has(category)

              // Filter items for display
              const filteredItems = categoryItems.filter((item) => {
                const completion = itpInstance.completions.find(c => c.checklistItemId === item.id)
                const isCompleted = completion?.isCompleted || false
                const isNotApplicable = completion?.isNotApplicable || false
                const isFailed = completion?.isFailed || false
                const isPending = !isCompleted && !isNotApplicable && !isFailed

                if (itpStatusFilter === 'pending' && !isPending) return false
                if (itpStatusFilter === 'completed' && !isCompleted) return false
                if (itpStatusFilter === 'na' && !isNotApplicable) return false
                if (itpStatusFilter === 'failed' && !isFailed) return false
                if (showIncompleteOnly && !isPending) return false

                return true
              })

              // Category stats
              const completedInCategory = categoryItems.filter(item => {
                const completion = itpInstance.completions.find(c => c.checklistItemId === item.id)
                return completion?.isCompleted || completion?.isNotApplicable
              }).length
              const totalInCategory = categoryItems.length
              const isCategoryComplete = completedInCategory === totalInCategory

              // Skip category if no items match filter
              if (filteredItems.length === 0 && (itpStatusFilter !== 'all' || showIncompleteOnly)) {
                return null
              }

              return (
                <div key={category}>
                  {/* Category header - collapsible */}
                  <button
                    onClick={() => {
                      setExpandedItpCategories(prev => {
                        const next = new Set(prev)
                        if (next.has(category)) {
                          next.delete(category)
                        } else {
                          next.add(category)
                        }
                        return next
                      })
                    }}
                    className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-semibold">{category}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      isCategoryComplete
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {completedInCategory}/{totalInCategory}
                    </span>
                  </button>

                  {/* Category items - expandable */}
                  {isExpanded && filteredItems.map((item) => {
                    const completion = itpInstance.completions.find(c => c.checklistItemId === item.id)
                    return (
                      <ITPChecklistItemRow
                        key={item.id}
                        item={item}
                        completion={completion}
                        projectId={projectId}
                        updatingCompletion={updatingCompletion}
                        onToggleCompletion={(id, completed, notes) => onToggleCompletion(id, completed, notes)}
                        onUpdateNotes={onUpdateNotes}
                        onAddPhoto={onAddPhotoDesktop}
                        onMarkAsNA={(id, desc) => onOpenNaModal({ checklistItemId: id, itemDescription: desc })}
                        onMarkAsFailed={(id, desc) => onOpenFailedModal({ checklistItemId: id, itemDescription: desc })}
                        onPhotoClick={setSelectedPhoto}
                        setItpInstance={setItpInstance}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Photo Viewer Modal */}
        {selectedPhoto && (
          <PhotoLightbox
            selectedPhoto={selectedPhoto}
            allPhotos={getAllPhotos()}
            itpInstance={itpInstance}
            photoZoom={photoZoom}
            onClose={handleClosePhoto}
            onPrev={handlePrevPhoto}
            onNext={handleNextPhoto}
            onZoomIn={() => setPhotoZoom(prev => Math.min(prev + 0.5, 4))}
            onZoomOut={() => setPhotoZoom(prev => Math.max(prev - 0.5, 0.5))}
            onResetZoom={() => setPhotoZoom(1)}
          />
        )}
      </>
    )
  }

  // No ITP assigned - show assignment UI
  return (
    <>
      <div className="rounded-lg border p-6 text-center">
        <div className="text-4xl mb-2">ITP</div>
        <h3 className="text-lg font-semibold mb-2">ITP Checklist</h3>
        <p className="text-muted-foreground mb-4">
          No ITP template assigned to this lot yet. Assign an ITP template to track quality checkpoints.
        </p>
        {templates.length > 0 ? (
          <button
            onClick={() => setShowAssignModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Assign ITP Template
          </button>
        ) : (
          <button
            onClick={() => navigate(`/projects/${projectId}/itp`)}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Create ITP Template First
          </button>
        )}
      </div>

      {/* Assign Template Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Assign ITP Template</h2>
            {lot.activityType && (
              <p className="text-sm text-muted-foreground mb-3">
                Showing templates for <span className="font-medium text-foreground">{lot.activityType}</span> activity
              </p>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {/* Sort templates: matching activity type first, then others */}
              {[...templates]
                .sort((a, b) => {
                  const aMatches = lot.activityType && a.activityType?.toLowerCase() === lot.activityType.toLowerCase()
                  const bMatches = lot.activityType && b.activityType?.toLowerCase() === lot.activityType.toLowerCase()
                  if (aMatches && !bMatches) return -1
                  if (!aMatches && bMatches) return 1
                  return 0
                })
                .map((template) => {
                  const isMatch = lot.activityType && template.activityType?.toLowerCase() === lot.activityType.toLowerCase()
                  return (
                    <button
                      key={template.id}
                      onClick={() => {
                        onAssignTemplate(template.id)
                        setShowAssignModal(false)
                      }}
                      disabled={assigningTemplate}
                      className={`w-full text-left p-3 border rounded-lg hover:border-primary/50 transition-colors disabled:opacity-50 ${
                        isMatch ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        {isMatch && (
                          <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full">
                            Suggested
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {template.activityType} - {template.checklistItems.length} items
                      </div>
                    </button>
                  )
                })}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
                disabled={assigningTemplate}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
