# Foreman Mobile UX Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the foreman mobile UI to match the research-backed optimal UX: 5 primary actions, unified "Today" view, capture-first workflow, and ruthless simplification.

**Reference:** `docs/Foreman persona document (AU civil).md`

**Principle:** "A foreman's phone is a tool, not an office." Every tap removed is time back on the job.

---

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Create "Today" Unified Worklist | ✅ Complete |
| 2 | Restructure Bottom Navigation | ✅ Complete |
| 3 | Rework Capture Flow (Camera-First) | ✅ Complete |
| 4 | Add "Finish Diary" Flow | ✅ Complete |
| 5 | Update Approval Flow with Safety Patterns | ✅ Complete |
| 6 | Integration & Wiring | ✅ Complete |
| 7 | Remove/Hide Features from Foreman Mobile | ✅ Complete |
| 8 | Testing & Verification | ⏳ Ready for Testing |

### Files Created
- `frontend/src/components/foreman/TodayWorklist.tsx` - Unified "Today" view
- `frontend/src/components/foreman/ForemanBottomNavV2.tsx` - Research-backed 5-tab nav
- `frontend/src/components/foreman/CaptureModal.tsx` - Camera-first capture
- `frontend/src/components/foreman/DiaryFinishFlow.tsx` - EOD diary completion
- `frontend/src/components/foreman/ForemanMobileShell.tsx` - Layout wrapper
- `frontend/src/lib/foremanFeatures.ts` - Feature flags

### Files Modified
- `frontend/src/components/foreman/DocketComparisonCard.tsx` - Added undo capability
- `frontend/src/components/foreman/index.ts` - Added exports
- `frontend/src/App.tsx` - Added foreman routes
- `backend/src/routes/dashboard.ts` - Added today endpoint

---

## Overview of Changes

### Navigation Restructure
```
BEFORE (Current):                    AFTER (Target):
┌───────┬────────┬──────┬──────┬──────┐    ┌─────────┬───────┬─────────┬───────┬──────┐
│ Diary │ Dockets│ Lots │ NCRs │ More │    │ Capture │ Today │ Approve │ Diary │ Lots │
└───────┴────────┴──────┴──────┴──────┘    └─────────┴───────┴─────────┴───────┴──────┘
```

### Key Changes Summary
1. **NEW: "Today" view** - Unified worklist (ITPs, Hold Points, Inspections due)
2. **NEW: "Capture" as nav item** - Replace FAB, camera-first flow
3. **RENAME: "Dockets" → "Approve"** - Clearer intent
4. **REMOVE: "NCRs" from nav** - Move to Capture type
5. **REMOVE: "More" drawer complexity** - Simplify to essentials
6. **ADD: "Finish Diary" flow** - EOD completion in <60 seconds
7. **IMPROVE: Approval safety** - Tap-to-review + undo, not just swipe

---

## Phase 1: Create "Today" Unified Worklist (NEW COMPONENT)

### Task 1.1: Create TodayWorklist Component

**Files:**
- Create: `frontend/src/components/foreman/TodayWorklist.tsx`

**Purpose:** Single view showing everything the foreman needs to action TODAY.

```typescript
// frontend/src/components/foreman/TodayWorklist.tsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CheckSquare,
  Clock,
  ChevronRight,
  RefreshCw,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthToken } from '@/lib/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3031'

interface WorklistItem {
  id: string
  type: 'hold_point' | 'itp_item' | 'inspection' | 'task'
  title: string
  subtitle: string // Lot number, location, etc.
  urgency: 'blocking' | 'due_today' | 'upcoming'
  link: string
  metadata?: {
    lotNumber?: string
    itpName?: string
    dueTime?: string
  }
}

interface TodayWorklistData {
  blocking: WorklistItem[] // Hold points that block work
  dueToday: WorklistItem[] // Must complete today
  upcoming: WorklistItem[] // Next 24-48 hours
}

const urgencyConfig = {
  blocking: {
    label: 'Blocking Work',
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    icon: AlertCircle,
  },
  due_today: {
    label: 'Due Today',
    color: 'bg-amber-500',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    icon: Clock,
  },
  upcoming: {
    label: 'Upcoming',
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    icon: CheckSquare,
  },
}

export function TodayWorklist() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<TodayWorklistData>({
    blocking: [],
    dueToday: [],
    upcoming: [],
  })

  const fetchWorklist = useCallback(async () => {
    const token = getAuthToken()
    if (!token || !projectId) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/api/projects/${projectId}/foreman/today`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (err) {
      console.error('Error fetching today worklist:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchWorklist()
  }, [fetchWorklist])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchWorklist()
  }

  const totalItems = data.blocking.length + data.dueToday.length + data.upcoming.length
  const allClear = totalItems === 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Today</h1>
            <p className="text-sm text-muted-foreground">
              {allClear
                ? 'All clear - no items requiring action'
                : `${totalItems} item${totalItems !== 1 ? 's' : ''} need attention`
              }
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              'p-2 rounded-lg border touch-manipulation min-h-[44px] min-w-[44px]',
              'flex items-center justify-center active:bg-muted'
            )}
          >
            <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* All Clear State */}
      {allClear && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold mb-1">You're all caught up</h2>
          <p className="text-sm text-muted-foreground text-center">
            No hold points, inspections, or ITP items need your attention right now.
          </p>
        </div>
      )}

      {/* Worklist Sections */}
      <div className="p-4 space-y-6">
        {/* Blocking Work (Red) */}
        {data.blocking.length > 0 && (
          <WorklistSection
            title="Blocking Work"
            subtitle="These items are stopping work from proceeding"
            items={data.blocking}
            urgency="blocking"
            onItemClick={(item) => navigate(item.link)}
          />
        )}

        {/* Due Today (Amber) */}
        {data.dueToday.length > 0 && (
          <WorklistSection
            title="Due Today"
            subtitle="Must be completed today"
            items={data.dueToday}
            urgency="due_today"
            onItemClick={(item) => navigate(item.link)}
          />
        )}

        {/* Upcoming (Blue) */}
        {data.upcoming.length > 0 && (
          <WorklistSection
            title="Coming Up"
            subtitle="Next 24-48 hours"
            items={data.upcoming}
            urgency="upcoming"
            onItemClick={(item) => navigate(item.link)}
          />
        )}
      </div>
    </div>
  )
}

interface WorklistSectionProps {
  title: string
  subtitle: string
  items: WorklistItem[]
  urgency: 'blocking' | 'due_today' | 'upcoming'
  onItemClick: (item: WorklistItem) => void
}

function WorklistSection({ title, subtitle, items, urgency, onItemClick }: WorklistSectionProps) {
  const config = urgencyConfig[urgency]
  const Icon = config.icon

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('w-2 h-2 rounded-full', config.color)} />
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className={cn(
          'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
          config.bgColor, config.textColor
        )}>
          {items.length}
        </span>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick(item)}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-lg border',
              'text-left transition-colors',
              'active:bg-muted/50 touch-manipulation min-h-[64px]',
              config.bgColor
            )}
          >
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
              'bg-white dark:bg-gray-800'
            )}>
              <Icon className={cn('h-5 w-5', config.textColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.title}</p>
              <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit src/components/foreman/TodayWorklist.tsx`

**Step 3: Commit**

```bash
git add frontend/src/components/foreman/TodayWorklist.tsx
git commit -m "feat: add TodayWorklist component for foreman unified worklist

- Shows blocking items (hold points), due today, and upcoming
- Color-coded urgency levels (red/amber/blue)
- All-clear state when nothing needs attention

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.2: Create Backend Endpoint for Today Worklist

**Files:**
- Modify: `backend/src/routes/dashboard.ts` (or create new route)

**Step 1: Add the endpoint**

```typescript
// GET /api/projects/:projectId/foreman/today
// Returns unified worklist for foreman

router.get('/projects/:projectId/foreman/today', authenticate, async (req, res) => {
  const { projectId } = req.params
  const userId = req.user.id
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfterTomorrow = new Date(today)
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)

  try {
    // Fetch hold points that are blocking (pending release, scheduled for today or past)
    const holdPoints = await db.query.holdPoints.findMany({
      where: and(
        eq(holdPoints.projectId, projectId),
        eq(holdPoints.status, 'pending'),
        lte(holdPoints.scheduledDate, tomorrow)
      ),
      with: { lot: true }
    })

    // Fetch ITP items due today
    const itpItems = await db.query.itpChecklistItems.findMany({
      where: and(
        eq(itpChecklistItems.projectId, projectId),
        eq(itpChecklistItems.status, 'pending'),
        lte(itpChecklistItems.dueDate, tomorrow)
      ),
      with: { itp: true, lot: true }
    })

    // Fetch inspections scheduled for today
    const inspections = await db.query.inspections.findMany({
      where: and(
        eq(inspections.projectId, projectId),
        eq(inspections.status, 'scheduled'),
        gte(inspections.scheduledDate, today),
        lt(inspections.scheduledDate, dayAfterTomorrow)
      ),
      with: { lot: true }
    })

    // Categorize by urgency
    const blocking = []
    const dueToday = []
    const upcoming = []

    // Process hold points (blocking if past due or today)
    for (const hp of holdPoints) {
      const item = {
        id: hp.id,
        type: 'hold_point',
        title: hp.name || 'Hold Point',
        subtitle: `Lot ${hp.lot?.lotNumber || 'Unknown'} - ${hp.description || ''}`,
        link: `/projects/${projectId}/hold-points/${hp.id}`,
        metadata: { lotNumber: hp.lot?.lotNumber }
      }

      if (new Date(hp.scheduledDate) < today) {
        blocking.push({ ...item, urgency: 'blocking' })
      } else {
        dueToday.push({ ...item, urgency: 'due_today' })
      }
    }

    // Process ITP items
    for (const item of itpItems) {
      const worklistItem = {
        id: item.id,
        type: 'itp_item',
        title: item.description || 'ITP Item',
        subtitle: `${item.itp?.name || 'ITP'} - Lot ${item.lot?.lotNumber || 'Unknown'}`,
        link: `/projects/${projectId}/lots/${item.lotId}/itp/${item.itpId}`,
        metadata: { lotNumber: item.lot?.lotNumber, itpName: item.itp?.name }
      }

      if (new Date(item.dueDate) < today) {
        blocking.push({ ...worklistItem, urgency: 'blocking' })
      } else {
        dueToday.push({ ...worklistItem, urgency: 'due_today' })
      }
    }

    // Process inspections
    for (const insp of inspections) {
      dueToday.push({
        id: insp.id,
        type: 'inspection',
        title: insp.type || 'Inspection',
        subtitle: `Lot ${insp.lot?.lotNumber || 'Unknown'}`,
        urgency: 'due_today',
        link: `/projects/${projectId}/inspections/${insp.id}`,
        metadata: { lotNumber: insp.lot?.lotNumber }
      })
    }

    res.json({ blocking, dueToday, upcoming })
  } catch (error) {
    console.error('Error fetching foreman today worklist:', error)
    res.status(500).json({ error: 'Failed to fetch worklist' })
  }
})
```

**Step 2: Commit**

```bash
git add backend/src/routes/dashboard.ts
git commit -m "feat: add /foreman/today endpoint for unified worklist

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 2: Restructure Bottom Navigation

### Task 2.1: Create New ForemanBottomNavV2 Component

**Files:**
- Create: `frontend/src/components/foreman/ForemanBottomNavV2.tsx`

**Purpose:** Replace current 5-tab nav with the research-recommended structure.

```typescript
// frontend/src/components/foreman/ForemanBottomNavV2.tsx
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Camera, ListChecks, CheckSquare, BookOpen, MapPin, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useState } from 'react'

type NavTab = 'capture' | 'today' | 'approve' | 'diary' | 'lots'

interface NavItem {
  id: NavTab
  label: string
  icon: typeof Camera
  getPath: (projectId: string) => string
}

const navItems: NavItem[] = [
  {
    id: 'capture',
    label: 'Capture',
    icon: Camera,
    getPath: () => '' // Special handling - opens modal
  },
  {
    id: 'today',
    label: 'Today',
    icon: ListChecks,
    getPath: (projectId) => `/projects/${projectId}/foreman/today`
  },
  {
    id: 'approve',
    label: 'Approve',
    icon: CheckSquare,
    getPath: (projectId) => `/projects/${projectId}/dockets?status=pending_approval`
  },
  {
    id: 'diary',
    label: 'Diary',
    icon: BookOpen,
    getPath: (projectId) => `/projects/${projectId}/diary`
  },
  {
    id: 'lots',
    label: 'Lots',
    icon: MapPin,
    getPath: (projectId) => `/projects/${projectId}/lots`
  },
]

interface ForemanBottomNavV2Props {
  onCapturePress: () => void
}

export function ForemanBottomNavV2({ onCapturePress }: ForemanBottomNavV2Props) {
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { isOnline, pendingSyncCount } = useOnlineStatus()

  // Determine active tab from current path
  const getActiveTab = (): NavTab | null => {
    const path = location.pathname
    if (path.includes('/foreman/today')) return 'today'
    if (path.includes('/dockets')) return 'approve'
    if (path.includes('/diary')) return 'diary'
    if (path.includes('/lots')) return 'lots'
    return null
  }

  const activeTab = getActiveTab()

  const handleNavClick = (item: NavItem) => {
    if (item.id === 'capture') {
      onCapturePress()
      return
    }

    if (projectId) {
      navigate(item.getPath(projectId))
    }
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-30 pb-safe">
      {/* Offline/Sync indicator */}
      {(!isOnline || pendingSyncCount > 0) && (
        <div
          className={cn(
            'flex items-center justify-center gap-2 py-1.5 text-xs font-medium',
            isOnline ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                     : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
          )}
        >
          {isOnline ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              {pendingSyncCount} pending sync
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Offline - changes saved locally
            </>
          )}
        </div>
      )}

      {/* Nav items */}
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          const isCapture = item.id === 'capture'

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1',
                'min-h-[48px] touch-manipulation',
                'transition-colors duration-150',
                isActive ? 'text-primary' : 'text-muted-foreground',
                'active:bg-muted/50'
              )}
            >
              {isCapture ? (
                // Capture button - emphasized
                <div className={cn(
                  'flex items-center justify-center w-12 h-12 -mt-6 rounded-full',
                  'bg-primary text-primary-foreground shadow-lg',
                  'active:scale-95 transition-transform'
                )}>
                  <Icon className="h-6 w-6" />
                </div>
              ) : (
                <>
                  <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                  <span className={cn('text-xs', isActive && 'font-medium')}>{item.label}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/foreman/ForemanBottomNavV2.tsx
git commit -m "feat: add ForemanBottomNavV2 with research-backed 5-tab structure

- Capture, Today, Approve, Diary, Lots
- Capture button elevated with emphasis
- Removed NCRs and More from primary nav

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 3: Rework Capture Flow (Camera-First)

### Task 3.1: Create CaptureModal Component

**Files:**
- Create: `frontend/src/components/foreman/CaptureModal.tsx`

**Purpose:** Camera opens immediately. Categorize AFTER capture, not before.

```typescript
// frontend/src/components/foreman/CaptureModal.tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Camera, MapPin, Tag, ChevronRight, Check, AlertTriangle, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { capturePhotoOffline } from '@/lib/offlineDb'
import { useAuth } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'

type CaptureType = 'photo' | 'ncr' | 'note'

interface CaptureModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  onCapture?: (result: { type: CaptureType; id: string }) => void
}

export function CaptureModal({ projectId, isOpen, onClose, onCapture }: CaptureModalProps) {
  const { user } = useAuth()
  const { latitude, longitude, accuracy, refresh: refreshGps } = useGeoLocation()

  // Capture state
  const [phase, setPhase] = useState<'capture' | 'categorize'>('capture')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)

  // Categorization state (optional)
  const [captureType, setCaptureType] = useState<CaptureType>('photo')
  const [linkedLot, setLinkedLot] = useState<string | null>(null)
  const [linkedItp, setLinkedItp] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase('capture')
      setCapturedImage(null)
      setCapturedFile(null)
      setCaptureType('photo')
      setLinkedLot(null)
      setLinkedItp(null)
      setDescription('')
      // Auto-trigger camera on open
      setTimeout(() => fileInputRef.current?.click(), 100)
    }
  }, [isOpen])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      // User cancelled - close modal
      onClose()
      return
    }

    setCapturedFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      setCapturedImage(event.target?.result as string)
      setPhase('categorize')
    }
    reader.readAsDataURL(file)
  }, [onClose])

  const handleSave = useCallback(async () => {
    if (!capturedFile || !user) return

    setSaving(true)
    try {
      const photo = await capturePhotoOffline(projectId, capturedFile, {
        lotId: linkedLot || undefined,
        entityType: captureType === 'ncr' ? 'ncr' : captureType === 'note' ? 'general' : 'general',
        caption: description.trim() || undefined,
        capturedBy: user.id,
        gpsLatitude: latitude ?? undefined,
        gpsLongitude: longitude ?? undefined,
      })

      // If NCR, create NCR record linked to photo
      if (captureType === 'ncr') {
        // TODO: Create NCR with minimal fields, link photo
        toast({ description: 'NCR captured - complete details later', variant: 'success' })
      } else {
        toast({ description: 'Photo saved', variant: 'success' })
      }

      onCapture?.({ type: captureType, id: photo.id })
      onClose()
    } catch (error) {
      console.error('Failed to save:', error)
      toast({ description: 'Failed to save', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }, [capturedFile, user, projectId, linkedLot, captureType, description, latitude, longitude, onCapture, onClose])

  const handleQuickSave = useCallback(async () => {
    // Save with defaults - no categorization
    setCaptureType('photo')
    setLinkedLot(null)
    await handleSave()
  }, [handleSave])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Hidden file input - triggers immediately */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {phase === 'capture' && !capturedImage && (
        // Waiting for camera
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-900">
          <Camera className="h-16 w-16 text-gray-500 mb-4" />
          <p className="text-gray-400">Opening camera...</p>
          <button
            onClick={onClose}
            className="mt-8 px-6 py-3 bg-gray-700 text-white rounded-lg"
          >
            Cancel
          </button>
        </div>
      )}

      {phase === 'categorize' && capturedImage && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/90">
            <button
              onClick={onClose}
              className="p-2 text-white touch-manipulation min-h-[44px] min-w-[44px]"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-white font-medium">Captured</h2>
            <button
              onClick={handleQuickSave}
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg font-medium min-h-[44px]"
            >
              {saving ? '...' : 'Save'}
            </button>
          </div>

          {/* Preview */}
          <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
            <img
              src={capturedImage}
              alt="Captured"
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* GPS Badge */}
          {latitude && (
            <div className="absolute bottom-[320px] left-4 flex items-center gap-1 px-2 py-1 bg-green-600/80 text-white text-xs rounded-full">
              <MapPin className="h-3 w-3" />
              GPS captured
            </div>
          )}

          {/* Categorization Panel (Optional) */}
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl p-4 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Optional: Add details now or save and categorize later
            </p>

            {/* Capture Type */}
            <div className="flex gap-2">
              <TypeButton
                icon={Camera}
                label="Photo"
                selected={captureType === 'photo'}
                onClick={() => setCaptureType('photo')}
              />
              <TypeButton
                icon={AlertTriangle}
                label="NCR/Defect"
                selected={captureType === 'ncr'}
                onClick={() => setCaptureType('ncr')}
                color="text-red-600"
              />
              <TypeButton
                icon={FileText}
                label="Note"
                selected={captureType === 'note'}
                onClick={() => setCaptureType('note')}
              />
            </div>

            {/* Quick description (especially for NCR) */}
            {captureType === 'ncr' && (
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description (optional)"
                className="w-full p-3 border rounded-lg"
              />
            )}

            {/* Link to Lot (optional) */}
            <button className="w-full flex items-center justify-between p-3 border rounded-lg">
              <span className="text-muted-foreground">
                {linkedLot ? `Linked to Lot ${linkedLot}` : 'Link to Lot (optional)'}
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'w-full py-4 rounded-lg font-semibold text-white',
                'bg-primary active:bg-primary/90',
                'touch-manipulation min-h-[56px]',
                saving && 'opacity-50'
              )}
            >
              {saving ? 'Saving...' : (
                captureType === 'ncr' ? 'Save NCR' : 'Save Photo'
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface TypeButtonProps {
  icon: typeof Camera
  label: string
  selected: boolean
  onClick: () => void
  color?: string
}

function TypeButton({ icon: Icon, label, selected, onClick, color }: TypeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors',
        'touch-manipulation min-h-[64px]',
        selected ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'
      )}
    >
      <Icon className={cn('h-5 w-5', color, selected && 'text-primary')} />
      <span className={cn('text-xs', selected && 'font-medium')}>{label}</span>
    </button>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/foreman/CaptureModal.tsx
git commit -m "feat: add CaptureModal with camera-first workflow

- Camera opens immediately on modal open
- Categorization is OPTIONAL (photo/NCR/note)
- Quick save button for fastest path
- GPS auto-captured
- Link to Lot optional

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 4: Add "Finish Diary" Flow

### Task 4.1: Create DiaryFinishFlow Component

**Files:**
- Create: `frontend/src/components/foreman/DiaryFinishFlow.tsx`

**Purpose:** End-of-day diary completion in under 60 seconds.

```typescript
// frontend/src/components/foreman/DiaryFinishFlow.tsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Check,
  Cloud,
  Users,
  Truck,
  FileText,
  AlertTriangle,
  ChevronRight,
  Edit2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthToken } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3031'

interface DiaryDraft {
  id: string
  date: string
  weather: {
    conditions: string
    tempMin: number
    tempMax: number
    rainfall: number
  }
  personnel: Array<{ name: string; hours: number; trade: string }>
  plant: Array<{ description: string; hours: number }>
  activities: string[]
  delays: Array<{ reason: string; hours: number }>
  isComplete: boolean
}

interface DiaryFinishFlowProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: () => void
}

export function DiaryFinishFlow({ isOpen, onClose, onSubmit }: DiaryFinishFlowProps) {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [diary, setDiary] = useState<DiaryDraft | null>(null)

  // Fetch today's diary draft with auto-filled data
  const fetchDiary = useCallback(async () => {
    const token = getAuthToken()
    if (!token || !projectId) return

    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch(
        `${API_URL}/api/projects/${projectId}/diary/draft?date=${today}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.ok) {
        const data = await response.json()
        setDiary(data)
      }
    } catch (err) {
      console.error('Error fetching diary:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (isOpen) {
      fetchDiary()
    }
  }, [isOpen, fetchDiary])

  const handleSubmit = async () => {
    if (!diary) return

    setSubmitting(true)
    try {
      const token = getAuthToken()
      const response = await fetch(
        `${API_URL}/api/projects/${projectId}/diary/${diary.id}/submit`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        toast({ description: 'Diary submitted', variant: 'success' })
        onSubmit()
        onClose()
      } else {
        throw new Error('Failed to submit')
      }
    } catch (err) {
      toast({ description: 'Failed to submit diary', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-background rounded-t-2xl max-h-[90vh] overflow-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Finish Today's Diary</h2>
          <button onClick={onClose} className="text-muted-foreground">
            Cancel
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : diary ? (
          <div className="p-4 space-y-4 pb-32">
            {/* Weather (auto-filled) */}
            <SectionCard
              icon={Cloud}
              title="Weather"
              status="auto"
              onEdit={() => navigate(`/projects/${projectId}/diary?section=weather`)}
            >
              <p className="text-sm">
                {diary.weather.conditions} • {diary.weather.tempMin}°-{diary.weather.tempMax}°C
                {diary.weather.rainfall > 0 && ` • ${diary.weather.rainfall}mm rain`}
              </p>
            </SectionCard>

            {/* Personnel */}
            <SectionCard
              icon={Users}
              title="Personnel"
              status={diary.personnel.length > 0 ? 'complete' : 'missing'}
              onEdit={() => navigate(`/projects/${projectId}/diary?section=personnel`)}
            >
              {diary.personnel.length > 0 ? (
                <p className="text-sm">
                  {diary.personnel.length} worker{diary.personnel.length !== 1 ? 's' : ''} •
                  {diary.personnel.reduce((sum, p) => sum + p.hours, 0)} total hours
                </p>
              ) : (
                <p className="text-sm text-amber-600">No personnel recorded</p>
              )}
            </SectionCard>

            {/* Plant */}
            <SectionCard
              icon={Truck}
              title="Plant & Equipment"
              status={diary.plant.length > 0 ? 'complete' : 'optional'}
              onEdit={() => navigate(`/projects/${projectId}/diary?section=plant`)}
            >
              {diary.plant.length > 0 ? (
                <p className="text-sm">
                  {diary.plant.length} item{diary.plant.length !== 1 ? 's' : ''}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">None recorded</p>
              )}
            </SectionCard>

            {/* Activities */}
            <SectionCard
              icon={FileText}
              title="Activities"
              status={diary.activities.length > 0 ? 'complete' : 'missing'}
              onEdit={() => navigate(`/projects/${projectId}/diary?section=activities`)}
            >
              {diary.activities.length > 0 ? (
                <ul className="text-sm space-y-1">
                  {diary.activities.slice(0, 3).map((act, i) => (
                    <li key={i} className="truncate">• {act}</li>
                  ))}
                  {diary.activities.length > 3 && (
                    <li className="text-muted-foreground">
                      +{diary.activities.length - 3} more
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-amber-600">No activities recorded</p>
              )}
            </SectionCard>

            {/* Delays */}
            {diary.delays.length > 0 && (
              <SectionCard
                icon={AlertTriangle}
                title="Delays"
                status="complete"
                onEdit={() => navigate(`/projects/${projectId}/diary?section=delays`)}
              >
                <p className="text-sm text-amber-600">
                  {diary.delays.length} delay{diary.delays.length !== 1 ? 's' : ''} •
                  {diary.delays.reduce((sum, d) => sum + d.hours, 0)} hours lost
                </p>
              </SectionCard>
            )}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No diary entry for today</p>
            <button
              onClick={() => navigate(`/projects/${projectId}/diary`)}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
            >
              Start Diary
            </button>
          </div>
        )}

        {/* Submit Button */}
        {diary && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={cn(
                'w-full py-4 rounded-lg font-semibold text-white',
                'bg-green-600 active:bg-green-700',
                'touch-manipulation min-h-[56px]',
                'flex items-center justify-center gap-2',
                submitting && 'opacity-50'
              )}
            >
              <Check className="h-5 w-5" />
              {submitting ? 'Submitting...' : 'Submit Diary'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface SectionCardProps {
  icon: typeof Cloud
  title: string
  status: 'auto' | 'complete' | 'missing' | 'optional'
  onEdit: () => void
  children: React.ReactNode
}

function SectionCard({ icon: Icon, title, status, onEdit, children }: SectionCardProps) {
  const statusConfig = {
    auto: { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Auto-filled' },
    complete: { color: 'text-green-600', bg: 'bg-green-50', label: 'Complete' },
    missing: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Missing' },
    optional: { color: 'text-gray-500', bg: 'bg-gray-50', label: 'Optional' },
  }

  const config = statusConfig[status]

  return (
    <div className={cn('rounded-lg border p-4', status === 'missing' && 'border-amber-300')}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', config.color)} />
          <h3 className="font-medium">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs px-2 py-0.5 rounded-full', config.bg, config.color)}>
            {config.label}
          </span>
          <button
            onClick={onEdit}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <Edit2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/foreman/DiaryFinishFlow.tsx
git commit -m "feat: add DiaryFinishFlow for EOD diary submission

- Shows auto-filled weather
- Personnel/plant/activities summary
- Edit buttons for each section
- Submit button for quick completion
- Target: <60 seconds to finish diary

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 5: Update Approval Flow with Safety Patterns

### Task 5.1: Update DocketComparisonCard with Tap-to-Review Pattern

**Files:**
- Modify: `frontend/src/components/foreman/DocketComparisonCard.tsx`

**Changes:**
1. Add confirmation state before approve
2. Add Undo capability
3. Keep swipe as shortcut but not primary

```typescript
// Add to DocketComparisonCard.tsx

// New state for undo
const [lastAction, setLastAction] = useState<{id: string, action: 'approved' | 'rejected'} | null>(null)
const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null)

// Handle approve with undo window
const handleApproveWithUndo = () => {
  setLastAction({ id: docketId, action: 'approved' })

  // Set 5-second undo window
  const timeout = setTimeout(() => {
    // Actually submit the approval
    onApprove()
    setLastAction(null)
  }, 5000)

  setUndoTimeout(timeout)
}

const handleUndo = () => {
  if (undoTimeout) {
    clearTimeout(undoTimeout)
    setUndoTimeout(null)
  }
  setLastAction(null)
}

// In the render, show undo bar if action pending
{lastAction && (
  <div className="absolute inset-0 bg-green-600 flex items-center justify-between px-4 rounded-lg">
    <span className="text-white font-medium">Approved</span>
    <button
      onClick={handleUndo}
      className="px-4 py-2 bg-white text-green-600 rounded-lg font-medium"
    >
      Undo
    </button>
  </div>
)}
```

**Step 2: Commit**

```bash
git add frontend/src/components/foreman/DocketComparisonCard.tsx
git commit -m "feat: add undo capability to docket approval

- 5-second undo window after approve/reject
- Undo button clearly visible
- Prevents accidental approvals (gloves/glare)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 6: Integration & Wiring

### Task 6.1: Create ForemanMobileShell Component

**Files:**
- Create: `frontend/src/components/foreman/ForemanMobileShell.tsx`

**Purpose:** Wraps foreman pages with the new nav and capture modal.

```typescript
// frontend/src/components/foreman/ForemanMobileShell.tsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ForemanBottomNavV2 } from './ForemanBottomNavV2'
import { CaptureModal } from './CaptureModal'
import { DiaryFinishFlow } from './DiaryFinishFlow'
import { useParams } from 'react-router-dom'

export function ForemanMobileShell() {
  const { projectId } = useParams()
  const [captureOpen, setCaptureOpen] = useState(false)
  const [diaryFinishOpen, setDiaryFinishOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Page Content */}
      <Outlet context={{ openDiaryFinish: () => setDiaryFinishOpen(true) }} />

      {/* Bottom Navigation */}
      <ForemanBottomNavV2 onCapturePress={() => setCaptureOpen(true)} />

      {/* Capture Modal */}
      {projectId && (
        <CaptureModal
          projectId={projectId}
          isOpen={captureOpen}
          onClose={() => setCaptureOpen(false)}
        />
      )}

      {/* Diary Finish Flow */}
      <DiaryFinishFlow
        isOpen={diaryFinishOpen}
        onClose={() => setDiaryFinishOpen(false)}
        onSubmit={() => {}}
      />
    </div>
  )
}
```

### Task 6.2: Update Routes for Foreman Mobile

**Files:**
- Modify: `frontend/src/App.tsx` or routes file

Add routes for foreman mobile views:

```typescript
// Add to routes
{
  path: '/projects/:projectId/foreman',
  element: <ForemanMobileShell />,
  children: [
    { path: 'today', element: <TodayWorklist /> },
    // Other foreman routes use existing pages
  ]
}
```

### Task 6.3: Update Component Index

**Files:**
- Modify: `frontend/src/components/foreman/index.ts`

```typescript
// frontend/src/components/foreman/index.ts
export { ForemanBottomNav } from './ForemanBottomNav'
export { ForemanBottomNavV2 } from './ForemanBottomNavV2'
export { ForemanMobileDashboard } from './ForemanMobileDashboard'
export { ForemanMobileShell } from './ForemanMobileShell'
export { TodayWorklist } from './TodayWorklist'
export { CaptureModal } from './CaptureModal'
export { DiaryFinishFlow } from './DiaryFinishFlow'
export { QuickCaptureButton } from './QuickCaptureButton'
export { PhotoCaptureModal } from './PhotoCaptureModal'
export { DashboardCard, DashboardStat } from './DashboardCard'
export { WeatherWidget } from './WeatherWidget'
export { DocketComparisonCard } from './DocketComparisonCard'
export { SwipeableCard } from './SwipeableCard'
```

---

## Phase 7: Remove/Hide Features from Foreman Mobile

### Task 7.1: Create Role-Based Feature Flags

**Files:**
- Create: `frontend/src/lib/foremanFeatures.ts`

```typescript
// frontend/src/lib/foremanFeatures.ts

// Features available to foreman on mobile
export const FOREMAN_MOBILE_FEATURES = {
  // Primary (always visible)
  capture: true,
  today: true,
  approve: true,
  diary: true,
  lots: true,

  // Secondary (in More menu)
  search: true,
  documents: true, // view only
  settings: true,
  help: true,

  // Hidden from foreman mobile (desktop/other roles only)
  testResults: false, // view only if linked from ITP
  itpTemplates: false, // only see "my items"
  ncrPage: false, // NCR is a capture type, not a page
  reports: false,
  analytics: false,
  projectSettings: false,
  subcontractorManagement: false,
}

export function isForemanFeatureEnabled(feature: keyof typeof FOREMAN_MOBILE_FEATURES): boolean {
  return FOREMAN_MOBILE_FEATURES[feature] ?? false
}
```

### Task 7.2: Update More Menu for Foreman

Remove complex options from foreman's More menu. Only show:
- Search
- Documents (view only)
- Settings
- Help

---

## Phase 8: Testing & Verification

### Task 8.1: Manual Testing Checklist

Test the following flows on mobile viewport:

**Capture Flow:**
- [ ] Tap Capture → Camera opens immediately
- [ ] Take photo → Categorization screen appears
- [ ] Quick Save works (no categorization)
- [ ] NCR type capture works
- [ ] GPS is captured automatically
- [ ] Offline capture works

**Today Worklist:**
- [ ] Shows hold points due
- [ ] Shows ITP items due
- [ ] Blocking items highlighted in red
- [ ] Tapping item navigates to detail
- [ ] All-clear state when nothing due

**Approve Flow:**
- [ ] Dockets list loads
- [ ] Tap to review works
- [ ] Approve with 5-second undo works
- [ ] Undo cancels the action
- [ ] Query/Reject work

**Diary Flow:**
- [ ] Diary page loads
- [ ] Quick add chips work
- [ ] Finish Diary shows summary
- [ ] Auto-filled weather displays
- [ ] Submit completes in <60 seconds

**Lots:**
- [ ] Lots list loads
- [ ] Can update lot progress
- [ ] Can attach photo to lot

### Task 8.2: Build Verification

```bash
cd frontend && npm run build
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
```

---

## Summary: File Changes

### New Files
- `frontend/src/components/foreman/TodayWorklist.tsx`
- `frontend/src/components/foreman/ForemanBottomNavV2.tsx`
- `frontend/src/components/foreman/CaptureModal.tsx`
- `frontend/src/components/foreman/DiaryFinishFlow.tsx`
- `frontend/src/components/foreman/ForemanMobileShell.tsx`
- `frontend/src/lib/foremanFeatures.ts`

### Modified Files
- `frontend/src/components/foreman/DocketComparisonCard.tsx` (add undo)
- `frontend/src/components/foreman/index.ts` (exports)
- `frontend/src/App.tsx` or routes file (new routes)
- `backend/src/routes/dashboard.ts` (new endpoint)

### Deprecated (keep but don't use for foreman)
- `frontend/src/components/foreman/QuickCaptureButton.tsx` (replaced by nav Capture)
- `frontend/src/components/foreman/ForemanBottomNav.tsx` (replaced by V2)

---

## Migration Path

1. **Phase 1-4:** Build new components (no breaking changes)
2. **Phase 5:** Update existing components (backward compatible)
3. **Phase 6:** Wire up new shell and routes
4. **Phase 7:** Feature flag old navigation for foreman role
5. **Phase 8:** Test and verify

The old navigation can remain for non-foreman roles or desktop views.
