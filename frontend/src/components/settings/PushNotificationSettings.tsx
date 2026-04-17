import { useState, useEffect } from 'react'
import { Bell, BellOff, Smartphone, Check, X, AlertTriangle, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
  getPushStatus
} from '@/lib/pushNotifications'
import { extractErrorMessage } from '@/lib/errorHandling'

export function PushNotificationSettings() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user: _user } = useAuth()
  const token = localStorage.getItem('auth_token')
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
      setError(extractErrorMessage(err, 'An error occurred'))
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
        message: extractErrorMessage(err, 'An error occurred')
      })
    } finally {
      setSendingTest(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Push Notifications
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Smartphone className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">
          Push Notifications
        </h3>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
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
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {status.subscribed ? (
                <Bell className="h-5 w-5 text-green-600" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {status.subscribed ? 'Push Notifications Enabled' : 'Push Notifications Disabled'}
                </p>
                <p className="text-xs text-muted-foreground">
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
                  ? 'bg-muted text-foreground hover:bg-muted/80'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
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
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Test Push Notification
                </p>
                <p className="text-xs text-muted-foreground">
                  Send a test notification to verify everything is working
                </p>
              </div>

              <button
                onClick={handleSendTest}
                disabled={sendingTest}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <p className="text-sm font-medium text-primary mb-2">
          Mobile Device Setup
        </p>
        <ul className="text-sm text-primary/80 space-y-1 list-disc list-inside">
          <li>For best results, add SiteProof to your home screen</li>
          <li>On iOS 16.4+: Safari → Share → Add to Home Screen</li>
          <li>On Android: Chrome → Menu → Add to Home Screen</li>
          <li>Push notifications will then work even when the app is closed</li>
        </ul>
      </div>
    </div>
  )
}
