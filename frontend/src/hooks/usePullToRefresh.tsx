import { useState, useRef, useCallback, RefObject } from 'react'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number
}

interface UsePullToRefreshReturn {
  containerRef: RefObject<HTMLDivElement>
  pullDistance: number
  isRefreshing: boolean
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: () => void
  }
}

/**
 * Hook to add pull-to-refresh functionality to a scrollable container
 *
 * @param options.onRefresh - Async function to call when refresh is triggered
 * @param options.threshold - Distance in pixels to pull before triggering refresh (default 80)
 * @returns containerRef, pullDistance, isRefreshing state, and touch handlers
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === 0 || isRefreshing) return

    const currentY = e.touches[0].clientY
    const diff = currentY - startY.current

    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      // Apply resistance to the pull
      setPullDistance(Math.min(diff * 0.5, 120))
    }
  }, [isRefreshing])

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    }
    setPullDistance(0)
    startY.current = 0
  }, [pullDistance, threshold, isRefreshing, onRefresh])

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}

/**
 * Pull-to-refresh indicator component
 * Shows a spinner when refreshing, arrow when pulling
 */
export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80
}: {
  pullDistance: number
  isRefreshing: boolean
  threshold?: number
}) {
  if (pullDistance === 0 && !isRefreshing) return null

  return (
    <div
      className="absolute left-0 right-0 flex justify-center z-10 transition-transform pointer-events-none"
      style={{ transform: `translateY(${pullDistance - 40}px)` }}
    >
      <div className={`w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center bg-card shadow ${isRefreshing ? 'animate-spin' : ''}`}>
        {isRefreshing ? (
          <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <svg
            className={`h-4 w-4 text-primary transition-transform ${pullDistance >= threshold ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        )}
      </div>
    </div>
  )
}
