import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Clock, AlertTriangle } from 'lucide-react'

// Configuration
const INACTIVITY_WARNING_TIME = 15 * 60 * 1000 // 15 minutes until warning
const WARNING_COUNTDOWN_TIME = 60 * 1000 // 60 seconds to respond before auto-logout

// Test mode - shorter times for testing (use ?sessionTest=true in URL)
const TEST_INACTIVITY_WARNING_TIME = 5 * 1000 // 5 seconds until warning
const TEST_WARNING_COUNTDOWN_TIME = 10 * 1000 // 10 seconds countdown

// Events that count as activity
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

interface SessionTimeoutWarningProps {
  enabled?: boolean
}

export function SessionTimeoutWarning({ enabled = true }: SessionTimeoutWarningProps) {
  const { user, signOut } = useAuth()
  const [showWarning, setShowWarning] = useState(false)

  // Check for test mode via URL parameter
  const isTestMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sessionTest') === 'true'

  const inactivityTime = isTestMode ? TEST_INACTIVITY_WARNING_TIME : INACTIVITY_WARNING_TIME
  const countdownTime = isTestMode ? TEST_WARNING_COUNTDOWN_TIME : WARNING_COUNTDOWN_TIME

  const [countdown, setCountdown] = useState(countdownTime / 1000)

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  // Logout function
  const handleLogout = useCallback(async () => {
    setShowWarning(false)
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    await signOut()
  }, [signOut])

  // Reset the inactivity timer
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now()

    // Clear existing timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
    }

    // Only set timer if user is logged in and feature is enabled
    if (user && enabled) {
      inactivityTimerRef.current = setTimeout(() => {
        setShowWarning(true)
        setCountdown(countdownTime / 1000)

        // Start countdown
        countdownTimerRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              // Time's up - auto logout
              handleLogout()
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }, inactivityTime)
    }
  }, [user, enabled, inactivityTime, countdownTime, handleLogout])

  // Handle user activity
  const handleActivity = useCallback(() => {
    if (!showWarning) {
      resetInactivityTimer()
    }
  }, [showWarning, resetInactivityTimer])

  // Extend session (user clicked "Stay Logged In")
  const handleExtendSession = useCallback(() => {
    setShowWarning(false)
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
    }
    resetInactivityTimer()
  }, [resetInactivityTimer])

  // Set up activity listeners
  useEffect(() => {
    if (!user || !enabled) return

    // Add event listeners for activity tracking
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Initialize the timer
    resetInactivityTimer()

    // Cleanup
    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    }
  }, [user, enabled, handleActivity, resetInactivityTimer])

  // Don't render if no user or warning not shown
  if (!user || !showWarning) return null

  return (
    <Modal onClose={handleExtendSession} className="max-w-md w-full">
      <ModalHeader>
        <span className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
          Session Timeout Warning
        </span>
      </ModalHeader>

      <ModalBody>
        <p className="text-sm text-gray-500 mb-6">
          Your session is about to expire due to inactivity.
        </p>

        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-amber-100">
            <Clock className="h-10 w-10 text-amber-600" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">
              You will be logged out in
            </p>
            <p className="text-4xl font-bold text-amber-600 mt-2" data-testid="session-countdown">
              {countdown} seconds
            </p>
          </div>
          <p className="text-sm text-gray-500 text-center">
            Click "Stay Logged In" to continue your session, or you will be automatically logged out.
          </p>
        </div>
      </ModalBody>

      <ModalFooter>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          data-testid="logout-now-button"
        >
          Logout Now
        </button>
        <button
          onClick={handleExtendSession}
          className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          data-testid="stay-logged-in-button"
        >
          Stay Logged In
        </button>
      </ModalFooter>
    </Modal>
  )
}
