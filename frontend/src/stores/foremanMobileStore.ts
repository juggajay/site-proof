// Foreman Mobile UI State Store
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

  // Quick actions modal
  isQuickActionsOpen: boolean
  setIsQuickActionsOpen: (open: boolean) => void
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
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      setIsOnline: (online) => set({ isOnline: online }),
      pendingSyncCount: 0,
      setPendingSyncCount: (count) => set({ pendingSyncCount: count }),

      // Voice
      isVoiceActive: false,
      setIsVoiceActive: (active) => set({ isVoiceActive: active }),

      // Quick actions modal
      isQuickActionsOpen: false,
      setIsQuickActionsOpen: (open) => set({ isQuickActionsOpen: open }),
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
export const useForemanOnlineStatus = () =>
  useForemanMobileStore((s) => ({
    isOnline: s.isOnline,
    pendingSyncCount: s.pendingSyncCount,
  }))
export const useForemanCamera = () =>
  useForemanMobileStore((s) => ({
    isCameraOpen: s.isCameraOpen,
    setIsCameraOpen: s.setIsCameraOpen,
  }))
