import { useCallback, useRef } from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type HapticFeedbackType = 'light' | 'medium' | 'success' | 'error'

export interface UseHapticsOptions {
  /** Whether haptic feedback is enabled (default: true) */
  enabled?: boolean
}

export interface UseHapticsReturn {
  /** Trigger haptic feedback */
  trigger: (type?: HapticFeedbackType) => void
  /** Whether haptic feedback is supported on this device */
  isSupported: boolean
}

// -----------------------------------------------------------------------------
// Haptic Patterns
// -----------------------------------------------------------------------------

/**
 * Vibration patterns for different feedback types.
 * Each array represents vibration durations in milliseconds.
 * For patterns with multiple values, odd indices are pauses.
 */
const HAPTIC_PATTERNS: Record<HapticFeedbackType, number[]> = {
  /** Subtle tap - minimal feedback for hover/focus */
  light: [10],
  /** Standard button press - noticeable but not intrusive */
  medium: [20],
  /** Success confirmation - double tap pattern */
  success: [10, 50, 10],
  /** Error/warning - longer buzz to indicate problem */
  error: [30, 20, 30],
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Check if the Vibration API is supported.
 * Returns false during SSR (no window object).
 */
function isVibrationSupported(): boolean {
  // SSR safety check
  if (typeof window === 'undefined') {
    return false
  }

  // Check for navigator and vibrate function
  if (typeof navigator === 'undefined') {
    return false
  }

  // The vibrate method may exist but return false if not supported
  return 'vibrate' in navigator && typeof navigator.vibrate === 'function'
}

/**
 * Attempt to trigger device vibration with the given pattern.
 * Silently fails if not supported.
 */
function vibrate(pattern: number[]): boolean {
  if (!isVibrationSupported()) {
    return false
  }

  try {
    // navigator.vibrate returns true if successful, false otherwise
    return navigator.vibrate(pattern)
  } catch (error) {
    // Some browsers may throw on vibrate calls in certain contexts
    console.debug('Haptic feedback failed:', error)
    return false
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

/**
 * useHaptics - Provides haptic feedback for mobile interactions.
 *
 * Wraps the navigator.vibrate API with predefined patterns for common
 * interaction types. Gracefully handles unsupported devices and SSR.
 *
 * @example
 * ```tsx
 * const { trigger, isSupported } = useHaptics()
 *
 * const handlePress = () => {
 *   trigger('medium')
 *   // ... handle press action
 * }
 *
 * const handleSuccess = () => {
 *   trigger('success')
 *   // ... show success state
 * }
 * ```
 */
export function useHaptics(options: UseHapticsOptions = {}): UseHapticsReturn {
  const { enabled = true } = options

  // Cache the support check to avoid repeated API queries
  const supportedRef = useRef<boolean | null>(null)

  // Lazily evaluate support status
  const getIsSupported = useCallback((): boolean => {
    if (supportedRef.current === null) {
      supportedRef.current = isVibrationSupported()
    }
    return supportedRef.current
  }, [])

  /**
   * Trigger haptic feedback with the specified type.
   * Defaults to 'light' if no type specified.
   */
  const trigger = useCallback(
    (type: HapticFeedbackType = 'light'): void => {
      // Early exit if disabled
      if (!enabled) {
        return
      }

      // Early exit if not supported
      if (!getIsSupported()) {
        return
      }

      // Get pattern for the requested type
      const pattern = HAPTIC_PATTERNS[type]
      if (!pattern) {
        console.warn(`Unknown haptic feedback type: ${type}`)
        return
      }

      // Trigger vibration
      vibrate(pattern)
    },
    [enabled, getIsSupported]
  )

  return {
    trigger,
    isSupported: getIsSupported(),
  }
}

// -----------------------------------------------------------------------------
// Standalone Trigger Function
// -----------------------------------------------------------------------------

/**
 * Standalone function to trigger haptic feedback without using the hook.
 * Useful for non-component contexts or one-off triggers.
 *
 * @example
 * ```ts
 * import { triggerHaptic } from '@/hooks/useHaptics'
 *
 * // In an event handler or utility function
 * triggerHaptic('success')
 * ```
 */
export function triggerHaptic(type: HapticFeedbackType = 'light'): boolean {
  if (!isVibrationSupported()) {
    return false
  }

  const pattern = HAPTIC_PATTERNS[type]
  if (!pattern) {
    console.warn(`Unknown haptic feedback type: ${type}`)
    return false
  }

  return vibrate(pattern)
}

/**
 * Cancel any ongoing vibration.
 * Call vibrate with 0 or empty array to stop.
 */
export function cancelHaptic(): void {
  if (!isVibrationSupported()) {
    return
  }

  try {
    navigator.vibrate(0)
  } catch (error) {
    console.debug('Cancel haptic failed:', error)
  }
}

// -----------------------------------------------------------------------------
// Default Export
// -----------------------------------------------------------------------------

export default useHaptics
