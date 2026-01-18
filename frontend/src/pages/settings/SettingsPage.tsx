import { useTheme } from '@/lib/theme'
import { Sun, Moon, Monitor, Check } from 'lucide-react'

export function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun, description: 'Always use light mode' },
    { value: 'dark' as const, label: 'Dark', icon: Moon, description: 'Always use dark mode' },
    { value: 'system' as const, label: 'System', icon: Monitor, description: 'Match your system settings' },
  ]

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
