# Site Foreman Mobile UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a mobile-optimized UI specifically designed for site foremen working in the field on construction sites.

**Architecture:** Extend the existing ForemanDashboard with a dedicated mobile-first component structure. Add a new foreman-specific bottom navigation, quick capture components, and touch-optimized workflows. Leverage the existing Dexie offline infrastructure and Zustand state management.

**Tech Stack:** React 18, TypeScript, TailwindCSS, Zustand, Dexie (IndexedDB), Radix UI primitives, existing API layer (`lib/api.ts`), existing offline infrastructure (`lib/offlineDb.ts`).

---

## Phase 1: Mobile Foreman Store & Infrastructure

### Task 1.1: Create Foreman Mobile Store

**Files:**
- Create: `frontend/src/stores/foremanMobileStore.ts`

**Step 1: Write the store**

```typescript
// frontend/src/stores/foremanMobileStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ForemanTab = 'home' | 'diary' | 'capture' | 'approve' | 'quick'

interface QuickAction {
  id: string
  type: 'photo' | 'delay' | 'ncr' | 'note' | 'holdpoint'
  timestamp: string
  data: Record<string, unknown>
}

interface ForemanMobileState {
  // Active tab
  activeTab: ForemanTab
  setActiveTab: (tab: ForemanTab) => void

  // Pending quick actions (before sync)
  pendingActions: QuickAction[]
  addPendingAction: (action: Omit<QuickAction, 'id' | 'timestamp'>) => void
  removePendingAction: (id: string) => void
  clearPendingActions: () => void

  // GPS state
  currentLocation: { lat: number; lng: number } | null
  setCurrentLocation: (location: { lat: number; lng: number } | null) => void
  gpsError: string | null
  setGpsError: (error: string | null) => void

  // Camera state
  isCameraOpen: boolean
  setIsCameraOpen: (open: boolean) => void

  // Offline indicator
  isOnline: boolean
  setIsOnline: (online: boolean) => void
  pendingSyncCount: number
  setPendingSyncCount: (count: number) => void

  // Voice input
  isVoiceActive: boolean
  setIsVoiceActive: (active: boolean) => void
}

export const useForemanMobileStore = create<ForemanMobileState>()(
  persist(
    (set) => ({
      // Active tab
      activeTab: 'home',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Pending actions
      pendingActions: [],
      addPendingAction: (action) =>
        set((state) => ({
          pendingActions: [
            ...state.pendingActions,
            {
              ...action,
              id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
            },
          ],
        })),
      removePendingAction: (id) =>
        set((state) => ({
          pendingActions: state.pendingActions.filter((a) => a.id !== id),
        })),
      clearPendingActions: () => set({ pendingActions: [] }),

      // GPS
      currentLocation: null,
      setCurrentLocation: (location) => set({ currentLocation: location }),
      gpsError: null,
      setGpsError: (error) => set({ gpsError: error }),

      // Camera
      isCameraOpen: false,
      setIsCameraOpen: (open) => set({ isCameraOpen: open }),

      // Offline
      isOnline: navigator.onLine,
      setIsOnline: (online) => set({ isOnline: online }),
      pendingSyncCount: 0,
      setPendingSyncCount: (count) => set({ pendingSyncCount: count }),

      // Voice
      isVoiceActive: false,
      setIsVoiceActive: (active) => set({ isVoiceActive: active }),
    }),
    {
      name: 'siteproof-foreman-mobile',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeTab: state.activeTab,
        pendingActions: state.pendingActions,
      }),
    }
  )
)

// Selector hooks
export const useForemanActiveTab = () => useForemanMobileStore((s) => s.activeTab)
export const useForemanLocation = () => useForemanMobileStore((s) => s.currentLocation)
export const useForemanOnlineStatus = () => useForemanMobileStore((s) => ({
  isOnline: s.isOnline,
  pendingSyncCount: s.pendingSyncCount,
}))
```

**Step 2: Verify store compiles**

Run: `cd frontend && npx tsc --noEmit src/stores/foremanMobileStore.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/stores/foremanMobileStore.ts
git commit -m "feat: add foreman mobile zustand store

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.2: Create useGeoLocation Hook

**Files:**
- Create: `frontend/src/hooks/useGeoLocation.ts`

**Step 1: Write the hook**

```typescript
// frontend/src/hooks/useGeoLocation.ts
import { useState, useEffect, useCallback } from 'react'
import { useForemanMobileStore } from '@/stores/foremanMobileStore'

interface GeoLocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}

interface GeoLocationState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  error: string | null
  loading: boolean
}

const defaultOptions: GeoLocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000, // 1 minute cache
}

export function useGeoLocation(options: GeoLocationOptions = {}) {
  const [state, setState] = useState<GeoLocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
  })

  const { setCurrentLocation, setGpsError } = useForemanMobileStore()
  const mergedOptions = { ...defaultOptions, ...options }

  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      const error = 'Geolocation is not supported by this browser'
      setState((s) => ({ ...s, error, loading: false }))
      setGpsError(error)
      return
    }

    setState((s) => ({ ...s, loading: true, error: null }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setState({
          latitude,
          longitude,
          accuracy,
          error: null,
          loading: false,
        })
        setCurrentLocation({ lat: latitude, lng: longitude })
        setGpsError(null)
      },
      (error) => {
        let errorMessage = 'Failed to get location'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable'
            break
          case error.TIMEOUT:
            errorMessage = 'Location request timed out'
            break
        }
        setState((s) => ({ ...s, error: errorMessage, loading: false }))
        setGpsError(errorMessage)
      },
      mergedOptions
    )
  }, [mergedOptions, setCurrentLocation, setGpsError])

  // Get position on mount
  useEffect(() => {
    getCurrentPosition()
  }, [])

  return {
    ...state,
    refresh: getCurrentPosition,
    isSupported: 'geolocation' in navigator,
  }
}
```

**Step 2: Verify hook compiles**

Run: `cd frontend && npx tsc --noEmit src/hooks/useGeoLocation.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/hooks/useGeoLocation.ts
git commit -m "feat: add useGeoLocation hook for GPS capture

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.3: Create useOnlineStatus Hook

**Files:**
- Create: `frontend/src/hooks/useOnlineStatus.ts`

**Step 1: Write the hook**

```typescript
// frontend/src/hooks/useOnlineStatus.ts
import { useEffect } from 'react'
import { useForemanMobileStore } from '@/stores/foremanMobileStore'
import { getPendingSyncCount } from '@/lib/offlineDb'

export function useOnlineStatus() {
  const { isOnline, setIsOnline, pendingSyncCount, setPendingSyncCount } = useForemanMobileStore()

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set initial state
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setIsOnline])

  // Poll for pending sync count
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const count = await getPendingSyncCount()
        setPendingSyncCount(count)
      } catch (e) {
        console.error('Failed to get pending sync count:', e)
      }
    }

    updatePendingCount()
    const interval = setInterval(updatePendingCount, 5000) // Every 5 seconds

    return () => clearInterval(interval)
  }, [setPendingSyncCount])

  return { isOnline, pendingSyncCount }
}
```

**Step 2: Verify hook compiles**

Run: `cd frontend && npx tsc --noEmit src/hooks/useOnlineStatus.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/hooks/useOnlineStatus.ts
git commit -m "feat: add useOnlineStatus hook for offline detection

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Core Mobile Components

### Task 2.1: Create ForemanBottomNav Component

**Files:**
- Create: `frontend/src/components/foreman/ForemanBottomNav.tsx`

**Step 1: Write the component**

```typescript
// frontend/src/components/foreman/ForemanBottomNav.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { Home, BookOpen, Camera, CheckSquare, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useForemanMobileStore, ForemanTab } from '@/stores/foremanMobileStore'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface NavItem {
  id: ForemanTab
  label: string
  icon: typeof Home
  route?: string
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'diary', label: 'Diary', icon: BookOpen },
  { id: 'capture', label: 'Capture', icon: Camera },
  { id: 'approve', label: 'Approve', icon: CheckSquare },
  { id: 'quick', label: 'Quick', icon: Zap },
]

export function ForemanBottomNav() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { activeTab, setActiveTab, setIsCameraOpen } = useForemanMobileStore()
  const { isOnline, pendingSyncCount } = useOnlineStatus()

  const handleNavClick = (item: NavItem) => {
    setActiveTab(item.id)

    if (item.id === 'capture') {
      setIsCameraOpen(true)
      return
    }

    // Navigate based on tab
    switch (item.id) {
      case 'home':
        navigate('/dashboard')
        break
      case 'diary':
        navigate(projectId ? `/projects/${projectId}/diary` : '/diary')
        break
      case 'approve':
        navigate(projectId ? `/projects/${projectId}/dockets?status=pending_approval` : '/dockets')
        break
      case 'quick':
        // Quick actions modal - handled by parent
        break
    }
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-30 pb-safe">
      {/* Offline indicator */}
      {(!isOnline || pendingSyncCount > 0) && (
        <div
          className={cn(
            'flex items-center justify-center gap-2 py-1.5 text-xs font-medium',
            isOnline ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
          )}
        >
          {isOnline ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              {pendingSyncCount} item{pendingSyncCount !== 1 ? 's' : ''} pending sync
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Offline - changes will sync when connected
            </>
          )}
        </div>
      )}

      {/* Nav items */}
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full gap-1',
                'min-h-[48px] min-w-[48px] touch-manipulation',
                'transition-colors duration-150',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {item.id === 'capture' ? (
                <div
                  className={cn(
                    'flex items-center justify-center w-12 h-12 -mt-4 rounded-full',
                    'bg-primary text-primary-foreground shadow-lg',
                    'active:scale-95 transition-transform'
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
              ) : (
                <>
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{item.label}</span>
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

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit src/components/foreman/ForemanBottomNav.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/foreman/ForemanBottomNav.tsx
git commit -m "feat: add ForemanBottomNav with offline indicator

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2.2: Create QuickCaptureButton (FAB)

**Files:**
- Create: `frontend/src/components/foreman/QuickCaptureButton.tsx`

**Step 1: Write the component**

```typescript
// frontend/src/components/foreman/QuickCaptureButton.tsx
import { useState } from 'react'
import { Camera, X, CloudRain, AlertTriangle, StickyNote, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useForemanMobileStore } from '@/stores/foremanMobileStore'

interface QuickAction {
  id: string
  label: string
  icon: typeof Camera
  color: string
  onClick: () => void
}

interface QuickCaptureButtonProps {
  onCapturePhoto: () => void
  onAddDelay: () => void
  onRaiseNCR: () => void
  onAddNote: () => void
  onRequestHoldPointRelease: () => void
}

export function QuickCaptureButton({
  onCapturePhoto,
  onAddDelay,
  onRaiseNCR,
  onAddNote,
  onRequestHoldPointRelease,
}: QuickCaptureButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { isCameraOpen, setIsCameraOpen } = useForemanMobileStore()

  const actions: QuickAction[] = [
    {
      id: 'photo',
      label: 'Photo',
      icon: Camera,
      color: 'bg-blue-500',
      onClick: () => {
        setIsExpanded(false)
        setIsCameraOpen(true)
        onCapturePhoto()
      },
    },
    {
      id: 'delay',
      label: 'Delay',
      icon: CloudRain,
      color: 'bg-amber-500',
      onClick: () => {
        setIsExpanded(false)
        onAddDelay()
      },
    },
    {
      id: 'ncr',
      label: 'NCR',
      icon: AlertTriangle,
      color: 'bg-red-500',
      onClick: () => {
        setIsExpanded(false)
        onRaiseNCR()
      },
    },
    {
      id: 'note',
      label: 'Note',
      icon: StickyNote,
      color: 'bg-green-500',
      onClick: () => {
        setIsExpanded(false)
        onAddNote()
      },
    },
    {
      id: 'holdpoint',
      label: 'Hold Point',
      icon: Clock,
      color: 'bg-purple-500',
      onClick: () => {
        setIsExpanded(false)
        onRequestHoldPointRelease()
      },
    },
  ]

  // Don't show if camera is already open
  if (isCameraOpen) return null

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* FAB Container */}
      <div className="fixed bottom-20 right-4 z-50 md:hidden flex flex-col-reverse items-end gap-3">
        {/* Action buttons (shown when expanded) */}
        {isExpanded &&
          actions.map((action, index) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                onClick={action.onClick}
                className={cn(
                  'flex items-center gap-3 pr-4 pl-3 py-2 rounded-full shadow-lg',
                  'transform transition-all duration-200',
                  'min-h-[48px] touch-manipulation',
                  action.color,
                  'text-white'
                )}
                style={{
                  animation: `slideIn 0.2s ease-out ${index * 0.05}s both`,
                }}
              >
                <div className="w-8 h-8 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
              </button>
            )
          })}

        {/* Main FAB */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'w-14 h-14 rounded-full shadow-lg flex items-center justify-center',
            'transform transition-all duration-200 active:scale-95',
            'touch-manipulation',
            isExpanded ? 'bg-gray-600 rotate-45' : 'bg-primary'
          )}
        >
          {isExpanded ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
        </button>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit src/components/foreman/QuickCaptureButton.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/foreman/QuickCaptureButton.tsx
git commit -m "feat: add QuickCaptureButton FAB for quick actions

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2.3: Create PhotoCaptureModal

**Files:**
- Create: `frontend/src/components/foreman/PhotoCaptureModal.tsx`

**Step 1: Write the component**

```typescript
// frontend/src/components/foreman/PhotoCaptureModal.tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Camera, RotateCcw, Check, MapPin, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useForemanMobileStore } from '@/stores/foremanMobileStore'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { capturePhotoOffline, compressImage } from '@/lib/offlineDb'
import { useAuth } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'
import { VoiceInputButton } from '@/components/ui/VoiceInputButton'

interface PhotoCaptureModalProps {
  projectId: string
  lotId?: string
  entityType?: 'lot' | 'ncr' | 'holdpoint' | 'itp' | 'test' | 'general'
  entityId?: string
  onCapture?: (photoId: string) => void
  onClose: () => void
}

export function PhotoCaptureModal({
  projectId,
  lotId,
  entityType = 'general',
  entityId,
  onCapture,
  onClose,
}: PhotoCaptureModalProps) {
  const { user } = useAuth()
  const { isCameraOpen, setIsCameraOpen } = useForemanMobileStore()
  const { latitude, longitude, accuracy, error: gpsError, refresh: refreshGps } = useGeoLocation()

  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [useNativeCamera, setUseNativeCamera] = useState(true)

  // Close modal handler
  const handleClose = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
    setIsCameraOpen(false)
    onClose()
  }, [stream, setIsCameraOpen, onClose])

  // Start camera stream (fallback for browsers without native capture)
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setUseNativeCamera(false)
    } catch {
      // Fall back to file input
      setUseNativeCamera(true)
    }
  }, [])

  // Handle file selection (native camera or gallery)
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCapturedFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      setCapturedImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  // Capture from video stream
  const captureFromStream = useCallback(() => {
    if (!videoRef.current || !stream) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(videoRef.current, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setCapturedImage(dataUrl)

    // Convert to file
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
          setCapturedFile(file)
        }
      },
      'image/jpeg',
      0.8
    )
  }, [stream])

  // Retake photo
  const handleRetake = useCallback(() => {
    setCapturedImage(null)
    setCapturedFile(null)
    setCaption('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Save photo
  const handleSave = useCallback(async () => {
    if (!capturedFile || !user) return

    setSaving(true)
    try {
      const photo = await capturePhotoOffline(projectId, capturedFile, {
        lotId,
        entityType,
        entityId,
        caption: caption.trim() || undefined,
        capturedBy: user.id,
        gpsLatitude: latitude ?? undefined,
        gpsLongitude: longitude ?? undefined,
      })

      toast({ description: 'Photo saved', variant: 'success' })
      onCapture?.(photo.id)
      handleClose()
    } catch (error) {
      console.error('Failed to save photo:', error)
      toast({ description: 'Failed to save photo', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }, [
    capturedFile,
    user,
    projectId,
    lotId,
    entityType,
    entityId,
    caption,
    latitude,
    longitude,
    onCapture,
    handleClose,
  ])

  // Handle voice input for caption
  const handleVoiceCaption = useCallback((text: string) => {
    setCaption((prev) => (prev ? `${prev} ${text}` : text))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [stream])

  if (!isCameraOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <button
          onClick={handleClose}
          className="p-2 text-white touch-manipulation min-h-[48px] min-w-[48px] flex items-center justify-center"
        >
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-white font-medium">Capture Photo</h2>
        <div className="w-12" /> {/* Spacer for centering */}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {!capturedImage ? (
          <>
            {/* Camera view or capture button */}
            <div className="flex-1 flex items-center justify-center bg-gray-900">
              {useNativeCamera ? (
                <div className="text-center p-8">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-full bg-white flex items-center justify-center touch-manipulation"
                  >
                    <Camera className="w-12 h-12 text-gray-900" />
                  </button>
                  <p className="text-white mt-4">Tap to take photo</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={captureFromStream}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-white border-4 border-gray-300 touch-manipulation"
                  />
                </>
              )}
            </div>

            {/* GPS indicator */}
            <div className="p-4 bg-black/80">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className={cn('w-4 h-4', latitude ? 'text-green-500' : 'text-yellow-500')} />
                {latitude ? (
                  <span className="text-white">
                    GPS: {latitude.toFixed(6)}, {longitude?.toFixed(6)}
                    {accuracy && <span className="text-gray-400 ml-2">±{accuracy.toFixed(0)}m</span>}
                  </span>
                ) : gpsError ? (
                  <span className="text-yellow-500">{gpsError}</span>
                ) : (
                  <span className="text-gray-400">Getting location...</span>
                )}
                <button onClick={refreshGps} className="ml-auto text-blue-400 text-xs">
                  Refresh
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Preview captured image */}
            <div className="flex-1 relative">
              <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
            </div>

            {/* Caption input */}
            <div className="p-4 bg-white">
              <div className="flex items-start gap-2">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add caption (optional)"
                  className="flex-1 p-3 border rounded-lg resize-none min-h-[80px]"
                  rows={2}
                />
                <VoiceInputButton onTranscript={handleVoiceCaption} />
              </div>

              {/* GPS display */}
              {latitude && (
                <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                  <MapPin className="w-4 h-4" />
                  Location captured
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleRetake}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg font-medium touch-manipulation min-h-[48px]"
                >
                  <RotateCcw className="w-5 h-5" />
                  Retake
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium',
                    'bg-primary text-primary-foreground touch-manipulation min-h-[48px]',
                    saving && 'opacity-50'
                  )}
                >
                  {saving ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit src/components/foreman/PhotoCaptureModal.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/foreman/PhotoCaptureModal.tsx
git commit -m "feat: add PhotoCaptureModal with GPS and offline support

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Enhanced Foreman Dashboard

### Task 3.1: Create Mobile Dashboard Cards

**Files:**
- Create: `frontend/src/components/foreman/DashboardCard.tsx`

**Step 1: Write the component**

```typescript
// frontend/src/components/foreman/DashboardCard.tsx
import { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardCardProps {
  title: string
  icon?: ReactNode
  badge?: string | number
  badgeVariant?: 'default' | 'warning' | 'success' | 'error'
  children: ReactNode
  onClick?: () => void
  className?: string
  headerAction?: ReactNode
}

const badgeColors = {
  default: 'bg-blue-100 text-blue-800',
  warning: 'bg-amber-100 text-amber-800',
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
}

export function DashboardCard({
  title,
  icon,
  badge,
  badgeVariant = 'default',
  children,
  onClick,
  className,
  headerAction,
}: DashboardCardProps) {
  const isClickable = !!onClick

  return (
    <div
      className={cn(
        'bg-card rounded-lg border overflow-hidden',
        isClickable && 'cursor-pointer active:bg-muted/50 transition-colors',
        className
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          {icon && <span className="text-primary">{icon}</span>}
          <h3 className="font-semibold">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {badge !== undefined && (
            <span
              className={cn(
                'text-xs font-medium px-2.5 py-0.5 rounded-full',
                badgeColors[badgeVariant]
              )}
            >
              {badge}
            </span>
          )}
          {headerAction}
          {isClickable && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">{children}</div>
    </div>
  )
}

// Stat component for dashboard cards
interface StatProps {
  label: string
  value: string | number
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
}

export function DashboardStat({ label, value, icon }: StatProps) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit src/components/foreman/DashboardCard.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/foreman/DashboardCard.tsx
git commit -m "feat: add DashboardCard component for mobile dashboard

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3.2: Create WeatherWidget

**Files:**
- Create: `frontend/src/components/foreman/WeatherWidget.tsx`

**Step 1: Write the component**

```typescript
// frontend/src/components/foreman/WeatherWidget.tsx
import { Sun, Cloud, CloudRain, CloudSnow, Wind, Thermometer, Droplets } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WeatherData {
  conditions: string | null
  temperatureMin: number | null
  temperatureMax: number | null
  rainfallMm: number | null
}

interface WeatherWidgetProps {
  weather: WeatherData
  loading?: boolean
  className?: string
}

function getWeatherIcon(conditions: string | null) {
  if (!conditions) return <Sun className="h-10 w-10 text-yellow-500" />

  const lower = conditions.toLowerCase()
  if (lower.includes('rain') || lower.includes('shower')) {
    return <CloudRain className="h-10 w-10 text-blue-500" />
  }
  if (lower.includes('snow')) {
    return <CloudSnow className="h-10 w-10 text-blue-200" />
  }
  if (lower.includes('wind')) {
    return <Wind className="h-10 w-10 text-gray-500" />
  }
  if (lower.includes('cloud') || lower.includes('overcast')) {
    return <Cloud className="h-10 w-10 text-gray-400" />
  }
  return <Sun className="h-10 w-10 text-yellow-500" />
}

function getGradient(conditions: string | null) {
  if (!conditions) return 'from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20'

  const lower = conditions.toLowerCase()
  if (lower.includes('rain') || lower.includes('shower')) {
    return 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20'
  }
  if (lower.includes('cloud') || lower.includes('overcast')) {
    return 'from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20'
  }
  return 'from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20'
}

export function WeatherWidget({ weather, loading, className }: WeatherWidgetProps) {
  if (loading) {
    return (
      <div className={cn('rounded-lg border p-6 animate-pulse', className)}>
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-gray-200 rounded-full" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-3 w-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-4 bg-gradient-to-r',
        getGradient(weather.conditions),
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {getWeatherIcon(weather.conditions)}
          <div>
            <h3 className="font-semibold text-lg">Today's Weather</h3>
            <p className="text-muted-foreground">
              {weather.conditions || 'Weather data not available'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {weather.temperatureMin !== null && weather.temperatureMax !== null && (
            <div className="flex items-center gap-2">
              <Thermometer className="h-5 w-5 text-red-500" />
              <span className="text-lg font-medium">
                {weather.temperatureMin}° - {weather.temperatureMax}°C
              </span>
            </div>
          )}
          {weather.rainfallMm !== null && weather.rainfallMm > 0 && (
            <div className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-blue-500" />
              <span className="text-lg font-medium">{weather.rainfallMm}mm</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit src/components/foreman/WeatherWidget.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/foreman/WeatherWidget.tsx
git commit -m "feat: add WeatherWidget component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3.3: Create ForemanMobileDashboard

**Files:**
- Create: `frontend/src/components/foreman/ForemanMobileDashboard.tsx`

**Step 1: Write the component**

```typescript
// frontend/src/components/foreman/ForemanMobileDashboard.tsx
import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth, getAuthToken } from '@/lib/auth'
import {
  RefreshCw,
  Calendar,
  FileText,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  Plus,
  ChevronRight,
  Users,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DashboardCard, DashboardStat } from './DashboardCard'
import { WeatherWidget } from './WeatherWidget'
import { ForemanBottomNav } from './ForemanBottomNav'
import { QuickCaptureButton } from './QuickCaptureButton'
import { PhotoCaptureModal } from './PhotoCaptureModal'
import { useForemanMobileStore } from '@/stores/foremanMobileStore'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3031'

interface DashboardData {
  todayDiary: {
    exists: boolean
    status: 'draft' | 'submitted' | null
    id: string | null
  }
  pendingDockets: {
    count: number
    totalLabourHours: number
    totalPlantHours: number
  }
  inspectionsDueToday: {
    count: number
    items: Array<{
      id: string
      type: string
      description: string
      lotNumber: string
      link: string
    }>
  }
  weather: {
    conditions: string | null
    temperatureMin: number | null
    temperatureMax: number | null
    rainfallMm: number | null
  }
  project: {
    id: string
    name: string
    projectNumber: string
  } | null
}

function getTimeOfDay(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function formatDateForUrl(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function ForemanMobileDashboard() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isCameraOpen, setIsCameraOpen } = useForemanMobileStore()
  const { isOnline } = useOnlineStatus()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<DashboardData>({
    todayDiary: { exists: false, status: null, id: null },
    pendingDockets: { count: 0, totalLabourHours: 0, totalPlantHours: 0 },
    inspectionsDueToday: { count: 0, items: [] },
    weather: { conditions: null, temperatureMin: null, temperatureMax: null, rainfallMm: null },
    project: null,
  })

  const fetchDashboardData = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/dashboard/foreman`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (err) {
      console.error('Error fetching foreman dashboard:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  // Pull-to-refresh handler (for touch devices)
  const handleTouchRefresh = useCallback(() => {
    if (!refreshing) {
      handleRefresh()
    }
  }, [refreshing])

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  // Quick action handlers
  const handleCapturePhoto = () => setIsCameraOpen(true)
  const handleAddDelay = () => navigate(projectId ? `/projects/${projectId}/diary?tab=delays` : '/diary')
  const handleRaiseNCR = () => navigate(projectId ? `/projects/${projectId}/ncr/new` : '/ncr/new')
  const handleAddNote = () => navigate(projectId ? `/projects/${projectId}/diary` : '/diary')
  const handleRequestHoldPoint = () => navigate(projectId ? `/projects/${projectId}/hold-points` : '/hold-points')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="pb-24 md:pb-6">
      {/* Header - optimized for mobile */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">
              Good {getTimeOfDay()}, {user?.fullName?.split(' ')[0] || 'Foreman'}!
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {today}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              'p-2 rounded-lg border touch-manipulation min-h-[44px] min-w-[44px]',
              'flex items-center justify-center',
              'active:bg-muted'
            )}
          >
            <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Project context */}
        {data.project && (
          <div className="mt-2 text-sm text-muted-foreground border-l-4 border-primary pl-2">
            {data.project.name}
            {data.project.projectNumber && ` (${data.project.projectNumber})`}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="p-4 space-y-4 md:p-6 md:space-y-6">
        {/* Weather Widget */}
        <WeatherWidget weather={data.weather} />

        {/* Diary & Dockets Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Today's Diary */}
          <DashboardCard
            title="Today's Diary"
            icon={<FileText className="h-5 w-5" />}
            badge={
              data.todayDiary.status === 'submitted'
                ? 'Submitted'
                : data.todayDiary.exists
                ? 'Draft'
                : 'Not Started'
            }
            badgeVariant={
              data.todayDiary.status === 'submitted'
                ? 'success'
                : data.todayDiary.exists
                ? 'warning'
                : 'default'
            }
            onClick={() => navigate(`/projects/${projectId}/diary?date=${formatDateForUrl(new Date())}`)}
          >
            {data.todayDiary.exists ? (
              <p className="text-sm text-muted-foreground">
                {data.todayDiary.status === 'submitted'
                  ? 'Diary submitted for today'
                  : 'Diary started but not submitted'}
              </p>
            ) : (
              <div className="flex items-center gap-2 text-primary">
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">Start Today's Diary</span>
              </div>
            )}
          </DashboardCard>

          {/* Pending Dockets */}
          <DashboardCard
            title="Pending Dockets"
            icon={<ClipboardCheck className="h-5 w-5" />}
            badge={data.pendingDockets.count > 0 ? `${data.pendingDockets.count} pending` : undefined}
            badgeVariant="warning"
            onClick={() => navigate(`/projects/${projectId}/dockets?status=pending_approval`)}
          >
            {data.pendingDockets.count > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <DashboardStat
                  label="Labour"
                  value={`${data.pendingDockets.totalLabourHours}h`}
                  icon={<Users className="h-4 w-4" />}
                />
                <DashboardStat
                  label="Plant"
                  value={`${data.pendingDockets.totalPlantHours}h`}
                  icon={<Truck className="h-4 w-4" />}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm">All dockets reviewed</span>
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Inspections Due */}
        <DashboardCard
          title="Inspections Due Today"
          icon={<Clock className="h-5 w-5" />}
          badge={data.inspectionsDueToday.count > 0 ? `${data.inspectionsDueToday.count} due` : undefined}
          badgeVariant="warning"
        >
          {data.inspectionsDueToday.count > 0 ? (
            <div className="space-y-2">
              {data.inspectionsDueToday.items.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.link)}
                  className={cn(
                    'w-full flex items-center justify-between p-3',
                    'bg-muted/30 rounded-lg',
                    'active:bg-muted/50 transition-colors',
                    'touch-manipulation min-h-[48px]'
                  )}
                >
                  <div className="text-left">
                    <p className="font-medium text-sm">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.type} • Lot {item.lotNumber}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
              {data.inspectionsDueToday.count > 3 && (
                <Link
                  to={`/projects/${projectId}/hold-points`}
                  className="block text-center text-sm text-primary py-2"
                >
                  View all {data.inspectionsDueToday.count} inspections
                </Link>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm">No inspections scheduled for today</span>
            </div>
          )}
        </DashboardCard>
      </div>

      {/* Quick Capture FAB */}
      <QuickCaptureButton
        onCapturePhoto={handleCapturePhoto}
        onAddDelay={handleAddDelay}
        onRaiseNCR={handleRaiseNCR}
        onAddNote={handleAddNote}
        onRequestHoldPointRelease={handleRequestHoldPoint}
      />

      {/* Photo Capture Modal */}
      {isCameraOpen && projectId && (
        <PhotoCaptureModal
          projectId={projectId}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Bottom Navigation */}
      <ForemanBottomNav />
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit src/components/foreman/ForemanMobileDashboard.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/foreman/ForemanMobileDashboard.tsx
git commit -m "feat: add ForemanMobileDashboard with mobile-first design

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Docket Approval Flow

### Task 4.1: Create DocketComparisonCard

**Files:**
- Create: `frontend/src/components/foreman/DocketComparisonCard.tsx`

**Step 1: Write the component**

```typescript
// frontend/src/components/foreman/DocketComparisonCard.tsx
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocketEntry {
  submitted: number
  approved?: number
  label: string
}

interface DocketComparisonCardProps {
  docketNumber: string
  subcontractor: string
  date: string
  labour: DocketEntry
  plant: DocketEntry
  diaryLabourHours?: number
  diaryPlantHours?: number
  hasDiscrepancy?: boolean
  status: 'pending_approval' | 'approved' | 'rejected' | 'queried'
  onApprove?: () => void
  onReject?: () => void
  onQuery?: () => void
  onViewDetails?: () => void
}

export function DocketComparisonCard({
  docketNumber,
  subcontractor,
  date,
  labour,
  plant,
  diaryLabourHours,
  diaryPlantHours,
  hasDiscrepancy,
  status,
  onApprove,
  onReject,
  onQuery,
  onViewDetails,
}: DocketComparisonCardProps) {
  const labourDiscrepancy = diaryLabourHours !== undefined && Math.abs(labour.submitted - diaryLabourHours) > 0.5
  const plantDiscrepancy = diaryPlantHours !== undefined && Math.abs(plant.submitted - diaryPlantHours) > 0.5

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{docketNumber}</h3>
            <p className="text-sm text-muted-foreground">{subcontractor}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{new Date(date).toLocaleDateString('en-AU')}</p>
            {hasDiscrepancy && (
              <div className="flex items-center gap-1 text-amber-600 text-xs mt-1">
                <AlertTriangle className="h-3 w-3" />
                Discrepancy
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
          <div className="font-medium text-muted-foreground"></div>
          <div className="font-medium">Submitted</div>
          <div className="font-medium">Diary</div>
        </div>

        {/* Labour Row */}
        <div className={cn(
          'grid grid-cols-3 gap-2 text-center py-2 rounded',
          labourDiscrepancy && 'bg-amber-50 dark:bg-amber-900/20'
        )}>
          <div className="text-left font-medium">Labour</div>
          <div>{labour.submitted}h</div>
          <div className={cn(labourDiscrepancy && 'text-amber-600 font-medium')}>
            {diaryLabourHours !== undefined ? `${diaryLabourHours}h` : '-'}
          </div>
        </div>

        {/* Plant Row */}
        <div className={cn(
          'grid grid-cols-3 gap-2 text-center py-2 rounded',
          plantDiscrepancy && 'bg-amber-50 dark:bg-amber-900/20'
        )}>
          <div className="text-left font-medium">Plant</div>
          <div>{plant.submitted}h</div>
          <div className={cn(plantDiscrepancy && 'text-amber-600 font-medium')}>
            {diaryPlantHours !== undefined ? `${diaryPlantHours}h` : '-'}
          </div>
        </div>
      </div>

      {/* Actions */}
      {status === 'pending_approval' && (
        <div className="p-4 border-t bg-muted/30">
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg',
                'bg-green-600 text-white font-medium',
                'active:bg-green-700 transition-colors',
                'touch-manipulation min-h-[48px]'
              )}
            >
              <CheckCircle2 className="h-5 w-5" />
              Approve
            </button>
            <button
              onClick={onQuery}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg',
                'bg-amber-500 text-white font-medium',
                'active:bg-amber-600 transition-colors',
                'touch-manipulation min-h-[48px]'
              )}
            >
              <AlertTriangle className="h-5 w-5" />
              Query
            </button>
            <button
              onClick={onReject}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg',
                'bg-red-600 text-white font-medium',
                'active:bg-red-700 transition-colors',
                'touch-manipulation min-h-[48px]'
              )}
            >
              <XCircle className="h-5 w-5" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* View Details */}
      <button
        onClick={onViewDetails}
        className={cn(
          'w-full py-3 text-center text-sm text-primary font-medium',
          'border-t active:bg-muted/50',
          'touch-manipulation min-h-[48px]'
        )}
      >
        View Full Details
      </button>
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit src/components/foreman/DocketComparisonCard.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/foreman/DocketComparisonCard.tsx
git commit -m "feat: add DocketComparisonCard for mobile docket approval

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 4.2: Create SwipeableCard Component

**Files:**
- Create: `frontend/src/components/foreman/SwipeableCard.tsx`

**Step 1: Write the component**

```typescript
// frontend/src/components/foreman/SwipeableCard.tsx
import { useState, useRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'

interface SwipeableCardProps {
  children: ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  leftAction?: {
    label: string
    color: string
    icon?: ReactNode
  }
  rightAction?: {
    label: string
    color: string
    icon?: ReactNode
  }
  threshold?: number
  className?: string
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction = { label: 'Reject', color: 'bg-red-500', icon: <X className="h-6 w-6" /> },
  rightAction = { label: 'Approve', color: 'bg-green-500', icon: <Check className="h-6 w-6" /> },
  threshold = 100,
  className,
}: SwipeableCardProps) {
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const currentXRef = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    currentXRef.current = e.touches[0].clientX
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return

    currentXRef.current = e.touches[0].clientX
    const diff = currentXRef.current - startXRef.current

    // Limit the offset with resistance at edges
    const maxOffset = 150
    const resistance = 0.5
    let newOffset = diff

    if (Math.abs(diff) > maxOffset) {
      newOffset = maxOffset * (diff > 0 ? 1 : -1) + (diff - maxOffset * (diff > 0 ? 1 : -1)) * resistance
    }

    setOffset(newOffset)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)

    if (offset > threshold && onSwipeRight) {
      onSwipeRight()
    } else if (offset < -threshold && onSwipeLeft) {
      onSwipeLeft()
    }

    setOffset(0)
  }

  const showLeftAction = offset < -20
  const showRightAction = offset > 20

  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)}>
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        {/* Right action (approve) - shown when swiping right */}
        <div
          className={cn(
            'flex items-center justify-start px-6 flex-1',
            rightAction.color,
            'text-white transition-opacity',
            showRightAction ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="flex flex-col items-center">
            {rightAction.icon}
            <span className="text-xs mt-1">{rightAction.label}</span>
          </div>
        </div>

        {/* Left action (reject) - shown when swiping left */}
        <div
          className={cn(
            'flex items-center justify-end px-6 flex-1',
            leftAction.color,
            'text-white transition-opacity',
            showLeftAction ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="flex flex-col items-center">
            {leftAction.icon}
            <span className="text-xs mt-1">{leftAction.label}</span>
          </div>
        </div>
      </div>

      {/* Swipeable content */}
      <div
        className={cn(
          'relative bg-card',
          !isDragging && 'transition-transform duration-200'
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit src/components/foreman/SwipeableCard.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/foreman/SwipeableCard.tsx
git commit -m "feat: add SwipeableCard for swipe-to-approve gesture

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Integration & Testing

### Task 5.1: Create Index Export File

**Files:**
- Create: `frontend/src/components/foreman/index.ts`

**Step 1: Write the export file**

```typescript
// frontend/src/components/foreman/index.ts
export { ForemanBottomNav } from './ForemanBottomNav'
export { ForemanMobileDashboard } from './ForemanMobileDashboard'
export { QuickCaptureButton } from './QuickCaptureButton'
export { PhotoCaptureModal } from './PhotoCaptureModal'
export { DashboardCard, DashboardStat } from './DashboardCard'
export { WeatherWidget } from './WeatherWidget'
export { DocketComparisonCard } from './DocketComparisonCard'
export { SwipeableCard } from './SwipeableCard'
```

**Step 2: Commit**

```bash
git add frontend/src/components/foreman/index.ts
git commit -m "feat: add foreman components index export

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 5.2: Update MobileNav for Foreman Role

**Files:**
- Modify: `frontend/src/components/layouts/MobileNav.tsx`

**Step 1: Update MobileNav to use ForemanBottomNav for foreman role**

In `MobileNav.tsx`, add conditional rendering to use `ForemanBottomNav` when user is a foreman:

```typescript
// At the top of the file, add import:
import { ForemanBottomNav } from '@/components/foreman'

// In the MobileNav component, before the return statement:
const isForeman = userRole === 'foreman'

// If foreman, render the foreman-specific bottom nav
if (isForeman && projectId) {
  return (
    <>
      {/* Keep hamburger menu for full navigation access */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden p-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-muted touch-manipulation flex items-center justify-center"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile Slide-out Menu (same as before) */}
      {isOpen && (
        // ... existing slide-out menu code ...
      )}

      {/* Use foreman-specific bottom nav */}
      <ForemanBottomNav />
    </>
  )
}

// ... rest of existing return for non-foreman users
```

**Step 2: Test the integration**

Run: `cd frontend && npm run build`
Expected: Build succeeds without errors

**Step 3: Commit**

```bash
git add frontend/src/components/layouts/MobileNav.tsx
git commit -m "feat: integrate ForemanBottomNav for foreman role

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 5.3: Update Dashboard Page to Use ForemanMobileDashboard

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx` (or wherever dashboard is rendered)

**Step 1: Add mobile detection and foreman dashboard**

```typescript
// Add to DashboardPage.tsx
import { useAuth } from '@/lib/auth'
import { ForemanMobileDashboard } from '@/components/foreman'
import { ForemanDashboard } from '@/components/dashboard/ForemanDashboard'

// In the component:
const { user } = useAuth()
const isForeman = user?.role === 'foreman'
const isMobile = window.innerWidth < 768 // or use a hook

// Render foreman-specific dashboard
if (isForeman) {
  return isMobile ? <ForemanMobileDashboard /> : <ForemanDashboard />
}
```

**Step 2: Test on mobile viewport**

Run: `cd frontend && npm run dev`
Test: Open browser dev tools, set mobile viewport, login as foreman user
Expected: Mobile dashboard renders with bottom nav and FAB

**Step 3: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: integrate ForemanMobileDashboard on mobile devices

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 5.4: Run Full Build and Type Check

**Step 1: Run TypeScript type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 2: Run ESLint**

Run: `cd frontend && npm run lint`
Expected: No errors (or only warnings)

**Step 3: Run production build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 4: Commit all changes**

```bash
git add -A
git commit -m "chore: verify build passes for foreman mobile UI

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 5.5: Push to Main

**Step 1: Verify current branch**

Run: `git branch`
Expected: Shows current branch (likely `master` or `main`)

**Step 2: Push to remote**

Run: `git push origin HEAD`
Expected: Push succeeds

---

## Summary

This implementation plan creates a mobile-optimized Site Foreman UI with:

1. **Zustand Store** (`foremanMobileStore.ts`) - State management for mobile-specific state
2. **Custom Hooks** - `useGeoLocation` for GPS, `useOnlineStatus` for offline detection
3. **Bottom Navigation** (`ForemanBottomNav`) - 5-tab navigation with offline indicator
4. **Quick Capture FAB** (`QuickCaptureButton`) - Floating action button with expandable actions
5. **Photo Capture** (`PhotoCaptureModal`) - Native camera integration with GPS tagging
6. **Dashboard Components** - Mobile-optimized cards, weather widget, stats
7. **Docket Approval** - Comparison cards with swipe gestures

All components follow existing patterns:
- TailwindCSS for styling
- 48px minimum touch targets
- Offline-first with Dexie
- Existing API layer integration
- Voice input integration where applicable
