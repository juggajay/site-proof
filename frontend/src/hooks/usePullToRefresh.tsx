import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface UsePullToRefreshOptions {
  /** Callback fired when pull threshold is exceeded and released */
  onRefresh: () => Promise<void>
  /** Distance in pixels required to trigger refresh (default: 80) */
  threshold?: number
  /** Resistance factor for natural pull feel - higher = more resistance (default: 2.5) */
  resistanceFactor?: number
  /** Maximum pull distance allowed (default: 150) */
  maxPullDistance?: number
  /** Whether pull to refresh is enabled (default: true) */
  enabled?: boolean
}

export interface UsePullToRefreshReturn {
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement>
  /** Current pull distance in pixels (with resistance applied) */
  pullDistance: number
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean
  /** Whether the user is currently pulling */
  isPulling: boolean
  /** Progress towards threshold (0-1, can exceed 1) */
  progress: number
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function usePullToRefresh(
  options: UsePullToRefreshOptions
): UsePullToRefreshReturn {
  const {
    onRefresh,
    threshold = 80,
    resistanceFactor = 2.5,
    maxPullDistance = 150,
    enabled = true,
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)

  // Track touch state without causing re-renders
  const touchState = useRef({
    startY: 0,
    currentY: 0,
    isTracking: false,
  })

  // Calculate progress (0-1, can exceed 1 when past threshold)
  const progress = threshold > 0 ? pullDistance / threshold : 0

  // Apply resistance to raw pull distance for natural feel
  const applyResistance = useCallback(
    (rawDistance: number): number => {
      if (rawDistance <= 0) return 0
      // Logarithmic resistance for diminishing returns on pull
      const resistedDistance = rawDistance / resistanceFactor
      return Math.min(resistedDistance, maxPullDistance)
    },
    [resistanceFactor, maxPullDistance]
  )

  // Check if container is scrolled to top
  const isScrolledToTop = useCallback((): boolean => {
    const container = containerRef.current
    if (!container) return false
    return container.scrollTop <= 0
  }, [])

  // Handle refresh trigger
  const triggerRefresh = useCallback(async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      await onRefresh()
    } catch (error) {
      console.error('Pull to refresh error:', error)
    } finally {
      setIsRefreshing(false)
      setPullDistance(0)
    }
  }, [onRefresh, isRefreshing])

  useEffect(() => {
    if (!enabled) return

    const container = containerRef.current
    if (!container) return

    // Prevent default to avoid browser pull-to-refresh on mobile
    const preventDefaultHandler = (e: TouchEvent) => {
      if (touchState.current.isTracking && pullDistance > 0) {
        e.preventDefault()
      }
    }

    const handleTouchStart = (e: TouchEvent) => {
      // Don't start tracking if already refreshing
      if (isRefreshing) return

      // Only track if scrolled to top
      if (!isScrolledToTop()) return

      const touch = e.touches[0]
      if (!touch) return

      touchState.current = {
        startY: touch.clientY,
        currentY: touch.clientY,
        isTracking: true,
      }
      setIsPulling(true)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchState.current.isTracking || isRefreshing) return

      const touch = e.touches[0]
      if (!touch) return

      touchState.current.currentY = touch.clientY
      const rawDistance = touchState.current.currentY - touchState.current.startY

      // Only allow pulling down when at top
      if (rawDistance > 0 && isScrolledToTop()) {
        const resistedDistance = applyResistance(rawDistance)
        setPullDistance(resistedDistance)

        // Prevent scroll while pulling
        if (resistedDistance > 0) {
          e.preventDefault()
        }
      } else if (rawDistance <= 0) {
        // User is scrolling up, stop tracking
        touchState.current.isTracking = false
        setIsPulling(false)
        setPullDistance(0)
      }
    }

    const handleTouchEnd = () => {
      if (!touchState.current.isTracking) return

      touchState.current.isTracking = false
      setIsPulling(false)

      // Check if threshold was met
      if (pullDistance >= threshold && !isRefreshing) {
        triggerRefresh()
      } else {
        // Animate back to 0
        setPullDistance(0)
      }
    }

    const handleTouchCancel = () => {
      touchState.current.isTracking = false
      setIsPulling(false)
      setPullDistance(0)
    }

    // Add listeners with passive: false to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    container.addEventListener('touchcancel', handleTouchCancel, { passive: true })
    document.addEventListener('touchmove', preventDefaultHandler, { passive: false })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchCancel)
      document.removeEventListener('touchmove', preventDefaultHandler)
    }
  }, [
    enabled,
    isRefreshing,
    pullDistance,
    threshold,
    applyResistance,
    isScrolledToTop,
    triggerRefresh,
  ])

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    isPulling,
    progress,
  }
}

// -----------------------------------------------------------------------------
// PullToRefreshIndicator Component
// -----------------------------------------------------------------------------

export interface PullToRefreshIndicatorProps {
  /** Current pull distance */
  pullDistance: number
  /** Whether refreshing is in progress */
  isRefreshing: boolean
  /** Progress towards threshold (0-1) */
  progress: number
  /** Additional CSS classes */
  className?: string
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  progress,
  className,
}: PullToRefreshIndicatorProps) {
  // Don't render if no pull and not refreshing
  if (pullDistance === 0 && !isRefreshing) {
    return null
  }

  // Calculate rotation based on progress (0 to 180 degrees)
  const rotation = Math.min(progress * 180, 180)

  // Scale based on progress for visual feedback
  const scale = Math.min(0.5 + progress * 0.5, 1)

  // Opacity increases with pull
  const opacity = Math.min(progress, 1)

  return (
    <div
      className={cn(
        'absolute left-0 right-0 flex items-center justify-center pointer-events-none z-50',
        'transition-transform duration-200 ease-out',
        className
      )}
      style={{
        top: 0,
        transform: `translateY(${Math.max(pullDistance - 40, 0)}px)`,
      }}
    >
      <div
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-full',
          'bg-white shadow-lg border border-gray-200',
          'transition-all duration-200 ease-out'
        )}
        style={{
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        {isRefreshing ? (
          // Spinner during refresh
          <svg
            className="w-5 h-5 text-blue-600 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          // Arrow that rotates based on pull progress
          <svg
            className={cn(
              'w-5 h-5 transition-transform duration-150',
              progress >= 1 ? 'text-blue-600' : 'text-gray-500'
            )}
            style={{
              transform: `rotate(${rotation}deg)`,
            }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        )}
      </div>

      {/* Release text indicator */}
      {progress >= 1 && !isRefreshing && (
        <span className="absolute top-12 text-xs text-gray-500 font-medium whitespace-nowrap">
          Release to refresh
        </span>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Default Export
// -----------------------------------------------------------------------------

export default usePullToRefresh
