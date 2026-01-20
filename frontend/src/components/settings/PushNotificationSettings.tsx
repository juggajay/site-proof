import { useState, useEffect } from 'react'
import { Bell, BellOff, Smartphone, Check, X, AlertTriangle, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribedToPush,
  sendTestPush,
  getPushStatus
} from '@/lib/pushNotifications'

export function PushNotificationSettings() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [status, setStatus] = useState({
    supported: false,
    permission: 'default' as NotificationPermission | 'unsupported',
    subscribed: false,
    configured: false
  })
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Load initial status
  useEffect(() => {
    async function loadStatus() {
      if (!token) {
        // Still need to check local status even without token
        setStatus({
          supported: isPushSupported(),
          permission: getNotificationPermission(),
          subscribed: false,
          configured: false
        })
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const pushStatus = await getPushStatus(token)
        setStatus(pushStatus)
      } catch (err) {
        console.error('Failed to load push status:', err)
        // Set basic status on error
        setStatus({
          supported: isPushSupported(),
          permission: getNotificationPermission(),
          subscribed: false,
          configured: false
        })
      } finally {
        setLoading(false)
      }
    }
    loadStatus()
  }, [token])

  // Handle subscribe/unsubscribe
  const handleTogglePush = async () => {
    if (!token) return

    setSubscribing(true)
    setError(null)
    setTestResult(null)

    try {
      if (status.subscribed) {
        // Unsubscribe
        const result = await unsubscribeFromPush(token)
        if (result.success) {
          setStatus(prev => ({ ...prev, subscribed: false }))
        } else {
          setError(result.error || 'Failed to unsubscribe')
        }
      } else {
        // Subscribe
        const result = await subscribeToPush(token)
        if (result.success) {
          setStatus(prev => ({ ...prev, subscribed: true, permission: 'granted' }))
        } else {
          setError(result.error || 'Failed to subscribe')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubscribing(false)
    }
  }

  // Handle test notification
  const handleSendTest = async () => {
    if (!token) return

    setSendingTest(true)
    setError(null)
    setTestResult(null)

    try {
      const result = await sendTestPush(token)
      setTestResult({
        success: result.success,
        message: result.success
          ? result.message || 'Test notification sent!'
          : result.error || 'Failed to send test'
      })
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'An error occurred'
      })
    } finally {
      setSendingTest(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Push Notifications
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-500">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Smartphone className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Push Notifications
        </h3>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Receive instant notifications on your device when important events occur,
        such as hold point releases, NCR assignments, and mentions.
      </p>

      {/* Browser Support Check */}
      {!status.supported && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Push Notifications Not Supported
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Your browser does not support push notifications. Try using Chrome, Firefox, Edge, or Safari (iOS 16.4+).
            </p>
          </div>
        </div>
      )}

      {/* Permission Denied */}
      {status.supported && status.permission === 'denied' && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
          <X className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Notifications Blocked
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              You have blocked notifications for this site. To enable push notifications,
              click the lock icon in your browser's address bar and allow notifications.
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
          <X className="h-5 w-5 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div className={`flex items-start gap-3 p-4 rounded-lg mb-4 ${
          testResult.success
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          {testResult.success ? (
            <Check className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <X className="h-5 w-5 text-red-600 mt-0.5" />
          )}
          <p className={`text-sm ${
            testResult.success
              ? 'text-green-700 dark:text-green-300'
              : 'text-red-700 dark:text-red-300'
          }`}>
            {testResult.message}
          </p>
        </div>
      )}

      {/* Status Display */}
      {status.supported && (
        <div className="space-y-4">
          {/* Subscription Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              {status.subscribed ? (
                <Bell className="h-5 w-5 text-green-600" />
              ) : (
                <BellOff className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {status.subscribed ? 'Push Notifications Enabled' : 'Push Notifications Disabled'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {status.subscribed
                    ? 'You will receive push notifications on this device'
                    : 'Enable to receive notifications when the app is closed'
                  }
                </p>
              </div>
            </div>

            <button
              onClick={handleTogglePush}
              disabled={subscribing || status.permission === 'denied'}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                status.subscribed
                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {subscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : status.subscribed ? (
                'Disable'
              ) : (
                'Enable'
              )}
            </button>
          </div>

          {/* Test Notification Button */}
          {status.subscribed && (
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Test Push Notification
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Send a test notification to verify everything is working
                </p>
              </div>

              <button
                onClick={handleSendTest}
                disabled={sendingTest}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingTest ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Send Test'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mobile Instructions */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          Mobile Device Setup
        </p>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li>For best results, add SiteProof to your home screen</li>
          <li>On iOS 16.4+: Safari → Share → Add to Home Screen</li>
          <li>On Android: Chrome → Menu → Add to Home Screen</li>
          <li>Push notifications will then work even when the app is closed</li>
        </ul>
      </div>
    </div>
  )
}
