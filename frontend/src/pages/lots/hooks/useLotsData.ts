import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuthToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import type { Lot } from '../lotsPageTypes'

const INITIAL_DISPLAY_COUNT = 20
const LOAD_MORE_COUNT = 15

interface UseLotsDataParams {
  projectId: string | undefined
  isSubcontractor: boolean
  statusFilters: string[]
  activityFilter: string
  searchQuery: string
  sortField: string
  sortDirection: 'asc' | 'desc'
  chainageMinFilter: string
  chainageMaxFilter: string
  subcontractorFilter: string
  areaZoneFilter: string
}

export function useLotsData({
  projectId,
  isSubcontractor,
  statusFilters,
  activityFilter,
  searchQuery,
  sortField,
  sortDirection,
  chainageMinFilter,
  chainageMaxFilter,
  subcontractorFilter,
  areaZoneFilter,
}: UseLotsDataParams) {
  const navigate = useNavigate()

  // Core data state
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string>('')
  const [subcontractors, setSubcontractors] = useState<{ id: string; companyName: string }[]>([])
  const [projectAreas, setProjectAreas] = useState<{ id: string; name: string; chainageStart: number | null; chainageEnd: number | null; colour: string | null }[]>([])

  // Infinite scroll state
  const [displayedCount, setDisplayedCount] = useState(INITIAL_DISPLAY_COUNT)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // =====================
  // Derived data
  // =====================
  const activityTypes = useMemo(() => {
    const types = new Set(lots.map((l) => l.activityType).filter(Boolean))
    return Array.from(types).sort()
  }, [lots])

  const areaZones = useMemo(() => {
    const zones = new Set(lots.map((l) => l.areaZone).filter(Boolean))
    return Array.from(zones).sort() as string[]
  }, [lots])

  const filteredLots = useMemo(() => {
    const filtered = lots.filter((lot) => {
      if (statusFilters.length > 0 && !statusFilters.includes(lot.status)) return false
      if (activityFilter && lot.activityType !== activityFilter) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesLotNumber = lot.lotNumber.toLowerCase().includes(query)
        const matchesDescription = (lot.description || '').toLowerCase().includes(query)
        if (!matchesLotNumber && !matchesDescription) return false
      }
      const minFilter = chainageMinFilter ? parseFloat(chainageMinFilter) : null
      const maxFilter = chainageMaxFilter ? parseFloat(chainageMaxFilter) : null
      if (minFilter !== null || maxFilter !== null) {
        if (lot.chainageStart === null && lot.chainageEnd === null) return false
        const lotStart = lot.chainageStart ?? lot.chainageEnd ?? 0
        const lotEnd = lot.chainageEnd ?? lot.chainageStart ?? 0
        if (minFilter !== null && lotEnd < minFilter) return false
        if (maxFilter !== null && lotStart > maxFilter) return false
      }
      if (subcontractorFilter) {
        if (subcontractorFilter === 'unassigned') {
          if (lot.assignedSubcontractorId) return false
        } else {
          if (lot.assignedSubcontractorId !== subcontractorFilter) return false
        }
      }
      if (areaZoneFilter) {
        if (areaZoneFilter === 'unassigned') {
          if (lot.areaZone) return false
        } else {
          if (lot.areaZone !== areaZoneFilter) return false
        }
      }
      return true
    })

    return filtered.sort((a, b) => {
      let aVal: string | number | null = null
      let bVal: string | number | null = null
      switch (sortField) {
        case 'lotNumber':
          aVal = a.lotNumber.toLowerCase(); bVal = b.lotNumber.toLowerCase(); break
        case 'description':
          aVal = (a.description || '').toLowerCase(); bVal = (b.description || '').toLowerCase(); break
        case 'chainage':
          aVal = a.chainageStart ?? Number.MAX_SAFE_INTEGER; bVal = b.chainageStart ?? Number.MAX_SAFE_INTEGER; break
        case 'activityType':
          aVal = (a.activityType || '').toLowerCase(); bVal = (b.activityType || '').toLowerCase(); break
        case 'status':
          aVal = a.status.toLowerCase(); bVal = b.status.toLowerCase(); break
        default: return 0
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [lots, statusFilters, activityFilter, searchQuery, sortField, sortDirection, chainageMinFilter, chainageMaxFilter, subcontractorFilter, areaZoneFilter])

  const displayedLots = useMemo(() => filteredLots.slice(0, displayedCount), [filteredLots, displayedCount])
  const hasMore = displayedCount < filteredLots.length

  // =====================
  // Data fetching
  // =====================
  const fetchLots = useCallback(async () => {
    if (!projectId) return
    const token = getAuthToken()
    if (!token) { navigate('/login'); return }

    try {
      setLoading(true)
      const data = await apiFetch<{ lots: Lot[] }>(`/api/lots?projectId=${projectId}`)
      setLots(data.lots || [])
    } catch (err) {
      setError('Failed to load lots')
      console.error('Fetch lots error:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId, navigate])

  const fetchSubcontractors = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await apiFetch<{ subcontractors: typeof subcontractors }>(`/api/subcontractors/for-project/${projectId}`)
      setSubcontractors(data.subcontractors || [])
    } catch (err) {
      console.error('Fetch subcontractors error:', err)
    }
  }, [projectId])

  useEffect(() => { fetchLots() }, [fetchLots])

  useEffect(() => {
    if (projectId && !isSubcontractor) fetchSubcontractors()
  }, [projectId, isSubcontractor, fetchSubcontractors])

  // Fetch project name
  useEffect(() => {
    const fetchProjectName = async () => {
      if (!projectId) return
      try {
        const data = await apiFetch<{ project?: { name?: string }; name?: string }>(`/api/projects/${projectId}`)
        setProjectName(data.project?.name || data.name || '')
      } catch (err) { console.error('Error fetching project name:', err) }
    }
    fetchProjectName()
  }, [projectId])

  // Feature #708 - Fetch project areas
  useEffect(() => {
    const fetchProjectAreas = async () => {
      if (!projectId) return
      try {
        const data = await apiFetch<{ areas: typeof projectAreas }>(`/api/projects/${projectId}/areas`)
        setProjectAreas(data.areas || [])
      } catch (err) { console.error('Error fetching project areas:', err) }
    }
    fetchProjectAreas()
  }, [projectId])

  // Feature #732: Real-time lot update polling
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null
    const startPolling = () => {
      pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && projectId) {
          const silentFetchLots = async () => {
            try {
              const data = await apiFetch<{ lots: Lot[] }>(`/api/lots?projectId=${projectId}`)
              const newLots = data.lots || []
              setLots(prevLots => {
                const hasChanges = newLots.length !== prevLots.length ||
                  newLots.some((newLot: Lot, index: number) =>
                    !prevLots[index] || newLot.id !== prevLots[index].id || newLot.status !== prevLots[index].status
                  )
                return hasChanges ? newLots : prevLots
              })
            } catch (err) { console.debug('Background lot fetch failed:', err) }
          }
          silentFetchLots()
        }
      }, 30000)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && projectId) fetchLots()
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      if (pollInterval) clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [projectId, fetchLots])

  // =====================
  // Infinite scroll
  // =====================
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    setTimeout(() => {
      setDisplayedCount(prev => Math.min(prev + LOAD_MORE_COUNT, filteredLots.length))
      setLoadingMore(false)
    }, 200)
  }, [loadingMore, hasMore, filteredLots.length])

  useEffect(() => { setDisplayedCount(INITIAL_DISPLAY_COUNT) },
    [statusFilters.join(','), activityFilter, searchQuery, sortField, sortDirection, chainageMinFilter, chainageMaxFilter, subcontractorFilter, areaZoneFilter])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loadingMore) loadMore() },
      { threshold: 0.1 }
    )
    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadMore])

  return {
    lots,
    setLots,
    loading,
    error,
    setError,
    projectName,
    subcontractors,
    projectAreas,
    activityTypes,
    areaZones,
    filteredLots,
    displayedLots,
    hasMore,
    loadMoreRef,
    loadingMore,
    fetchLots,
    fetchSubcontractors,
  }
}
