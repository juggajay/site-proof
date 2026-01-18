import { useState, useEffect } from 'react'
import { X, Sparkles, ChevronRight, CheckCircle2, Gift, Zap, Shield, FileText } from 'lucide-react'

// App version changelog - update this when new features are released
const APP_VERSION = '1.3.0'

interface ChangelogEntry {
  version: string
  date: string
  title: string
  highlights: {
    icon: 'feature' | 'improvement' | 'security' | 'docs'
    text: string
  }[]
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.3.0',
    date: '2026-01-18',
    title: "What's New in SiteProof",
    highlights: [
      { icon: 'feature', text: 'Onboarding tour for new users' },
      { icon: 'feature', text: 'Context-sensitive help on all pages' },
      { icon: 'feature', text: 'Keyboard shortcuts modal (press ?)' },
      { icon: 'improvement', text: 'Global quick search with Cmd+K' },
      { icon: 'improvement', text: 'Saved filters for lot register' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-01-15',
    title: 'Enhanced User Experience',
    highlights: [
      { icon: 'feature', text: 'User preference settings (theme, date format, timezone)' },
      { icon: 'feature', text: 'Dashboard widget customization' },
      { icon: 'feature', text: 'Column customization for lot register' },
      { icon: 'improvement', text: 'Improved responsive design for mobile' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-01-10',
    title: 'Quality Management Updates',
    highlights: [
      { icon: 'feature', text: 'NCR dispute workflow' },
      { icon: 'feature', text: 'Claim certification tracking with SOPA compliance' },
      { icon: 'security', text: 'Email verification for account registration' },
      { icon: 'improvement', text: 'Enhanced ITP photo attachments' },
    ],
  },
]

const CHANGELOG_STORAGE_KEY = 'siteproof_last_seen_version'

interface ChangelogNotificationProps {
  forceShow?: boolean // For testing
  onClose?: () => void
}

export function ChangelogNotification({ forceShow = false, onClose }: ChangelogNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [currentEntryIndex, setCurrentEntryIndex] = useState(0)

  // Check if user has seen the latest version
  useEffect(() => {
    if (forceShow) {
      setIsVisible(true)
      return
    }

    const lastSeenVersion = localStorage.getItem(CHANGELOG_STORAGE_KEY)

    // If no version stored or version is different from current, show changelog
    if (!lastSeenVersion || lastSeenVersion !== APP_VERSION) {
      // Find index of new entries to show
      const lastSeenIndex = CHANGELOG.findIndex(entry => entry.version === lastSeenVersion)
      const newEntriesCount = lastSeenIndex === -1 ? CHANGELOG.length : lastSeenIndex

      if (newEntriesCount > 0) {
        // Small delay to let the page render first
        const timer = setTimeout(() => setIsVisible(true), 800)
        return () => clearTimeout(timer)
      }
    }
  }, [forceShow])

  const handleDismiss = () => {
    localStorage.setItem(CHANGELOG_STORAGE_KEY, APP_VERSION)
    setIsVisible(false)
    onClose?.()
  }

  const handleNext = () => {
    if (currentEntryIndex < CHANGELOG.length - 1) {
      setCurrentEntryIndex(currentEntryIndex + 1)
    } else {
      handleDismiss()
    }
  }

  const handlePrev = () => {
    if (currentEntryIndex > 0) {
      setCurrentEntryIndex(currentEntryIndex - 1)
    }
  }

  const getIcon = (type: 'feature' | 'improvement' | 'security' | 'docs') => {
    switch (type) {
      case 'feature':
        return <Gift className="h-4 w-4 text-green-500" />
      case 'improvement':
        return <Zap className="h-4 w-4 text-blue-500" />
      case 'security':
        return <Shield className="h-4 w-4 text-amber-500" />
      case 'docs':
        return <FileText className="h-4 w-4 text-purple-500" />
    }
  }

  if (!isVisible) return null

  const currentEntry = CHANGELOG[currentEntryIndex]
  const isFirstEntry = currentEntryIndex === 0
  const isLastEntry = currentEntryIndex === CHANGELOG.length - 1

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-md rounded-xl border bg-card shadow-2xl overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-4 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">{currentEntry.title}</span>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-primary-foreground/80">
            <span>Version {currentEntry.version}</span>
            <span>•</span>
            <span>{new Date(currentEntry.date).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">New in this release:</h3>
          <ul className="space-y-3">
            {currentEntry.highlights.map((highlight, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0">{getIcon(highlight.icon)}</span>
                <span className="text-sm">{highlight.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <div className="flex items-center gap-2">
            {CHANGELOG.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentEntryIndex(index)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  index === currentEntryIndex
                    ? 'bg-primary'
                    : 'bg-muted hover:bg-muted-foreground/30'
                }`}
                aria-label={`Go to version ${CHANGELOG[index].version}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirstEntry && (
              <button
                onClick={handlePrev}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 rounded-lg bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {isLastEntry ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Got it!
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook to manage changelog state
export function useChangelog() {
  const [hasNewVersion, setHasNewVersion] = useState(false)

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem(CHANGELOG_STORAGE_KEY)
    setHasNewVersion(!lastSeenVersion || lastSeenVersion !== APP_VERSION)
  }, [])

  const markAsSeen = () => {
    localStorage.setItem(CHANGELOG_STORAGE_KEY, APP_VERSION)
    setHasNewVersion(false)
  }

  const resetChangelog = () => {
    localStorage.removeItem(CHANGELOG_STORAGE_KEY)
    setHasNewVersion(true)
  }

  return {
    hasNewVersion,
    currentVersion: APP_VERSION,
    changelog: CHANGELOG,
    markAsSeen,
    resetChangelog,
  }
}

// Export the current version for use in other components
export const CURRENT_APP_VERSION = APP_VERSION
