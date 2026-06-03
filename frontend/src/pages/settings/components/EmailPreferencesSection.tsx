import { AlertTriangle, Bell, Check, Loader2, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { emailNotificationItems, type NotificationTiming } from '../emailPreferencesData';
import { useEmailPreferences } from '../useEmailPreferences';

export function EmailPreferencesSection() {
  const {
    preferences,
    isLoading,
    loadFailed,
    isSaving,
    isSendingTestEmail,
    message,
    reloadPreferences,
    togglePreference,
    changePreferenceTiming,
    sendTestEmail,
  } = useEmailPreferences();

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure which email notifications you receive.
          </p>
        </div>
        <Button
          onClick={sendTestEmail}
          disabled={isSendingTestEmail || isLoading || loadFailed || !preferences.enabled}
        >
          {isSendingTestEmail ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send Test Email
        </Button>
      </div>

      {/* Status Message */}
      {message && (
        <div
          role={message.type === 'success' ? 'status' : 'alert'}
          className={`flex items-center gap-2 text-sm px-4 py-2 rounded-md ${
            message.type === 'success'
              ? 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400'
              : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading preferences...
        </div>
      ) : loadFailed ? (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          <p>
            Email notification preferences could not be loaded. Existing preferences were not
            changed.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => reloadPreferences()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Enable Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => togglePreference('enabled')}
              disabled={isSaving}
              role="switch"
              aria-checked={preferences.enabled}
              aria-label="Enable email notifications"
              className={`relative w-12 h-6 rounded-full transition-colors ${
                preferences.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  preferences.enabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Individual Preferences with Timing Options */}
          <div
            className={`space-y-3 ${!preferences.enabled ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Notification Types</p>
              <p className="text-xs text-muted-foreground">Timing</p>
            </div>

            {emailNotificationItems.map((pref) => (
              <div key={pref.key} className="py-3 border-b border-border last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <p className="font-medium">{pref.label}</p>
                    <p className="text-sm text-muted-foreground">{pref.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Timing selector for supported notifications */}
                    {pref.supportsTiming && preferences[pref.key] && pref.timingKey && (
                      <NativeSelect
                        value={preferences[pref.timingKey] || 'immediate'}
                        onChange={(e) =>
                          changePreferenceTiming(
                            pref.timingKey!,
                            e.target.value as NotificationTiming,
                          )
                        }
                        disabled={isSaving}
                        className="text-xs px-2 py-1 h-auto min-w-[90px]"
                        aria-label={`${pref.label} notification timing`}
                        data-testid={`timing-${pref.key}`}
                      >
                        <option value="immediate">Immediate</option>
                        <option value="digest">Digest</option>
                      </NativeSelect>
                    )}
                    {/* Enable/disable toggle */}
                    <button
                      type="button"
                      onClick={() => togglePreference(pref.key)}
                      disabled={isSaving}
                      role="switch"
                      aria-checked={preferences[pref.key]}
                      aria-label={`${pref.label} email notifications`}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                        preferences[pref.key] ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          preferences[pref.key] ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
