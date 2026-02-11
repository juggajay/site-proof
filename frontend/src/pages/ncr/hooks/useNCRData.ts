import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import type { NCR, UserRole } from '../types'

interface UseNCRDataOptions {
  projectId: string | undefined
  token: string | null
}

interface UseNCRDataReturn {
  ncrs: NCR[]
  loading: boolean
  error: string | null
  setError: (error: string | null) => void
  userRole: UserRole | null
  fetchNcrs: () => Promise<void>
}

export function useNCRData({ projectId, token }: UseNCRDataOptions): UseNCRDataReturn {
  const [ncrs, setNcrs] = useState<NCR[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)

  const fetchNcrs = useCallback(async () => {
    try {
      setLoading(true)
      const path = projectId
        ? `/api/ncrs?projectId=${projectId}`
        : `/api/ncrs`
      const data = await apiFetch<{ ncrs: NCR[] }>(path)
      setNcrs(data.ncrs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load NCRs')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const checkUserRole = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await apiFetch<UserRole>(`/api/ncrs/check-role/${projectId}`)
      setUserRole(data)
    } catch (err) {
      console.error('Failed to check user role:', err)
    }
  }, [projectId])

  // Initial fetch
  useEffect(() => {
    if (token) {
      fetchNcrs()
      checkUserRole()
    }
  }, [token, projectId, fetchNcrs, checkUserRole])

  // Real-time NCR status update polling (every 30 seconds)
  useEffect(() => {
    if (!token) return

    let pollInterval: NodeJS.Timeout | null = null

    const silentFetchNcrs = async () => {
      const path = projectId
        ? `/api/ncrs?projectId=${projectId}`
        : `/api/ncrs`

      try {
        const data = await apiFetch<{ ncrs: NCR[] }>(path)
        setNcrs((prevNcrs: NCR[]) => {
          const newNcrs = data.ncrs || []
          const hasChanges = newNcrs.length !== prevNcrs.length ||
            newNcrs.some((newNcr: NCR, index: number) =>
              !prevNcrs[index] ||
              newNcr.id !== prevNcrs[index].id ||
              newNcr.status !== prevNcrs[index].status ||
              newNcr.closedAt !== prevNcrs[index].closedAt ||
              newNcr.qmApprovedAt !== prevNcrs[index].qmApprovedAt
            )
          return hasChanges ? newNcrs : prevNcrs
        })
      } catch (err) {
        console.debug('Background NCR fetch failed:', err)
      }
    }

    const startPolling = () => {
      pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          silentFetchNcrs()
        }
      }, 30000)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentFetchNcrs()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [token, projectId])

  return { ncrs, loading, error, setError, userRole, fetchNcrs }
}
