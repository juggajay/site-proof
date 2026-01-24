import { useState, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useMediaQuery'

/**
 * FAB Action item configuration
 */
export interface FABAction {
  id: string
  label: string
  icon: React.ReactNode
  color: string // Tailwind bg class like 'bg-red-500'
  onClick: () => void
}

/**
 * ContextFAB Props
 */
export interface ContextFABProps {
  actions: FABAction[]
  mainColor?: string
}

/**
 * Trigger haptic feedback if available
 */
function triggerHaptic(intensity: 'light' | 'medium' | 'heavy' = 'medium') {
  if ('vibrate' in navigator) {
    const durations = {
      light: 10,
      medium: 25,
      heavy: 50,
    }
    navigator.vibrate(durations[intensity])
  }
}

/**
 * CSS keyframe animations for the FAB
 */
const fabStyles = `
  @keyframes fab-action-in {
    0% {
      opacity: 0;
      transform: translateY(20px) scale(0.8);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes fab-action-out {
    0% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(20px) scale(0.8);
    }
  }

  @keyframes fab-backdrop-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes fab-backdrop-out {
    0% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  .fab-action-enter {
    animation: fab-action-in 0.2s ease-out forwards;
  }

  .fab-action-exit {
    animation: fab-action-out 0.15s ease-in forwards;
  }

  .fab-backdrop-enter {
    animation: fab-backdrop-in 0.2s ease-out forwards;
  }

  .fab-backdrop-exit {
    animation: fab-backdrop-out 0.15s ease-in forwards;
  }
`

/**
 * ContextFAB - A floating action button for mobile construction app UI
 *
 * Features:
 * - Industrial utility design with high contrast and bold colors
 * - Single action triggers directly without expanding
 * - Multiple actions expand with backdrop and staggered animation
 * - Main button rotates to X when expanded
 * - Each action shows icon + label
 * - Only renders on mobile devices
 * - Haptic feedback on interactions
 */
export function ContextFAB({ actions, mainColor = 'bg-amber-500' }: ContextFABProps) {
  const isMobile = useIsMobile()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)

  const handleMainClick = useCallback(() => {
    triggerHaptic('medium')

    // Single action - trigger directly
    if (actions.length === 1) {
      actions[0].onClick()
      return
    }

    // Multiple actions - toggle expand
    if (isExpanded) {
      setIsAnimatingOut(true)
      setTimeout(() => {
        setIsExpanded(false)
        setIsAnimatingOut(false)
      }, 150)
    } else {
      setIsExpanded(true)
    }
  }, [actions, isExpanded])

  const handleActionClick = useCallback((action: FABAction) => {
    triggerHaptic('light')
    action.onClick()

    // Close the FAB after action
    setIsAnimatingOut(true)
    setTimeout(() => {
      setIsExpanded(false)
      setIsAnimatingOut(false)
    }, 150)
  }, [])

  const handleBackdropClick = useCallback(() => {
    setIsAnimatingOut(true)
    setTimeout(() => {
      setIsExpanded(false)
      setIsAnimatingOut(false)
    }, 150)
  }, [])

  // Only render on mobile
  if (!isMobile) {
    return null
  }

  // Don't render if no actions
  if (actions.length === 0) {
    return null
  }

  const showExpanded = isExpanded || isAnimatingOut

  return (
    <>
      {/* Inject keyframe styles */}
      <style>{fabStyles}</style>

      {/* Backdrop - only show when expanded with multiple actions */}
      {showExpanded && actions.length > 1 && (
        <div
          className={cn(
            'fixed inset-0 bg-black/60 z-40',
            isAnimatingOut ? 'fab-backdrop-exit' : 'fab-backdrop-enter'
          )}
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* FAB Container */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3">
        {/* Action Buttons - shown when expanded */}
        {showExpanded && actions.length > 1 && (
          <div className="flex flex-col items-end gap-3 mb-2">
            {actions.map((action, index) => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={cn(
                  'flex items-center gap-3 touch-manipulation',
                  isAnimatingOut ? 'fab-action-exit' : 'fab-action-enter'
                )}
                style={{
                  animationDelay: isAnimatingOut
                    ? `${(actions.length - 1 - index) * 30}ms`
                    : `${index * 50}ms`,
                }}
                aria-label={action.label}
              >
                {/* Label */}
                <span
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-bold',
                    'bg-zinc-800 text-white shadow-lg',
                    'border-2 border-zinc-700'
                  )}
                >
                  {action.label}
                </span>

                {/* Icon Button */}
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    'shadow-lg border-2 border-black/20',
                    'active:scale-95 transition-transform duration-100',
                    action.color
                  )}
                >
                  <span className="text-white drop-shadow-sm">{action.icon}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Main FAB Button */}
        <button
          onClick={handleMainClick}
          className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center',
            'shadow-xl border-2 border-black/20',
            'active:scale-95 transition-all duration-200',
            'touch-manipulation',
            mainColor
          )}
          style={{
            // Chunky shadow for industrial feel
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2)',
          }}
          aria-label={isExpanded ? 'Close actions' : 'Open actions'}
          aria-expanded={isExpanded}
        >
          <div
            className={cn(
              'transition-transform duration-200',
              isExpanded && 'rotate-45'
            )}
          >
            {isExpanded ? (
              <X className="w-7 h-7 text-white drop-shadow-sm" strokeWidth={2.5} />
            ) : (
              <Plus className="w-7 h-7 text-white drop-shadow-sm" strokeWidth={2.5} />
            )}
          </div>
        </button>
      </div>
    </>
  )
}

export default ContextFAB
