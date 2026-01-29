# Mobile ITP Completion System Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a mobile-optimized ITP checklist completion interface for on-site foremen and subcontractors that prioritizes speed and simplicity.

**Architecture:** New mobile-specific component that follows the foreman mobile patterns (useIsMobile, BottomSheet, SwipeableCard) while maintaining the same API endpoints. Page owns business logic, component is pure presentation.

**Tech Stack:** React, TypeScript, existing foreman mobile primitives (BottomSheet, SwipeableCard, useHaptics, useOnlineStatus)

---

## Design Decisions

### 1. Remove Hold Point Blocking
Per user request: "there should be no blocking the user for working on any checklist item"
- Remove the `isLockedByHoldPoint` logic entirely on mobile
- Any item can be worked on in any order
- Hold points still exist visually (H badge) but don't block progress

### 2. Three-Button Status UI
Replace the checkbox toggle with three large, clearly labeled buttons per item:
- **✓ PASS** (Green) - Mark item as completed/passed
- **N/A** (Grey) - Mark item as not applicable
- **✗ FAIL** (Red) - Mark item as failed

These buttons should be:
- Large enough for gloved hands (min 44x44px touch targets)
- High contrast for outdoor visibility
- Instant tap (no modals for simple status changes)

### 3. Note + Photo via Bottom Sheet
Keep note/photo capabilities but move them to a bottom sheet:
- Tap on any checklist item row to open item detail sheet
- Sheet shows: item description, status buttons, notes input, photo gallery, add photo button
- Quick notes: Expandable text area
- Photos: Camera button + gallery of existing photos

### 4. Mobile-First Layout
Design for 375px viewport (iPhone SE):
- Full-width cards for each checklist item
- Status indicator on the left
- Item description in the middle
- Tap-to-expand for details
- Fixed bottom bar showing progress

---

## Component Architecture

```
LotDetailPage.tsx (existing - business logic owner)
├── Desktop: existing ITP checklist UI (unchanged)
└── Mobile: <MobileITPChecklist /> (new)
    ├── <MobileITPHeader /> - Lot name, template name, progress bar
    ├── <MobileITPItemList /> - Scrollable list of checklist items
    │   └── <MobileITPItem /> - Individual item row
    │       ├── Status indicator (✓/N/A/✗/○)
    │       ├── Point type badge (S/W/H)
    │       ├── Item description
    │       └── Photo/note indicators
    ├── <MobileITPItemSheet /> - Bottom sheet for item details
    │   ├── Status buttons (Pass/N/A/Fail)
    │   ├── Notes input
    │   ├── Photo gallery
    │   └── Add photo button
    └── <MobileITPProgressBar /> - Fixed bottom showing X/Y completed
```

---

## Implementation Tasks

### Task 1: Create MobileITPChecklist Component Shell

**Files:**
- Create: `frontend/src/components/foreman/MobileITPChecklist.tsx`

**Step 1: Create the basic component shell**

```typescript
// MobileITPChecklist.tsx - Pure presentation component for mobile ITP completion
import { useState } from 'react'
import { BottomSheet } from './sheets/BottomSheet'
import { useHaptics } from '@/hooks/useHaptics'

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

interface ITPCompletion {
  id: string
  checklistItemId: string
  isCompleted: boolean
  isNotApplicable?: boolean
  isFailed?: boolean
  notes: string | null
  completedAt: string | null
  completedBy: { id: string; fullName: string; email: string } | null
  attachments: Array<{
    id: string
    documentId: string
    document: {
      id: string
      filename: string
      fileUrl: string
      caption: string | null
    }
  }>
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
          trigger('success')
          onToggleCompletion(selectedItem.id, true, notes)
        }}
        onNA={(reason) => {
          if (!selectedItem) return
          trigger('medium')
          onMarkNotApplicable(selectedItem.id, reason)
        }}
        onFail={(reason) => {
          if (!selectedItem) return
          trigger('warning')
          onMarkFailed(selectedItem.id, reason)
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
```

**Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors (or note any that need fixing)

**Step 3: Commit**

```bash
git add frontend/src/components/foreman/MobileITPChecklist.tsx
git commit -m "feat: Add MobileITPChecklist component shell for mobile ITP completion"
```

---

### Task 2: Create MobileITPItem Component

**Files:**
- Modify: `frontend/src/components/foreman/MobileITPChecklist.tsx`

**Step 1: Add the MobileITPItem component**

```typescript
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
    pending: 'bg-muted border-muted-foreground/30',
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
    standard: { label: 'S', color: 'bg-blue-100 text-blue-800' },
    witness: { label: 'W', color: 'bg-amber-100 text-amber-800' },
    hold_point: { label: 'H', color: 'bg-red-100 text-red-800' },
  }

  const badge = pointTypeBadge[item.pointType]

  return (
    <div
      className={`flex items-center gap-3 p-4 border-b active:bg-muted/50 transition-colors ${
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
        className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg font-bold transition-all ${
          statusColors[status]
        } ${isUpdating ? 'animate-pulse' : ''}`}
      >
        {statusIcons[status]}
      </button>

      {/* Item content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {/* Point type badge */}
          <span className={`inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded ${badge.color}`}>
            {badge.label}
          </span>
          {/* Item number and description */}
          <span className={`text-sm font-medium ${status === 'completed' || status === 'na' ? 'line-through text-muted-foreground' : ''}`}>
            {item.order}. {item.description}
          </span>
        </div>
        {/* Indicators */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.evidenceRequired === 'photo' && (
            <span className="text-green-600">📷 Photo required</span>
          )}
          {hasPhotos && (
            <span className="text-blue-600">🖼 {photoCount} photo{photoCount !== 1 ? 's' : ''}</span>
          )}
          {hasNotes && (
            <span className="text-amber-600">📝 Has notes</span>
          )}
        </div>
      </div>

      {/* Chevron to indicate tappable */}
      <div className="flex-shrink-0 text-muted-foreground">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  )
}
```

**Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add frontend/src/components/foreman/MobileITPChecklist.tsx
git commit -m "feat: Add MobileITPItem component with status indicators"
```

---

### Task 3: Create MobileITPItemSheet Component

**Files:**
- Modify: `frontend/src/components/foreman/MobileITPChecklist.tsx`

**Step 1: Add the bottom sheet for item details**

```typescript
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

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Item ${item.order}`}>
      <div className="space-y-4">
        {/* Item description */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              item.pointType === 'hold_point' ? 'bg-red-100 text-red-800' :
              item.pointType === 'witness' ? 'bg-amber-100 text-amber-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {pointTypeLabel[item.pointType]}
            </span>
            {item.responsibleParty !== 'general' && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted">
                {item.responsibleParty}
              </span>
            )}
          </div>
          <p className="text-base font-medium">{item.description}</p>
          {item.acceptanceCriteria && (
            <p className="text-sm text-muted-foreground mt-2">
              <span className="font-medium">Criteria:</span> {item.acceptanceCriteria}
            </p>
          )}
        </div>

        {/* Status buttons - large touch targets */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              onPass(notes || null)
              onClose()
            }}
            className={`py-4 rounded-lg font-bold text-center transition-all touch-manipulation ${
              isCompleted
                ? 'bg-green-500 text-white ring-2 ring-green-600'
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
          >
            <span className="text-2xl block mb-1">✓</span>
            <span className="text-sm">PASS</span>
          </button>
          <button
            onClick={() => {
              if (isNA) {
                // Already N/A, do nothing or allow undo
                return
              }
              if (!showNAInput) {
                setShowNAInput(true)
                setShowFailInput(false)
              }
            }}
            className={`py-4 rounded-lg font-bold text-center transition-all touch-manipulation ${
              isNA
                ? 'bg-gray-500 text-white ring-2 ring-gray-600'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            <span className="text-2xl block mb-1">—</span>
            <span className="text-sm">N/A</span>
          </button>
          <button
            onClick={() => {
              if (isFailed) {
                // Already failed, do nothing or allow undo
                return
              }
              if (!showFailInput) {
                setShowFailInput(true)
                setShowNAInput(false)
              }
            }}
            className={`py-4 rounded-lg font-bold text-center transition-all touch-manipulation ${
              isFailed
                ? 'bg-red-500 text-white ring-2 ring-red-600'
                : 'bg-red-100 text-red-800 hover:bg-red-200'
            }`}
          >
            <span className="text-2xl block mb-1">✗</span>
            <span className="text-sm">FAIL</span>
          </button>
        </div>

        {/* N/A reason input */}
        {showNAInput && (
          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <label className="text-sm font-medium">Reason for N/A:</label>
            <textarea
              value={naReason}
              onChange={(e) => setNaReason(e.target.value)}
              placeholder="Why is this item not applicable?"
              className="w-full px-3 py-2 border rounded-lg text-sm min-h-[80px]"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNAInput(false)}
                className="flex-1 py-2 border rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onNA(naReason)
                  onClose()
                }}
                className="flex-1 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium"
              >
                Mark as N/A
              </button>
            </div>
          </div>
        )}

        {/* Fail reason input */}
        {showFailInput && (
          <div className="p-3 bg-red-50 rounded-lg space-y-2">
            <label className="text-sm font-medium text-red-800">Reason for failure:</label>
            <textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Describe the issue..."
              className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm min-h-[80px]"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowFailInput(false)}
                className="flex-1 py-2 border rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onFail(failReason)
                  onClose()
                }}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium"
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
              className="w-full px-3 py-2 border rounded-lg text-sm min-h-[80px]"
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
                className="text-sm text-primary font-medium flex items-center gap-1"
              >
                <span>📷</span> Add Photo
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
                  <div key={photo.id} className="aspect-square rounded-lg overflow-hidden">
                    <img
                      src={photo.document.fileUrl}
                      alt={photo.document.caption || photo.document.filename}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                No photos yet
              </p>
            )}
          </div>
        )}

        {/* Completion info */}
        {completion?.completedBy && (
          <p className="text-xs text-muted-foreground">
            {isCompleted ? 'Completed' : isNA ? 'Marked N/A' : isFailed ? 'Marked Failed' : 'Updated'} by{' '}
            {completion.completedBy.fullName || completion.completedBy.email}
            {completion.completedAt && ` on ${new Date(completion.completedAt).toLocaleDateString()}`}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
```

**Step 2: Add missing imports at the top of the file**

```typescript
import { useState, useRef, useEffect } from 'react'
```

**Step 3: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add frontend/src/components/foreman/MobileITPChecklist.tsx
git commit -m "feat: Add MobileITPItemSheet with status buttons, notes, and photos"
```

---

### Task 4: Integrate MobileITPChecklist into LotDetailPage

**Files:**
- Modify: `frontend/src/pages/lots/LotDetailPage.tsx`

**Step 1: Import the new component and useIsMobile hook**

Add at top of file:
```typescript
import { useIsMobile } from '@/hooks/useIsMobile'
import { MobileITPChecklist } from '@/components/foreman/MobileITPChecklist'
```

**Step 2: Add isMobile detection**

Add after other hooks:
```typescript
const isMobile = useIsMobile()
```

**Step 3: Create handler wrapper for mobile photo upload**

The existing `handleAddPhoto` expects a completion ID and event, but mobile needs a simpler API. Add this wrapper:

```typescript
const handleMobileAddPhoto = async (checklistItemId: string, file: File) => {
  // Similar to handleAddPhoto but takes a File directly instead of event
  // First ensure there's a completion for this item
  let completion = itpInstance?.completions.find(c => c.checklistItemId === checklistItemId)

  if (!completion?.id) {
    // Create completion first
    const response = await fetch(`${apiUrl}/api/itp/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lotId,
        checklistItemId,
        isCompleted: false,
        notes: '',
      }),
    })
    if (response.ok) {
      const data = await response.json()
      completion = data.completion
    }
  }

  if (!completion?.id) return

  // Upload photo
  const formData = new FormData()
  formData.append('file', file)
  formData.append('projectId', projectId!)
  formData.append('lotId', lotId!)

  const uploadResponse = await fetch(`${apiUrl}/api/itp/completions/${completion.id}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (uploadResponse.ok) {
    // Refresh ITP data
    fetchITPData()
    toast({
      title: 'Photo uploaded',
      description: 'Photo has been attached to the checklist item.',
    })
  }
}
```

**Step 4: Conditionally render mobile or desktop ITP UI**

In the ITP tab content section, wrap the existing desktop UI and add mobile alternative:

```typescript
{activeTab === 'itp' && (
  <>
    {itpInstance ? (
      isMobile ? (
        <MobileITPChecklist
          lotNumber={lot.lotNumber}
          templateName={itpInstance.template.name}
          checklistItems={itpInstance.template.checklistItems}
          completions={itpInstance.completions}
          onToggleCompletion={handleToggleCompletion}
          onMarkNotApplicable={(id, reason) => {
            setNaModal({ checklistItemId: id, itemDescription: '' })
            // Auto-submit with reason
            handleMarkNA(id, reason)
          }}
          onMarkFailed={(id, reason) => {
            setFailedModal({ checklistItemId: id, itemDescription: '' })
            // Auto-submit with reason
            handleMarkFailed(id, reason)
          }}
          onUpdateNotes={handleUpdateNotes}
          onAddPhoto={handleMobileAddPhoto}
          updatingItem={updatingCompletion}
        />
      ) : (
        // Existing desktop UI...
      )
    ) : (
      // Empty state...
    )}
  </>
)}
```

**Step 5: Run TypeScript check and test**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 6: Commit**

```bash
git add frontend/src/pages/lots/LotDetailPage.tsx
git commit -m "feat: Integrate MobileITPChecklist for mobile viewport"
```

---

### Task 5: Add useIsMobile hook (if not exists)

**Files:**
- Check: `frontend/src/hooks/useIsMobile.ts`
- Create if missing

**Step 1: Check if hook exists**

```bash
ls frontend/src/hooks/useIsMobile.ts
```

**Step 2: Create hook if missing**

```typescript
// frontend/src/hooks/useIsMobile.ts
import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }

    // Set initial value
    setIsMobile(mediaQuery.matches)

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [breakpoint])

  return isMobile
}
```

**Step 3: Commit if created**

```bash
git add frontend/src/hooks/useIsMobile.ts
git commit -m "feat: Add useIsMobile hook for responsive detection"
```

---

### Task 6: Add handleMarkNA and handleMarkFailed helper functions

**Files:**
- Modify: `frontend/src/pages/lots/LotDetailPage.tsx`

These helpers allow the mobile component to mark items as N/A or Failed without going through modals.

**Step 1: Add helper functions**

```typescript
// Direct handlers for mobile (without modal confirmation)
const handleMarkNA = async (checklistItemId: string, reason: string) => {
  if (!itpInstance || !token) return

  try {
    const response = await fetch(`${apiUrl}/api/itp/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lotId,
        checklistItemId,
        isCompleted: false,
        isNotApplicable: true,
        notes: reason,
      }),
    })

    if (response.ok) {
      fetchITPData()
      toast({
        title: 'Marked as N/A',
        description: 'The checklist item has been marked as not applicable.',
      })
    }
  } catch (err) {
    console.error('Failed to mark as N/A:', err)
  }
}

const handleMarkFailed = async (checklistItemId: string, reason: string) => {
  if (!itpInstance || !token) return

  try {
    const response = await fetch(`${apiUrl}/api/itp/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lotId,
        checklistItemId,
        isCompleted: false,
        isFailed: true,
        notes: reason,
        createNCR: true,
      }),
    })

    if (response.ok) {
      fetchITPData()
      toast({
        title: 'Marked as Failed',
        description: 'The checklist item has been marked as failed.',
        variant: 'destructive',
      })
    }
  } catch (err) {
    console.error('Failed to mark as failed:', err)
  }
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/lots/LotDetailPage.tsx
git commit -m "feat: Add direct N/A and Failed handlers for mobile ITP"
```

---

### Task 7: Test Mobile ITP Flow

**Files:**
- None (testing only)

**Step 1: Start development server**

```bash
cd frontend && pnpm dev
```

**Step 2: Test on mobile viewport**

1. Open browser DevTools
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select iPhone SE or similar (375x667)
4. Navigate to a lot with an ITP assigned
5. Verify mobile ITP UI appears
6. Test: Tap item to open sheet
7. Test: Tap PASS button - should mark complete
8. Test: Tap N/A button - should show reason input
9. Test: Add photo via camera button
10. Test: Notes save on blur

**Step 3: Verify desktop still works**

1. Toggle device toolbar off
2. Refresh page
3. Verify original desktop ITP UI appears
4. Verify all existing functionality works

---

## Summary

This implementation creates a mobile-optimized ITP completion interface with:

1. **Simple status buttons** - Large ✓/N/A/✗ buttons for quick status changes
2. **No blocking** - Any item can be worked on in any order
3. **Notes + photos retained** - Accessible via bottom sheet
4. **Mobile-first design** - Large touch targets, clear visual hierarchy
5. **Progress tracking** - Header shows percentage and count
6. **Haptic feedback** - Uses existing useHaptics hook

The implementation follows established patterns:
- `useIsMobile()` for viewport detection
- `BottomSheet` for item details
- Page owns business logic, component is presentation
- Same API endpoints, different UI
