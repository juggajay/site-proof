// SwipeableCard - Swipe gesture for approve/reject actions
import { useState, useRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'

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
  disabled?: boolean
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction = { label: 'Reject', color: 'bg-red-500', icon: <X className="h-6 w-6" /> },
  rightAction = { label: 'Approve', color: 'bg-green-500', icon: <Check className="h-6 w-6" /> },
  threshold = 100,
  className,
  disabled = false,
}: SwipeableCardProps) {
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const currentXRef = useRef(0)
  const thresholdCrossedRef = useRef<'left' | 'right' | null>(null)
  const { trigger } = useHaptics()

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return
    startXRef.current = e.touches[0].clientX
    currentXRef.current = e.touches[0].clientX
    thresholdCrossedRef.current = null
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || disabled) return

    currentXRef.current = e.touches[0].clientX
    const diff = currentXRef.current - startXRef.current

    // Limit the offset with resistance at edges
    const maxOffset = 150
    const resistance = 0.5
    let newOffset = diff

    if (Math.abs(diff) > maxOffset) {
      newOffset = maxOffset * (diff > 0 ? 1 : -1) + (diff - maxOffset * (diff > 0 ? 1 : -1)) * resistance
    }

    // Trigger haptic feedback when crossing threshold (once per direction)
    if (newOffset > threshold && thresholdCrossedRef.current !== 'right') {
      trigger('light')
      thresholdCrossedRef.current = 'right'
    } else if (newOffset < -threshold && thresholdCrossedRef.current !== 'left') {
      trigger('light')
      thresholdCrossedRef.current = 'left'
    } else if (Math.abs(newOffset) < threshold && thresholdCrossedRef.current !== null) {
      // Reset when coming back below threshold
      thresholdCrossedRef.current = null
    }

    setOffset(newOffset)
  }

  const handleTouchEnd = () => {
    if (disabled) return
    setIsDragging(false)

    if (offset > threshold && onSwipeRight) {
      trigger('light')
      onSwipeRight()
    } else if (offset < -threshold && onSwipeLeft) {
      trigger('light')
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
            'text-white transition-opacity duration-150',
            showRightAction ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="flex flex-col items-center">
            {rightAction.icon}
            <span className="text-xs mt-1 font-medium">{rightAction.label}</span>
          </div>
        </div>

        {/* Left action (reject) - shown when swiping left */}
        <div
          className={cn(
            'flex items-center justify-end px-6 flex-1',
            leftAction.color,
            'text-white transition-opacity duration-150',
            showLeftAction ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="flex flex-col items-center">
            {leftAction.icon}
            <span className="text-xs mt-1 font-medium">{leftAction.label}</span>
          </div>
        </div>
      </div>

      {/* Swipeable content */}
      <div
        className={cn(
          'relative bg-card',
          !isDragging && 'transition-transform duration-200 ease-out'
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
