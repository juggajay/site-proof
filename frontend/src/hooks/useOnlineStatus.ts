// useOnlineStatus hook for offline detection
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
