import { useTheme } from '@/lib/theme'
import { useDateFormat, DateFormat } from '@/lib/dateFormat'
import { useTimezone, TIMEZONES } from '@/lib/timezone'
import { Sun, Moon, Monitor, Check, Calendar, Clock, Globe } from 'lucide-react'

export function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { dateFormat, setDateFormat, formatDate } = useDateFormat()
  const { timezone, setTimezone, formatTime, formatDateTime } = useTimezone()

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

      {/* Placeholder for other settings sections */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Configure how you receive notifications.
          </p>
        </div>
        <p className="text-muted-foreground text-sm">
          Notification settings coming soon.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Privacy</h2>
          <p className="text-sm text-muted-foreground">
            Manage your privacy settings.
          </p>
        </div>
        <p className="text-muted-foreground text-sm">
          Privacy settings coming soon.
        </p>
      </div>
    </div>
  )
}
