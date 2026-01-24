// ForemanMobileShell - Wraps foreman pages with research-backed navigation and modals
// Provides the 5-tab nav (Capture, Today, Approve, Diary, Lots) and capture/diary modals
import { useState, useCallback, useEffect } from 'react'
import { Outlet, useParams, useOutletContext } from 'react-router-dom'
import { ForemanBottomNavV2 } from './ForemanBottomNavV2'
import { CaptureModal } from './CaptureModal'
import { DiaryFinishFlow } from './DiaryFinishFlow'
import { getAuthToken } from '@/lib/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3031'

// Context type for child pages to access shell functions
interface ForemanShellContext {
  openCapture: () => void
  openDiaryFinish: () => void
  refreshTodayBadge: () => void
}

export function useForemanShell() {
  return useOutletContext<ForemanShellContext>()
}

export function ForemanMobileShell() {
  const { projectId } = useParams()
  const [captureOpen, setCaptureOpen] = useState(false)
  const [diaryFinishOpen, setDiaryFinishOpen] = useState(false)
  const [todayBadgeCount, setTodayBadgeCount] = useState(0)

  // Fetch today's badge count (blocking + due today items)
  const fetchTodayBadge = useCallback(async () => {
    if (!projectId) return

    const token = getAuthToken()
    if (!token) return

    try {
      const response = await fetch(
        `${API_URL}/api/dashboard/projects/${projectId}/foreman/today`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.ok) {
        const data = await response.json()
        // Count blocking + due today items for badge
        const count = (data.blocking?.length || 0) + (data.dueToday?.length || 0)
        setTodayBadgeCount(count)
      }
    } catch (err) {
      console.error('Error fetching today badge count:', err)
    }
  }, [projectId])

  // Fetch badge count on mount and periodically
  useEffect(() => {
    fetchTodayBadge()
    // Refresh every 5 minutes
    const interval = setInterval(fetchTodayBadge, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchTodayBadge])

  const handleCapturePress = useCallback(() => {
    setCaptureOpen(true)
  }, [])

  const handleCaptureComplete = useCallback(() => {
    setCaptureOpen(false)
    // Optionally refresh data after capture
  }, [])

  const handleDiarySubmit = useCallback(() => {
    setDiaryFinishOpen(false)
    // Refresh today badge as diary submission may affect it
    fetchTodayBadge()
  }, [fetchTodayBadge])

  // Context for child pages
  const outletContext: ForemanShellContext = {
    openCapture: () => setCaptureOpen(true),
    openDiaryFinish: () => setDiaryFinishOpen(true),
    refreshTodayBadge: fetchTodayBadge
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Page Content - renders the matched child route */}
      <Outlet context={outletContext} />

      {/* Bottom Navigation */}
      <ForemanBottomNavV2
        onCapturePress={handleCapturePress}
        todayBadgeCount={todayBadgeCount}
      />

      {/* Capture Modal */}
      {projectId && (
        <CaptureModal
          projectId={projectId}
          isOpen={captureOpen}
          onClose={() => setCaptureOpen(false)}
          onCapture={handleCaptureComplete}
        />
      )}

      {/* Diary Finish Flow */}
      <DiaryFinishFlow
        isOpen={diaryFinishOpen}
        onClose={() => setDiaryFinishOpen(false)}
        onSubmit={handleDiarySubmit}
      />
    </div>
  )
}

export default ForemanMobileShell
