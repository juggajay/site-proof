import { createContext, useContext, useState, ReactNode } from 'react'

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'

interface DateFormatContextValue {
  dateFormat: DateFormat
  setDateFormat: (format: DateFormat) => void
  formatDate: (date: Date | string) => string
}

const DateFormatContext = createContext<DateFormatContextValue | undefined>(undefined)

const DATE_FORMAT_STORAGE_KEY = 'siteproof_date_format'

const DEFAULT_DATE_FORMAT: DateFormat = 'DD/MM/YYYY'

export function DateFormatProvider({ children }: { children: ReactNode }) {
  const [dateFormat, setDateFormatState] = useState<DateFormat>(() => {
    if (typeof window === 'undefined') return DEFAULT_DATE_FORMAT
    try {
      const stored = localStorage.getItem(DATE_FORMAT_STORAGE_KEY) as DateFormat | null
      if (stored && ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(stored)) {
        return stored
      }
    } catch (e) {
      console.error('Error loading date format:', e)
    }
    return DEFAULT_DATE_FORMAT
  })

  const setDateFormat = (newFormat: DateFormat) => {
    setDateFormatState(newFormat)
    try {
      localStorage.setItem(DATE_FORMAT_STORAGE_KEY, newFormat)
    } catch (e) {
      console.error('Error saving date format:', e)
    }
  }

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return 'Invalid date'

    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()

    switch (dateFormat) {
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`
      default:
        return `${day}/${month}/${year}`
    }
  }

  return (
    <DateFormatContext.Provider value={{ dateFormat, setDateFormat, formatDate }}>
      {children}
    </DateFormatContext.Provider>
  )
}

export function useDateFormat() {
  const context = useContext(DateFormatContext)
  if (context === undefined) {
    throw new Error('useDateFormat must be used within a DateFormatProvider')
  }
  return context
}
