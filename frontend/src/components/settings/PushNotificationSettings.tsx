import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Smartphone, Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { getAuthToken, useAuth } from '@/lib/auth';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
  getPushStatus,
  type PushStatus,
} from '@/lib/pushNotifications';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';

export function PushNotificationSettings() {
  const { user } = useAuth();
  const token = user ? getAuthToken() : null;
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [status, setStatus] = useState<PushStatus>({
    supported: false,
    permission: 'default' as NotificationPermission | 'unsupported',
    subscribed: false,
    configured: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const pushActionRef = useRef(false);

  // Load initial status
  const loadStatus = useCallback(async () => {
    setLoadError(null);
    setError(null);

    if (!token) {
      // Still need to check local status even without token
      setStatus({
        supported: isPushSupported(),
        permission: getNotificationPermission(),
        subscribed: false,
        configured: false,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const pushStatus = await getPushStatus(token);
      setStatus(pushStatus);
    } catch (err) {
      logError('Failed to load push status:', err);
      setLoadError(extractErrorMessage(err, 'Failed to load push notification status'));
      // Set basic status on error
      setStatus({
        supported: isPushSupported(),
        permission: getNotificationPermission(),
        subscribed: false,
        configured: false,
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!isPushSupported()) return;

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        void loadStatus();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
  }, [loadStatus]);

  // Handle subscribe/unsubscribe
  const handleTogglePush = async () => {
    if (!token) return;
    if (pushActionRef.current || loadError || !status.configured) return;

    pushActionRef.current = true;
    setSubscribing(true);
    setError(null);
    setTestResult(null);

    try {
      if (status.subscribed) {
        // Unsubscribe
        const result = await unsubscribeFromPush(token);
        if (result.success) {
          setStatus((prev) => ({ ...prev, subscribed: false }));
        } else {
          setError(result.error || 'Failed to unsubscribe');
        }
      } else {
        // Subscribe
        const result = await subscribeToPush(token);
        if (result.success) {
          setStatus((prev) => ({ ...prev, subscribed: true, permission: 'granted' }));
        } else {
          setError(result.error || 'Failed to subscribe');
        }
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'An error occurred'));
    } finally {
      pushActionRef.current = false;
      setSubscribing(false);
    }
  };

  // Handle test notification
  const handleSendTest = async () => {
    if (!token) return;
    if (pushActionRef.current || loadError || !status.configured) return;

    pushActionRef.current = true;
    setSendingTest(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await sendTestPush(token);
      setTestResult({
        success: result.success,
        message: result.success
          ? result.message || 'Test notification sent!'
          : result.error || 'Failed to send test',
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: extractErrorMessage(err, 'An error occurred'),
      });
    } finally {
      pushActionRef.current = false;
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Push Notifications</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Smartphone className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Push Notifications</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Receive instant notifications on your device when important events occur, such as hold point
        releases, NCR assignments, and mentions.
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
              Your browser does not support push notifications. Try using Chrome, Firefox, Edge, or
              Safari (iOS 16.4+).
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
              You have blocked notifications for this site. To enable push notifications, click the
              lock icon in your browser's address bar and allow notifications.
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4"
        >
          <X className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="mt-3 px-3 py-1.5 rounded-lg text-sm border border-red-200 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {status.supported && !status.configured && !loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4"
        >
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Push Notifications Not Configured
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              {status.message ||
                'Push notifications require server VAPID keys before this device can subscribe.'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4"
        >
          <X className="h-5 w-5 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div
          role={testResult.success ? 'status' : 'alert'}
          className={`flex items-start gap-3 p-4 rounded-lg mb-4 ${
            testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          {testResult.success ? (
            <Check className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <X className="h-5 w-5 text-red-600 mt-0.5" />
          )}
          <p
            className={`text-sm ${
              testResult.success
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }`}
          >
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
                    : 'Enable to receive notifications when the app is closed'}
                </p>
              </div>
            </div>

            <button
              onClick={handleTogglePush}
              disabled={
                subscribing || !!loadError || !status.configured || status.permission === 'denied'
              }
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                status.subscribed
                  ? 'bg-muted text-foreground hover:bg-muted/80'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
              title={
                !status.configured
                  ? 'Push notifications are not configured on the server'
                  : undefined
              }
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
                <p className="text-sm font-medium text-foreground">Test Push Notification</p>
                <p className="text-xs text-muted-foreground">
                  Send a test notification to verify everything is working
                </p>
              </div>

              <button
                onClick={handleSendTest}
                disabled={sendingTest || !!loadError || !status.configured}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Test'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mobile Instructions */}
      <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <p className="text-sm font-medium text-primary mb-2">Mobile Device Setup</p>
        <ul className="text-sm text-primary/80 space-y-1 list-disc list-inside">
          <li>For best results, add SiteProof to your home screen</li>
          <li>On iOS 16.4+: Safari → Share → Add to Home Screen</li>
          <li>On Android: Chrome → Menu → Add to Home Screen</li>
          <li>Push notifications will then work even when the app is closed</li>
        </ul>
      </div>
    </div>
  );
}
