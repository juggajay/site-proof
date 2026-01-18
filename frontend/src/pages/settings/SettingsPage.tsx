import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/lib/theme'
import { useDateFormat, DateFormat } from '@/lib/dateFormat'
import { useTimezone, TIMEZONES } from '@/lib/timezone'
import { getAuthToken, useAuth } from '@/lib/auth'
import { Sun, Moon, Monitor, Check, Calendar, Globe, Download, Shield, Loader2, Trash2, AlertTriangle, Info, Building2, LogOut, Mail, Bell, Send } from 'lucide-react'

// App version info
const APP_VERSION = '1.3.0'
const BUILD_DATE = '2026-01-18'
const BUILD_NUMBER = '20260118.1'

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { dateFormat, setDateFormat, formatDate } = useDateFormat()
  const { timezone, setTimezone, formatTime, formatDateTime } = useTimezone()
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

  // Email notification preferences state
  const [emailPreferences, setEmailPreferences] = useState({
    enabled: true,
    mentions: true,
    ncrAssigned: true,
    ncrStatusChange: true,
    holdPointReminder: true,
    commentReply: true,
    scheduledReports: true,
    dailyDigest: false,
  })
  const [isLoadingEmailPrefs, setIsLoadingEmailPrefs] = useState(true)
  const [isSavingEmailPrefs, setIsSavingEmailPrefs] = useState(false)
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false)
  const [emailPrefsMessage, setEmailPrefsMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

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

  // Get current timezone label
  const currentTimezoneInfo = TIMEZONES.find(tz => tz.value === timezone)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4015'

  // Load email notification preferences
  useEffect(() => {
    const loadEmailPreferences = async () => {
      try {
        const token = getAuthToken()
        if (!token) return

        const response = await fetch(`${apiUrl}/api/notifications/email-preferences`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.ok) {
          const data = await response.json()
          setEmailPreferences(data.preferences)
        }
      } catch (err) {
        console.error('Failed to load email preferences:', err)
      } finally {
        setIsLoadingEmailPrefs(false)
      }
    }

    loadEmailPreferences()
  }, [])

  // Save email notification preferences
  const saveEmailPreferences = async (newPreferences: typeof emailPreferences) => {
    setIsSavingEmailPrefs(true)
    setEmailPrefsMessage(null)

    try {
      const token = getAuthToken()
      if (!token) {
        setEmailPrefsMessage({ type: 'error', text: 'You must be logged in to update preferences' })
        return
      }

      const response = await fetch(`${apiUrl}/api/notifications/email-preferences`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences: newPreferences }),
      })

      if (response.ok) {
        setEmailPreferences(newPreferences)
        setEmailPrefsMessage({ type: 'success', text: 'Email preferences saved' })
        setTimeout(() => setEmailPrefsMessage(null), 3000)
      } else {
        throw new Error('Failed to save preferences')
      }
    } catch (err) {
      setEmailPrefsMessage({ type: 'error', text: 'Failed to save email preferences' })
    } finally {
      setIsSavingEmailPrefs(false)
    }
  }

  // Toggle email preference
  const toggleEmailPreference = (key: keyof typeof emailPreferences) => {
    const newPreferences = { ...emailPreferences, [key]: !emailPreferences[key] }
    saveEmailPreferences(newPreferences)
  }

  // Send test email
  const sendTestEmail = async () => {
    setIsSendingTestEmail(true)
    setEmailPrefsMessage(null)

    try {
      const token = getAuthToken()
      if (!token) {
        setEmailPrefsMessage({ type: 'error', text: 'You must be logged in to send test email' })
        return
      }

      const response = await fetch(`${apiUrl}/api/notifications/send-test-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        setEmailPrefsMessage({ type: 'success', text: `Test email sent to ${data.sentTo}` })
        setTimeout(() => setEmailPrefsMessage(null), 5000)
      } else {
        setEmailPrefsMessage({ type: 'error', text: data.error || 'Failed to send test email' })
      }
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

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4015'
      const response = await fetch(`${apiUrl}/api/auth/export-data`, {
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
      const token = getAuthToken()
      if (!token) {
        setDeleteError('You must be logged in to delete your account')
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4015'
      const response = await fetch(`${apiUrl}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmEmail: deleteConfirmEmail,
          password: deletePassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete account')
      }

      // Account deleted successfully - sign out and redirect
      signOut()
      navigate('/login', { state: { message: 'Your account has been successfully deleted.' } })
    } catch (error) {
      console.error('Delete account error:', error)
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete account. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle leaving company
  const handleLeaveCompany = async () => {
    setIsLeavingCompany(true)
    setLeaveCompanyError(null)

    try {
      const token = getAuthToken()
      if (!token) {
        setLeaveCompanyError('You must be logged in to leave the company')
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4015'
      const response = await fetch(`${apiUrl}/api/company/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to leave company')
      }

      // Successfully left company - reload to refresh user data
      setShowLeaveCompanyModal(false)
      window.location.reload()
    } catch (error) {
      console.error('Leave company error:', error)
      setLeaveCompanyError(error instanceof Error ? error.message : 'Failed to leave company. Please try again.')
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

            {/* Individual Preferences */}
            <div className={`space-y-3 ${!emailPreferences.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <p className="text-sm font-medium text-muted-foreground">Notification Types</p>

              {[
                { key: 'mentions' as const, label: 'Mentions', description: 'When someone @mentions you in a comment' },
                { key: 'ncrAssigned' as const, label: 'NCR Assigned', description: 'When you are assigned to an NCR' },
                { key: 'ncrStatusChange' as const, label: 'NCR Status Changes', description: 'When an NCR you\'re involved with changes status' },
                { key: 'holdPointReminder' as const, label: 'Hold Point Reminders', description: 'Reminders for upcoming hold points' },
                { key: 'commentReply' as const, label: 'Comment Replies', description: 'When someone replies to your comment' },
                { key: 'scheduledReports' as const, label: 'Scheduled Reports', description: 'Delivery of scheduled report emails' },
                { key: 'dailyDigest' as const, label: 'Daily Digest', description: 'Receive all notifications in a single daily summary email' },
              ].map((pref) => (
                <div key={pref.key} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div>
                    <p className="font-medium">{pref.label}</p>
                    <p className="text-sm text-muted-foreground">{pref.description}</p>
                  </div>
                  <button
                    onClick={() => toggleEmailPreference(pref.key)}
                    disabled={isSavingEmailPrefs}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      emailPreferences[pref.key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      emailPreferences[pref.key] ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
