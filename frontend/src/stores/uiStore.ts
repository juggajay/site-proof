// Feature #442: Zustand client state store
// This store manages UI state that persists across navigation

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SidebarState {
  isCollapsed: boolean
  expandedSections: string[]
}

interface UIFilters {
  lotsStatus: string | null
  lotsSearch: string
  ncrsStatus: string | null
  ncrsSearch: string
  documentsCategory: string | null
  documentsSearch: string
}

interface UIState {
  // Sidebar state
  sidebar: SidebarState

  // Current project (persists during navigation)
  currentProjectId: string | null

  // UI filters (persist during navigation within project)
  filters: UIFilters

  // Modal states
  isCreateLotModalOpen: boolean
  isCreateNCRModalOpen: boolean

  // Actions
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarSection: (section: string) => void
  setCurrentProject: (projectId: string | null) => void
  setFilter: <K extends keyof UIFilters>(key: K, value: UIFilters[K]) => void
  resetFilters: () => void
  setCreateLotModalOpen: (open: boolean) => void
  setCreateNCRModalOpen: (open: boolean) => void
}

const defaultFilters: UIFilters = {
  lotsStatus: null,
  lotsSearch: '',
  ncrsStatus: null,
  ncrsSearch: '',
  documentsCategory: null,
  documentsSearch: '',
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebar: {
        isCollapsed: false,
        expandedSections: ['projects', 'quality'],
      },
      currentProjectId: null,
      filters: { ...defaultFilters },
      isCreateLotModalOpen: false,
      isCreateNCRModalOpen: false,

      // Actions
      toggleSidebar: () =>
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            isCollapsed: !state.sidebar.isCollapsed,
          },
        })),

      setSidebarCollapsed: (collapsed) =>
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            isCollapsed: collapsed,
          },
        })),

      toggleSidebarSection: (section) =>
        set((state) => {
          const expandedSections = state.sidebar.expandedSections.includes(section)
            ? state.sidebar.expandedSections.filter((s) => s !== section)
            : [...state.sidebar.expandedSections, section]
          return {
            sidebar: {
              ...state.sidebar,
              expandedSections,
            },
          }
        }),

      setCurrentProject: (projectId) =>
        set({
          currentProjectId: projectId,
          // Reset filters when changing projects
          filters: projectId !== get().currentProjectId ? { ...defaultFilters } : get().filters,
        }),

      setFilter: (key, value) =>
        set((state) => ({
          filters: {
            ...state.filters,
            [key]: value,
          },
        })),

      resetFilters: () =>
        set({ filters: { ...defaultFilters } }),

      setCreateLotModalOpen: (open) =>
        set({ isCreateLotModalOpen: open }),

      setCreateNCRModalOpen: (open) =>
        set({ isCreateNCRModalOpen: open }),
    }),
    {
      name: 'siteproof-ui-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields to localStorage
        sidebar: state.sidebar,
        currentProjectId: state.currentProjectId,
      }),
    }
  )
)

// Selector hooks for common use cases
export const useSidebarState = () => useUIStore((state) => state.sidebar)
export const useCurrentProjectId = () => useUIStore((state) => state.currentProjectId)
export const useLotsFilters = () => useUIStore((state) => ({
  status: state.filters.lotsStatus,
  search: state.filters.lotsSearch,
}))
export const useNCRsFilters = () => useUIStore((state) => ({
  status: state.filters.ncrsStatus,
  search: state.filters.ncrsSearch,
}))
