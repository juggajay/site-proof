/**
 * Constants for Daily Diary pages and components.
 * Extracted from DailyDiaryPage.tsx for reusability.
 */

export const WEATHER_CONDITIONS = [
  'Fine',
  'Partly Cloudy',
  'Cloudy',
  'Rain',
  'Heavy Rain',
  'Storm',
  'Wind',
  'Fog',
]

export const DELAY_TYPES = [
  'Weather',
  'Client Instruction',
  'Design Change',
  'Material Delay',
  'Plant Breakdown',
  'Labor Shortage',
  'Safety Incident',
  'Other',
]

/**
 * Validate hours input - warn if hours > 24.
 */
export const validateHours = (hours: string): { isValid: boolean; warning: string | null } => {
  const numHours = parseFloat(hours)
  if (isNaN(numHours) || hours === '') {
    return { isValid: true, warning: null }
  }
  if (numHours < 0) {
    return { isValid: false, warning: 'Hours cannot be negative' }
  }
  if (numHours > 24) {
    return { isValid: true, warning: 'Warning: Hours exceed 24 - please verify this is correct' }
  }
  return { isValid: true, warning: null }
}

/**
 * Calculate hours from start and finish time.
 */
export const calculateHours = (startTime: string, finishTime: string): number | null => {
  if (!startTime || !finishTime) return null
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = finishTime.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  const diffMinutes = endMinutes - startMinutes
  if (diffMinutes <= 0) return null
  return Math.round((diffMinutes / 60) * 10) / 10 // Round to 1 decimal
}

/**
 * Format a date string for display.
 */
export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
