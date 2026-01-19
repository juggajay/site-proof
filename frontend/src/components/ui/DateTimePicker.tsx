import { useState, useEffect } from 'react'
import { Calendar, Clock } from 'lucide-react'

interface DateTimePickerProps {
  value: string // ISO datetime string
  onChange: (datetime: string) => void
  label?: string
  className?: string
  minDate?: string
  disabled?: boolean
}

export function DateTimePicker({
  value,
  onChange,
  label,
  className = '',
  minDate,
  disabled = false,
}: DateTimePickerProps) {
  // Parse the ISO datetime into separate date and time parts
  const parseDateTime = (isoString: string) => {
    if (!isoString) return { date: '', time: '' }
    try {
      const dt = new Date(isoString)
      if (isNaN(dt.getTime())) return { date: '', time: '' }
      const date = dt.toISOString().split('T')[0]
      const time = dt.toTimeString().slice(0, 5) // HH:MM
      return { date, time }
    } catch {
      return { date: '', time: '' }
    }
  }

  const { date: initialDate, time: initialTime } = parseDateTime(value)
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState(initialTime)

  // Update internal state when value prop changes
  useEffect(() => {
    const { date: newDate, time: newTime } = parseDateTime(value)
    setDate(newDate)
    setTime(newTime)
  }, [value])

  // Combine date and time into ISO string and notify parent
  const updateDateTime = (newDate: string, newTime: string) => {
    if (newDate && newTime) {
      const combined = new Date(`${newDate}T${newTime}:00`)
      onChange(combined.toISOString())
    } else if (newDate) {
      // If only date is set, use midnight
      const combined = new Date(`${newDate}T00:00:00`)
      onChange(combined.toISOString())
    } else {
      onChange('')
    }
  }

  const handleDateChange = (newDate: string) => {
    setDate(newDate)
    updateDateTime(newDate, time)
  }

  const handleTimeChange = (newTime: string) => {
    setTime(newTime)
    updateDateTime(date, newTime)
  }

  // Format the display value
  const displayValue = () => {
    if (!date) return 'Select date and time'
    const dateStr = new Date(date).toLocaleDateString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    const timeStr = time || '00:00'
    return `${dateStr} at ${timeStr}`
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium">{label}</label>
      )}

      {/* Combined display */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 text-sm"
        data-testid="datetime-display"
      >
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className={date ? '' : 'text-muted-foreground'}>
          {displayValue()}
        </span>
      </div>

      {/* Date and Time inputs side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            <Calendar className="h-3 w-3 inline mr-1" />
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            min={minDate}
            disabled={disabled}
            className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-muted disabled:cursor-not-allowed"
            data-testid="datetime-date-input"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            <Clock className="h-3 w-3 inline mr-1" />
            Time
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
            disabled={disabled || !date}
            className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-muted disabled:cursor-not-allowed"
            data-testid="datetime-time-input"
          />
        </div>
      </div>
    </div>
  )
}
