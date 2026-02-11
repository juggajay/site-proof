import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/lib/theme'
import { useDateFormat, DateFormat } from '@/lib/dateFormat'
import { useTimezone, TIMEZONES } from '@/lib/timezone'
import { getAuthToken, useAuth } from '@/lib/auth'
import { apiFetch, apiUrl } from '@/lib/api'
import { extractErrorMessage } from '@/lib/errorHandling'
import { Sun, Moon, Monitor, Check, Calendar, Globe, Download, Shield, Loader2, Trash2, AlertTriangle, Info, Building2, LogOut, Mail, Bell, Send, Lock, Smartphone, Key, Eye, EyeOff, Copy, CheckCircle2 } from 'lucide-react'
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings'

// App version info
const APP_VERSION = '1.3.0'
const BUILD_DATE = '2026-01-18'
const BUILD_NUMBER = '20260118.1'

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { dateFormat, setDateFormat, formatDate } = useDateFormat()
  const { timezone, setTimezone, formatTime } = useTimezone()
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState(false)

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Leave company state
  const [showLeaveCompanyModal, setShowLeaveCompanyModal] = useState(false)
  const [isLeavingCompany, setIsLeavingCompany] = useState(false)
  const [leaveCompanyError, setLeaveCompanyError] = useState<string | null>(null)

  // Notification timing type
  type NotificationTiming = 'immediate' | 'digest'

  // Email notification preferences state with timing options
  const [emailPreferences, setEmailPreferences] = useState({
    enabled: true,
    mentions: true,
    mentionsTiming: 'immediate' as NotificationTiming,
    ncrAssigned: true,
    ncrAssignedTiming: 'immediate' as NotificationTiming,
    ncrStatusChange: true,
    ncrStatusChangeTiming: 'digest' as NotificationTiming,  // Default to digest for NCR status changes
    holdPointReminder: true,
    holdPointReminderTiming: 'immediate' as NotificationTiming,
    holdPointRelease: true,
    holdPointReleaseTiming: 'immediate' as NotificationTiming,  // HP release - immediate by default
    commentReply: true,
    commentReplyTiming: 'immediate' as NotificationTiming,
    scheduledReports: true,
    scheduledReportsTiming: 'immediate' as NotificationTiming,
    dailyDigest: false,
  })

  // Slider state for hold point reminder days
  const [holdPointReminderDays, setHoldPointReminderDays] = useState(3)
  const [isLoadingEmailPrefs, setIsLoadingEmailPrefs] = useState(true)
  const [isSavingEmailPrefs, setIsSavingEmailPrefs] = useState(false)
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false)
  const [emailPrefsMessage, setEmailPrefsMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // MFA state (Feature #22, #420, #421)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [isLoadingMfa, setIsLoadingMfa] = useState(true)
  const [showMfaSetup, setShowMfaSetup] = useState(false)
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; qrCode: string } | null>(null)
  const [mfaVerifyCode, setMfaVerifyCode] = useState('')
  const [isMfaLoading, setIsMfaLoading] = useState(false)
  const [mfaMessage, setMfaMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [showDisableMfa, setShowDisableMfa] = useState(false)
  const [disableMfaPassword, setDisableMfaPassword] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun, description: 'Always use light mode' },
    { value: 'dark' as const, label: 'Dark', icon: Moon, description: 'Always use dark mode' },
    { value: 'system' as const, label: 'System', icon: Monitor, description: 'Match your system settings' },
  ]

  const dateFormatOptions: { value: DateFormat; label: string; example: string }[] = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '31/12/2024' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '12/31/2024' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2024-12-31' },
  ]

  // Load email notification preferences
  useEffect(() => {
    const loadEmailPreferences = async () => {
      try {
        const data = await apiFetch<{ preferences: typeof emailPreferences }>('/api/notifications/email-preferences')
        setEmailPreferences(data.preferences)
      } catch (err) {
        console.error('Failed to load email preferences:', err)
      } finally {
        setIsLoadingEmailPrefs(false)
      }
    }

    loadEmailPreferences()
  }, [])

  // Load MFA status (Feature #22)
  useEffect(() => {
    const loadMfaStatus = async () => {
      try {
        const data = await apiFetch<{ mfaEnabled: boolean }>('/api/mfa/status')
        setMfaEnabled(data.mfaEnabled)
      } catch (err) {
        console.error('Failed to load MFA status:', err)
      } finally {
        setIsLoadingMfa(false)
      }
    }

    loadMfaStatus()
  }, [])

  // MFA setup handler (Feature #420)
  const handleMfaSetup = async () => {
    setIsMfaLoading(true)
    setMfaMessage(null)

    try {
      const data = await apiFetch<{ secret: string; qrCode: string; message?: string }>('/api/mfa/setup', {
        method: 'POST',
      })
      setMfaSetupData({ secret: data.secret, qrCode: data.qrCode })
      setShowMfaSetup(true)
    } catch (err) {
      setMfaMessage({ type: 'error', text: 'Failed to start MFA setup' })
    } finally {
      setIsMfaLoading(false)
    }
  }

  // MFA verify setup handler (Feature #420)
  const handleMfaVerify = async () => {
    if (!mfaVerifyCode || mfaVerifyCode.length !== 6) {
      setMfaMessage({ type: 'error', text: 'Please enter a 6-digit code' })
      return
    }

    setIsMfaLoading(true)
    setMfaMessage(null)

    try {
      const data = await apiFetch<{ backupCodes?: string[]; message?: string }>('/api/mfa/verify-setup', {
        method: 'POST',
        body: JSON.stringify({ code: mfaVerifyCode }),
      })
      setMfaEnabled(true)
      setBackupCodes(data.backupCodes || [])
      setShowBackupCodes(true)
      setShowMfaSetup(false)
      setMfaSetupData(null)
      setMfaVerifyCode('')
      setMfaMessage({ type: 'success', text: 'Two-factor authentication enabled!' })
    } catch (err) {
      setMfaMessage({ type: 'error', text: 'Failed to verify code' })
    } finally {
      setIsMfaLoading(false)
    }
  }

  // MFA disable handler (Feature #22)
  const handleMfaDisable = async () => {
    setIsMfaLoading(true)
    setMfaMessage(null)

    try {
      await apiFetch('/api/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ password: disableMfaPassword }),
      })
      setMfaEnabled(false)
      setShowDisableMfa(false)
      setDisableMfaPassword('')
      setMfaMessage({ type: 'success', text: 'Two-factor authentication disabled' })
    } catch (err) {
      setMfaMessage({ type: 'error', text: 'Failed to disable MFA' })
    } finally {
      setIsMfaLoading(false)
    }
  }

  // Copy secret to clipboard
  const copySecret = () => {
    if (mfaSetupData?.secret) {
      navigator.clipboard.writeText(mfaSetupData.secret)
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2000)
    }
  }

  // Save email notification preferences with optimistic update
  const saveEmailPreferences = async (newPreferences: typeof emailPreferences, previousPreferences: typeof emailPreferences) => {
    setIsSavingEmailPrefs(true)
    setEmailPrefsMessage(null)

    try {
      await apiFetch('/api/notifications/email-preferences', {
        method: 'PUT',
        body: JSON.stringify({ preferences: newPreferences }),
      })
      // Server confirmed, keep the optimistic update
      setEmailPrefsMessage({ type: 'success', text: 'Email preferences saved' })
      setTimeout(() => setEmailPrefsMessage(null), 3000)
    } catch (err) {
      // Error occurred, rollback to previous state
      setEmailPreferences(previousPreferences)
      setEmailPrefsMessage({ type: 'error', text: 'Failed to save email preferences - changes reverted' })
    } finally {
      setIsSavingEmailPrefs(false)
    }
  }

  // Toggle email preference with optimistic update
  const toggleEmailPreference = (key: keyof typeof emailPreferences) => {
    // Store previous state for potential rollback
    const previousPreferences = { ...emailPreferences }
    // Optimistically update UI immediately
    const newPreferences = { ...emailPreferences, [key]: !emailPreferences[key] }
    setEmailPreferences(newPreferences)
    // Then persist to server (will rollback on error)
    saveEmailPreferences(newPreferences, previousPreferences)
  }

  // Send test email
  const sendTestEmail = async () => {
    setIsSendingTestEmail(true)
    setEmailPrefsMessage(null)

    try {
      const data = await apiFetch<{ sentTo: string }>('/api/notifications/send-test-email', {
        method: 'POST',
      })
      setEmailPrefsMessage({ type: 'success', text: `Test email sent to ${data.sentTo}` })
      setTimeout(() => setEmailPrefsMessage(null), 5000)
    } catch (err) {
      setEmailPrefsMessage({ type: 'error', text: 'Failed to send test email' })
    } finally {
      setIsSendingTestEmail(false)
    }
  }

  // GDPR Data Export function
  const handleExportData = async () => {
    setIsExporting(true)
    setExportError(null)
    setExportSuccess(false)

    try {
      const token = getAuthToken()
      if (!token) {
        setExportError('You must be logged in to export data')
        return
      }

      const response = await fetch(apiUrl('/api/auth/export-data'), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to export data')
      }

      // Get the filename from the Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `siteproof-data-export-${new Date().toISOString().split('T')[0]}.json`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) {
          filename = match[1]
        }
      }

      // Convert response to blob and trigger download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setExportSuccess(true)
      // Clear success message after 5 seconds
      setTimeout(() => setExportSuccess(false), 5000)
    } catch (error) {
      console.error('Export error:', error)
      setExportError('Failed to export data. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (!deleteConfirmEmail) {
      setDeleteError('Please enter your email to confirm deletion')
      return
    }

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await apiFetch('/api/auth/delete-account', {
        method: 'DELETE',
        body: JSON.stringify({
          confirmEmail: deleteConfirmEmail,
          password: deletePassword,
        }),
      })

      // Account deleted successfully - sign out and redirect
      signOut()
      navigate('/login', { state: { message: 'Your account has been successfully deleted.' } })
    } catch (error) {
      console.error('Delete account error:', error)
      setDeleteError(extractErrorMessage(error, 'Failed to delete account. Please try again.'))
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle leaving company
  const handleLeaveCompany = async () => {
    setIsLeavingCompany(true)
    setLeaveCompanyError(null)

    try {
      await apiFetch('/api/company/leave', {
        method: 'POST',
      })

      // Successfully left company - reload to refresh user data
      setShowLeaveCompanyModal(false)
      window.location.reload()
    } catch (error) {
      console.error('Leave company error:', error)
      setLeaveCompanyError(extractErrorMessage(error, 'Failed to leave company. Please try again.'))
    } finally {
      setIsLeavingCompany(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application settings.
        </p>
      </div>

      {/* Appearance Section */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">
            Customize how SiteProof looks on your device.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">Theme</label>
          <div className="grid gap-3 sm:grid-cols-3">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const isSelected = theme === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={`p-3 rounded-full ${
                    isSelected ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    <Icon className={`h-6 w-6 ${
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Current theme: {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
            {theme === 'system' && ' (following system preference)'}
          </p>
        </div>
      </div>

      {/* Regional Settings Section */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Regional Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure date, time, and timezone preferences.
          </p>
        </div>

        {/* Date Format */}
        <div>
          <label className="block text-sm font-medium mb-3">Date Format</label>
          <div className="grid gap-3 sm:grid-cols-3">
            {dateFormatOptions.map((option) => {
              const isSelected = dateFormat === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => setDateFormat(option.value)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={`p-3 rounded-full ${
                    isSelected ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    <Calendar className={`h-6 w-6 ${
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">
                      e.g., {option.example}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Preview: Today's date would be displayed as <span className="font-mono font-medium">{formatDate(new Date())}</span>
          </p>
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium mb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Timezone
            </div>
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full max-w-md rounded-md border bg-background px-3 py-2"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label} (UTC{tz.offset})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-3">
            Current time in selected timezone: <span className="font-mono font-medium">{formatTime(new Date())}</span>
          </p>
        </div>
      </div>

      {/* Email Notification Settings */}
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
          <button
            onClick={sendTestEmail}
            disabled={isSendingTestEmail || !emailPreferences.enabled}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSendingTestEmail ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Test Email
          </button>
        </div>

        {/* Status Message */}
        {emailPrefsMessage && (
          <div className={`flex items-center gap-2 text-sm px-4 py-2 rounded-md ${
            emailPrefsMessage.type === 'success'
              ? 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400'
              : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
          }`}>
            {emailPrefsMessage.type === 'success' ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {emailPrefsMessage.text}
          </div>
        )}

        {isLoadingEmailPrefs ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading preferences...
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
                onClick={() => toggleEmailPreference('enabled')}
                disabled={isSavingEmailPrefs}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  emailPreferences.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  emailPreferences.enabled ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Individual Preferences with Timing Options */}
            <div className={`space-y-3 ${!emailPreferences.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Notification Types</p>
                <p className="text-xs text-muted-foreground">Timing</p>
              </div>

              {[
                { key: 'mentions' as const, timingKey: 'mentionsTiming' as const, label: 'Mentions', description: 'When someone @mentions you in a comment', supportsTiming: true },
                { key: 'ncrAssigned' as const, timingKey: 'ncrAssignedTiming' as const, label: 'NCR Assigned', description: 'When you are assigned to an NCR', supportsTiming: true },
                { key: 'ncrStatusChange' as const, timingKey: 'ncrStatusChangeTiming' as const, label: 'NCR Status Changes', description: 'When an NCR you\'re involved with changes status', supportsTiming: true },
                { key: 'holdPointReminder' as const, timingKey: 'holdPointReminderTiming' as const, label: 'Hold Point Reminders', description: 'Reminders for upcoming hold points', supportsTiming: true },
                { key: 'holdPointRelease' as const, timingKey: 'holdPointReleaseTiming' as const, label: 'Hold Point Released', description: 'When a hold point is released', supportsTiming: true },
                { key: 'commentReply' as const, timingKey: 'commentReplyTiming' as const, label: 'Comment Replies', description: 'When someone replies to your comment', supportsTiming: true },
                { key: 'scheduledReports' as const, timingKey: 'scheduledReportsTiming' as const, label: 'Scheduled Reports', description: 'Delivery of scheduled report emails', supportsTiming: false },
                { key: 'dailyDigest' as const, timingKey: null, label: 'Daily Digest', description: 'Receive digest emails at your preferred time', supportsTiming: false },
              ].map((pref) => (
                <div key={pref.key} className="py-3 border-b border-border last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <p className="font-medium">{pref.label}</p>
                      <p className="text-sm text-muted-foreground">{pref.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Timing selector for supported notifications */}
                      {pref.supportsTiming && emailPreferences[pref.key] && pref.timingKey && (
                        <select
                          value={emailPreferences[pref.timingKey] || 'immediate'}
                          onChange={(e) => {
                            const previousPreferences = { ...emailPreferences }
                            const newPreferences = { ...emailPreferences, [pref.timingKey!]: e.target.value as NotificationTiming }
                            setEmailPreferences(newPreferences)
                            saveEmailPreferences(newPreferences, previousPreferences)
                          }}
                          disabled={isSavingEmailPrefs}
                          className="text-xs px-2 py-1 rounded border bg-background min-w-[90px]"
                          data-testid={`timing-${pref.key}`}
                        >
                          <option value="immediate">Immediate</option>
                          <option value="digest">Digest</option>
                        </select>
                      )}
                      {/* Enable/disable toggle */}
                      <button
                        onClick={() => toggleEmailPreference(pref.key)}
                        disabled={isSavingEmailPrefs}
                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                          emailPreferences[pref.key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          emailPreferences[pref.key] ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Hold Point Reminder Days Slider */}
              {emailPreferences.holdPointReminder && (
                <div className="py-4 border-t border-border">
                  <div className="mb-3">
                    <p className="font-medium">Hold Point Reminder Timing</p>
                    <p className="text-sm text-muted-foreground">
                      Receive reminders this many days before a hold point is due
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="14"
                      value={holdPointReminderDays}
                      onChange={(e) => setHoldPointReminderDays(Number(e.target.value))}
                      className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700 accent-blue-600"
                      data-testid="reminder-days-slider"
                    />
                    <span
                      className="min-w-[60px] text-center font-semibold text-lg px-3 py-1 rounded-md bg-muted"
                      data-testid="reminder-days-value"
                    >
                      {holdPointReminderDays} {holdPointReminderDays === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1 day</span>
                    <span>14 days</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Push Notification Settings (Feature #657) */}
      <PushNotificationSettings />

      {/* Security Section - Two-Factor Authentication (Feature #22, #420, #421) */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your account security settings.
          </p>
        </div>

        {/* MFA Status Message */}
        {mfaMessage && (
          <div className={`flex items-center gap-2 text-sm px-4 py-2 rounded-md ${
            mfaMessage.type === 'success'
              ? 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400'
              : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
          }`}>
            {mfaMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {mfaMessage.text}
          </div>
        )}

        {/* Two-Factor Authentication */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Two-Factor Authentication (2FA)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add an extra layer of security to your account. When enabled, you'll need to enter a code from your authenticator app when signing in.
          </p>

          {isLoadingMfa ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading security settings...
            </div>
          ) : mfaEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-300">Two-Factor Authentication Enabled</p>
                    <p className="text-sm text-green-600 dark:text-green-400">Your account is protected with 2FA</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowDisableMfa(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Lock className="h-4 w-4" />
                Disable 2FA
              </button>
            </div>
          ) : (
            <button
              onClick={handleMfaSetup}
              disabled={isMfaLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMfaLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Key className="h-4 w-4" />
              )}
              Enable Two-Factor Authentication
            </button>
          )}
        </div>
      </div>

      {/* MFA Setup Modal */}
      {showMfaSetup && mfaSetupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg shadow-xl w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-primary/10">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Set Up Two-Factor Authentication</h2>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">1. Install an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator.</p>
                <p>2. Scan the QR code below with your authenticator app:</p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={mfaSetupData.qrCode} alt="MFA QR Code" className="w-48 h-48" />
              </div>

              {/* Manual Entry */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Can't scan? Enter this code manually:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm bg-background px-2 py-1 rounded break-all">
                    {showSecret ? mfaSetupData.secret : '••••••••••••••••••••••••••••••••'}
                  </code>
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-1 hover:bg-background rounded"
                    title={showSecret ? 'Hide secret' : 'Show secret'}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={copySecret}
                    className="p-1 hover:bg-background rounded"
                    title="Copy to clipboard"
                  >
                    {copiedSecret ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Verification Code Input */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  3. Enter the 6-digit code from your authenticator:
                </label>
                <input
                  type="text"
                  value={mfaVerifyCode}
                  onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-md border bg-background px-3 py-2 text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>

              {/* Error message */}
              {mfaMessage?.type === 'error' && (
                <div className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  {mfaMessage.text}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowMfaSetup(false)
                    setMfaSetupData(null)
                    setMfaVerifyCode('')
                    setMfaMessage(null)
                  }}
                  disabled={isMfaLoading}
                  className="flex-1 px-4 py-2 rounded-lg border hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMfaVerify}
                  disabled={isMfaLoading || mfaVerifyCode.length !== 6}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {isMfaLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Enable'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Codes Modal */}
      {showBackupCodes && backupCodes.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold">2FA Enabled Successfully!</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">
                  Important: Save your backup codes!
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  If you lose access to your authenticator app, you can use these codes to regain access to your account. Each code can only be used once.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
                {backupCodes.map((code, index) => (
                  <code key={index} className="font-mono text-sm text-center py-1">
                    {code}
                  </code>
                ))}
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(backupCodes.join('\n'))
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted"
              >
                <Copy className="h-4 w-4" />
                Copy All Codes
              </button>

              <button
                onClick={() => {
                  setShowBackupCodes(false)
                  setBackupCodes([])
                }}
                className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                I've Saved My Codes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable MFA Modal */}
      {showDisableMfa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold">Disable Two-Factor Authentication</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Warning:</strong> Disabling 2FA will make your account less secure. Are you sure you want to continue?
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Enter your password to confirm:
                </label>
                <input
                  type="password"
                  value={disableMfaPassword}
                  onChange={(e) => setDisableMfaPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full rounded-md border bg-background px-3 py-2"
                />
              </div>

              {mfaMessage?.type === 'error' && (
                <div className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  {mfaMessage.text}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDisableMfa(false)
                    setDisableMfaPassword('')
                    setMfaMessage(null)
                  }}
                  disabled={isMfaLoading}
                  className="flex-1 px-4 py-2 rounded-lg border hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMfaDisable}
                  disabled={isMfaLoading || !disableMfaPassword}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {isMfaLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Disabling...
                    </>
                  ) : (
                    'Disable 2FA'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Data
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your privacy settings and download your data.
          </p>
        </div>

        {/* Privacy Policy Link */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-2">Privacy Policy</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Learn how we collect, use, and protect your personal information.
          </p>
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <Shield className="h-4 w-4" />
            View Privacy Policy
          </a>
        </div>

        {/* Data Export Section */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-2">Export Your Data</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Download a copy of all your data stored in SiteProof. This includes your profile information,
            project memberships, NCRs, daily diaries, test results, and activity logs.
            The data is exported in a portable JSON format.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed w-fit"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing Export...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export My Data
                </>
              )}
            </button>

            {exportSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                Data exported successfully! Check your downloads folder.
              </div>
            )}

            {exportError && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {exportError}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Your data export includes: user profile, company information, project memberships,
            NCRs created or assigned to you, daily diaries, ITP completions, test results,
            lots you created, and your activity log.
          </p>
        </div>

        {/* Delete Account Section */}
        <div className="border-t pt-4 mt-6">
          <h3 className="text-lg font-medium mb-2 flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
            Before deleting, we recommend exporting your data above.
          </p>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 w-fit"
          >
            <Trash2 className="h-4 w-4" />
            Delete My Account
          </button>
        </div>
      </div>

      {/* Company Membership Section - only show if user has a company */}
      {user?.companyId && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Membership
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage your company membership settings.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Company</p>
                <p className="text-lg font-semibold">{user?.companyName || 'Unknown Company'}</p>
              </div>
              <div className="p-2 rounded-full bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-2 flex items-center gap-2 text-amber-600">
              <LogOut className="h-5 w-5" />
              Leave Company
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Remove yourself from this company. You will lose access to all company projects and data.
              This action cannot be undone.
            </p>

            <button
              onClick={() => setShowLeaveCompanyModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20 w-fit"
            >
              <LogOut className="h-4 w-4" />
              Leave Company
            </button>
          </div>
        </div>
      )}

      {/* About Section */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Info className="h-5 w-5" />
            About SiteProof
          </h2>
          <p className="text-sm text-muted-foreground">
            Application version and build information.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Version</p>
            <p className="text-lg font-semibold">{APP_VERSION}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Build Date</p>
            <p className="text-lg font-semibold">{BUILD_DATE}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Build Number</p>
            <p className="text-lg font-mono">{BUILD_NUMBER}</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>SiteProof is a civil construction quality management platform.</p>
          <p className="mt-2">© {new Date().getFullYear()} SiteProof. All rights reserved.</p>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold">Delete Account</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Warning:</strong> This will permanently delete your account and all associated data including:
                </p>
                <ul className="text-sm text-red-700 dark:text-red-300 mt-2 list-disc list-inside space-y-1">
                  <li>Your profile and settings</li>
                  <li>All project memberships</li>
                  <li>ITP completions you've made</li>
                  <li>Other user-created content</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Type your email to confirm: <span className="text-muted-foreground">{user?.email}</span>
                </label>
                <input
                  type="email"
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-md border bg-background px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Enter your password (optional)
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-md border bg-background px-3 py-2"
                />
              </div>

              {deleteError && (
                <div className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeleteConfirmEmail('')
                    setDeletePassword('')
                    setDeleteError(null)
                  }}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 rounded-lg border hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || !deleteConfirmEmail}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Permanently Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leave Company Confirmation Modal */}
      {showLeaveCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <h2 className="text-xl font-semibold">Leave Company</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Warning:</strong> Leaving <strong>{user?.companyName}</strong> will:
                </p>
                <ul className="text-sm text-amber-700 dark:text-amber-300 mt-2 list-disc list-inside space-y-1">
                  <li>Remove your access to all company projects</li>
                  <li>Remove you from all project teams</li>
                  <li>Revoke access to company documents</li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground">
                Are you sure you want to leave this company? You will need to be re-invited to rejoin.
              </p>

              {leaveCompanyError && (
                <div className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  {leaveCompanyError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowLeaveCompanyModal(false)
                    setLeaveCompanyError(null)
                  }}
                  disabled={isLeavingCompany}
                  className="flex-1 px-4 py-2 rounded-lg border hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeaveCompany}
                  disabled={isLeavingCompany}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {isLeavingCompany ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Leaving...
                    </>
                  ) : (
                    'Leave Company'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
