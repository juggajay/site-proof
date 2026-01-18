import { createContext, useContext, useState, ReactNode } from 'react'

// Common timezones
export const TIMEZONES = [
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)', offset: '+10/+11' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)', offset: '+10' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEDT/AEST)', offset: '+10/+11' },
  { value: 'Australia/Perth', label: 'Perth (AWST)', offset: '+8' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACDT/ACST)', offset: '+9:30/+10:30' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)', offset: '+12/+13' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: '+8' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+9' },
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: '+0/+1' },
  { value: 'America/New_York', label: 'New York (EST/EDT)', offset: '-5/-4' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)', offset: '-8/-7' },
  { value: 'UTC', label: 'UTC', offset: '+0' },
] as const

export type TimezoneValue = typeof TIMEZONES[number]['value']

interface TimezoneContextValue {
  timezone: string
  setTimezone: (tz: string) => void
  formatTime: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string
  formatDateTime: (date: Date | string) => string
}

const TimezoneContext = createContext<TimezoneContextValue | undefined>(undefined)

const TIMEZONE_STORAGE_KEY = 'siteproof_timezone'

// Get user's local timezone as default
function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'Australia/Sydney' // Fallback
  }
}

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState<string>(() => {
    if (typeof window === 'undefined') return getLocalTimezone()
    try {
      const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY)
      if (stored) {
        return stored
      }
    } catch (e) {
      console.error('Error loading timezone:', e)
    }
    return getLocalTimezone()
  })

  const setTimezone = (newTimezone: string) => {
    setTimezoneState(newTimezone)
    try {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, newTimezone)
    } catch (e) {
      console.error('Error saving timezone:', e)
    }
  }

  const formatTime = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return 'Invalid time'

    try {
      return d.toLocaleTimeString('en-AU', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        ...options,
      })
    } catch {
      return d.toLocaleTimeString()
    }
  }

  const formatDateTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return 'Invalid date'

    try {
      return d.toLocaleString('en-AU', {
        timeZone: timezone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return d.toLocaleString()
    }
  }

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone, formatTime, formatDateTime }}>
      {children}
    </TimezoneContext.Provider>
  )
}

export function useTimezone() {
  const context = useContext(TimezoneContext)
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider')
  }
  return context
}
