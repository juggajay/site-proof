// MobileITPChecklist - Mobile-optimized ITP completion interface for foremen/subcontractors
// Features: Simple status buttons (Pass/N/A/Fail), notes, photos, no blocking
import { useState, useRef, useEffect } from 'react'
import { BottomSheet } from './sheets/BottomSheet'
import { useHaptics } from '@/hooks/useHaptics'
import { Camera, MessageSquare, Image, ChevronRight } from 'lucide-react'

interface ITPChecklistItem {
  id: string
  description: string
  category: string
  responsibleParty: 'contractor' | 'subcontractor' | 'superintendent' | 'general'
  isHoldPoint: boolean
  pointType: 'standard' | 'witness' | 'hold_point'
  evidenceRequired: 'none' | 'photo' | 'test' | 'document'
  order: number
  testType?: string | null
  acceptanceCriteria?: string | null
}

interface ITPAttachment {
  id: string
  documentId: string
  document: {
    id: string
    filename: string
    fileUrl: string
    caption: string | null
  }
}

interface ITPCompletion {
  id: string
  checklistItemId: string
  isCompleted: boolean
  isNotApplicable?: boolean
  isFailed?: boolean
  notes: string | null
  completedAt: string | null
  completedBy: { id: string; fullName: string; email: string } | null
  attachments: ITPAttachment[]
}

interface MobileITPChecklistProps {
  lotNumber: string
  templateName: string
  checklistItems: ITPChecklistItem[]
  completions: ITPCompletion[]
  onToggleCompletion: (checklistItemId: string, isCompleted: boolean, notes: string | null) => Promise<void>
  onMarkNotApplicable: (checklistItemId: string, reason: string) => Promise<void>
  onMarkFailed: (checklistItemId: string, reason: string) => Promise<void>
  onUpdateNotes: (checklistItemId: string, notes: string) => Promise<void>
  onAddPhoto: (checklistItemId: string, file: File) => Promise<void>
  updatingItem?: string | null
}

export function MobileITPChecklist({
  lotNumber,
  templateName,
  checklistItems,
  completions,
  onToggleCompletion,
  onMarkNotApplicable,
  onMarkFailed,
  onUpdateNotes,
  onAddPhoto,
  updatingItem,
}: MobileITPChecklistProps) {
  const [selectedItem, setSelectedItem] = useState<ITPChecklistItem | null>(null)
  const { trigger } = useHaptics()

  const getCompletion = (itemId: string) => completions.find(c => c.checklistItemId === itemId)

  const getItemStatus = (itemId: string): 'pending' | 'completed' | 'na' | 'failed' => {
    const completion = getCompletion(itemId)
    if (!completion) return 'pending'
    if (completion.isFailed) return 'failed'
    if (completion.isNotApplicable) return 'na'
    if (completion.isCompleted) return 'completed'
    return 'pending'
  }

  const completedCount = completions.filter(c => c.isCompleted || c.isNotApplicable).length
  const totalCount = checklistItems.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold">{lotNumber}</h1>
            <p className="text-sm text-muted-foreground">{templateName}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{progress}%</p>
            <p className="text-xs text-muted-foreground">{completedCount}/{totalCount}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="flex-1 overflow-y-auto">
        {checklistItems.map((item) => {
          const status = getItemStatus(item.id)
          const completion = getCompletion(item.id)
          const hasNotes = !!completion?.notes
          const hasPhotos = (completion?.attachments?.length || 0) > 0

          return (
            <MobileITPItem
              key={item.id}
              item={item}
              status={status}
              hasNotes={hasNotes}
              hasPhotos={hasPhotos}
              photoCount={completion?.attachments?.length || 0}
              isUpdating={updatingItem === item.id}
              onTap={() => {
                trigger('light')
                setSelectedItem(item)
              }}
              onQuickComplete={() => {
                trigger('medium')
                onToggleCompletion(item.id, status !== 'completed', completion?.notes || null)
              }}
            />
          )
        })}
      </div>

      {/* Item Detail Sheet */}
      <MobileITPItemSheet
        isOpen={!!selectedItem}
        item={selectedItem}
        completion={selectedItem ? getCompletion(selectedItem.id) : undefined}
        onClose={() => setSelectedItem(null)}
        onPass={(notes) => {
          if (!selectedItem) return
          trigger('medium')
          onToggleCompletion(selectedItem.id, true, notes)
          setSelectedItem(null)
        }}
        onNA={(reason) => {
          if (!selectedItem) return
          trigger('medium')
          onMarkNotApplicable(selectedItem.id, reason)
          setSelectedItem(null)
        }}
        onFail={(reason) => {
          if (!selectedItem) return
          trigger('error')
          onMarkFailed(selectedItem.id, reason)
          setSelectedItem(null)
        }}
        onUpdateNotes={(notes) => {
          if (!selectedItem) return
          onUpdateNotes(selectedItem.id, notes)
        }}
        onAddPhoto={(file) => {
          if (!selectedItem) return
          onAddPhoto(selectedItem.id, file)
        }}
      />
    </div>
  )
}

// Individual checklist item row
interface MobileITPItemProps {
  item: ITPChecklistItem
  status: 'pending' | 'completed' | 'na' | 'failed'
  hasNotes: boolean
  hasPhotos: boolean
  photoCount: number
  isUpdating: boolean
  onTap: () => void
  onQuickComplete: () => void
}

function MobileITPItem({
  item,
  status,
  hasNotes,
  hasPhotos,
  photoCount,
  isUpdating,
  onTap,
  onQuickComplete,
}: MobileITPItemProps) {
  const statusColors = {
    pending: 'bg-muted border-muted-foreground/30 text-muted-foreground',
    completed: 'bg-green-500 border-green-500 text-white',
    na: 'bg-gray-400 border-gray-400 text-white',
    failed: 'bg-red-500 border-red-500 text-white',
  }

  const statusIcons = {
    pending: '',
    completed: '✓',
    na: '—',
    failed: '✗',
  }

  const pointTypeBadge = {
    standard: { label: 'S', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    witness: { label: 'W', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
    hold_point: { label: 'H', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  }

  const badge = pointTypeBadge[item.pointType]

  return (
    <div
      className={`flex items-center gap-3 p-4 border-b active:bg-muted/50 transition-colors touch-manipulation ${
        isUpdating ? 'opacity-50' : ''
      }`}
      onClick={onTap}
    >
      {/* Status indicator - quick tap to toggle complete */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (status === 'pending' || status === 'completed') {
            onQuickComplete()
          }
        }}
        disabled={isUpdating || status === 'na' || status === 'failed'}
        className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl font-bold transition-all touch-manipulation ${
          statusColors[status]
        } ${isUpdating ? 'animate-pulse' : ''}`}
      >
        {statusIcons[status]}
      </button>

      {/* Item content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          {/* Point type badge */}
          <span className={`flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded ${badge.color}`}>
            {badge.label}
          </span>
          {/* Item number and description */}
          <span className={`text-sm leading-tight ${status === 'completed' || status === 'na' ? 'line-through text-muted-foreground' : ''}`}>
            <span className="font-medium">{item.order}.</span> {item.description}
          </span>
        </div>
        {/* Indicators */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground ml-7">
          {item.evidenceRequired === 'photo' && !hasPhotos && (
            <span className="flex items-center gap-1 text-amber-600">
              <Camera className="w-3 h-3" />
              <span>Photo req</span>
            </span>
          )}
          {hasPhotos && (
            <span className="flex items-center gap-1 text-blue-600">
              <Image className="w-3 h-3" />
              <span>{photoCount}</span>
            </span>
          )}
          {hasNotes && (
            <span className="flex items-center gap-1 text-amber-600">
              <MessageSquare className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      {/* Chevron to indicate tappable */}
      <div className="flex-shrink-0 text-muted-foreground">
        <ChevronRight className="w-5 h-5" />
      </div>
    </div>
  )
}

// Bottom sheet for item details
interface MobileITPItemSheetProps {
  isOpen: boolean
  item: ITPChecklistItem | null
  completion?: ITPCompletion
  onClose: () => void
  onPass: (notes: string | null) => void
  onNA: (reason: string) => void
  onFail: (reason: string) => void
  onUpdateNotes: (notes: string) => void
  onAddPhoto: (file: File) => void
}

function MobileITPItemSheet({
  isOpen,
  item,
  completion,
  onClose,
  onPass,
  onNA,
  onFail,
  onUpdateNotes,
  onAddPhoto,
}: MobileITPItemSheetProps) {
  const [notes, setNotes] = useState('')
  const [naReason, setNaReason] = useState('')
  const [failReason, setFailReason] = useState('')
  const [showNAInput, setShowNAInput] = useState(false)
  const [showFailInput, setShowFailInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setNotes(completion?.notes || '')
      setNaReason('')
      setFailReason('')
      setShowNAInput(false)
      setShowFailInput(false)
    }
  }, [item, completion])

  if (!isOpen || !item) return null

  const isCompleted = completion?.isCompleted
  const isNA = completion?.isNotApplicable
  const isFailed = completion?.isFailed
  const photos = completion?.attachments || []

  const pointTypeLabel = {
    standard: 'Standard Point',
    witness: 'Witness Point',
    hold_point: 'Hold Point',
  }

  const responsiblePartyLabel = {
    contractor: 'Contractor',
    subcontractor: 'Subcontractor',
    superintendent: 'Superintendent',
    general: 'General',
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Item ${item.order}`}>
      <div className="space-y-4">
        {/* Item description */}
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              item.pointType === 'hold_point' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
              item.pointType === 'witness' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' :
              'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }`}>
              {pointTypeLabel[item.pointType]}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted">
              {responsiblePartyLabel[item.responsibleParty]}
            </span>
          </div>
          <p className="text-base font-medium">{item.description}</p>
          {item.acceptanceCriteria && (
            <p className="text-sm text-muted-foreground mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
              <span className="font-medium">Criteria:</span> {item.acceptanceCriteria}
            </p>
          )}
        </div>

        {/* Status buttons - large touch targets */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onPass(notes || null)}
            className={`py-4 rounded-lg font-bold text-center transition-all touch-manipulation min-h-[72px] ${
              isCompleted
                ? 'bg-green-500 text-white ring-2 ring-green-600 ring-offset-2'
                : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-200'
            }`}
          >
            <span className="text-2xl block mb-1">✓</span>
            <span className="text-sm">PASS</span>
          </button>
          <button
            onClick={() => {
              if (isNA) return
              if (!showNAInput) {
                setShowNAInput(true)
                setShowFailInput(false)
              }
            }}
            className={`py-4 rounded-lg font-bold text-center transition-all touch-manipulation min-h-[72px] ${
              isNA
                ? 'bg-gray-500 text-white ring-2 ring-gray-600 ring-offset-2'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200'
            }`}
          >
            <span className="text-2xl block mb-1">—</span>
            <span className="text-sm">N/A</span>
          </button>
          <button
            onClick={() => {
              if (isFailed) return
              if (!showFailInput) {
                setShowFailInput(true)
                setShowNAInput(false)
              }
            }}
            className={`py-4 rounded-lg font-bold text-center transition-all touch-manipulation min-h-[72px] ${
              isFailed
                ? 'bg-red-500 text-white ring-2 ring-red-600 ring-offset-2'
                : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200'
            }`}
          >
            <span className="text-2xl block mb-1">✗</span>
            <span className="text-sm">FAIL</span>
          </button>
        </div>

        {/* N/A reason input */}
        {showNAInput && (
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
            <label className="text-sm font-medium">Reason for N/A:</label>
            <textarea
              value={naReason}
              onChange={(e) => setNaReason(e.target.value)}
              placeholder="Why is this item not applicable?"
              className="w-full px-3 py-2 border rounded-lg text-sm min-h-[80px] bg-background"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNAInput(false)}
                className="flex-1 py-3 border rounded-lg text-sm font-medium touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={() => onNA(naReason)}
                className="flex-1 py-3 bg-gray-500 text-white rounded-lg text-sm font-medium touch-manipulation"
              >
                Mark as N/A
              </button>
            </div>
          </div>
        )}

        {/* Fail reason input */}
        {showFailInput && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg space-y-2">
            <label className="text-sm font-medium text-red-800 dark:text-red-200">Reason for failure:</label>
            <textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Describe the issue..."
              className="w-full px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg text-sm min-h-[80px] bg-background"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowFailInput(false)}
                className="flex-1 py-3 border rounded-lg text-sm font-medium touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={() => onFail(failReason)}
                className="flex-1 py-3 bg-red-500 text-white rounded-lg text-sm font-medium touch-manipulation"
              >
                Mark as Failed
              </button>
            </div>
          </div>
        )}

        {/* Notes section */}
        {!showNAInput && !showFailInput && (
          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (completion?.notes || '')) {
                  onUpdateNotes(notes)
                }
              }}
              placeholder="Add notes about this item..."
              className="w-full px-3 py-2 border rounded-lg text-sm min-h-[80px] bg-background"
            />
          </div>
        )}

        {/* Photos section */}
        {!showNAInput && !showFailInput && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Photos</label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-primary font-medium flex items-center gap-1 py-2 px-3 bg-primary/10 rounded-lg touch-manipulation"
              >
                <Camera className="w-4 h-4" />
                <span>Add Photo</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    onAddPhoto(file)
                    e.target.value = '' // Reset for next upload
                  }
                }}
              />
            </div>
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="aspect-square rounded-lg overflow-hidden border">
                    <img
                      src={photo.document.fileUrl}
                      alt={photo.document.caption || photo.document.filename}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-lg">
                No photos yet
              </p>
            )}
          </div>
        )}

        {/* Completion info */}
        {completion?.completedBy && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            {isCompleted ? 'Completed' : isNA ? 'Marked N/A' : isFailed ? 'Marked Failed' : 'Updated'} by{' '}
            {completion.completedBy.fullName || completion.completedBy.email}
            {completion.completedAt && ` on ${new Date(completion.completedAt).toLocaleDateString()}`}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
