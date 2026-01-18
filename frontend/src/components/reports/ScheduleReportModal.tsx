import { useState, useEffect } from 'react'
import { X, Calendar, Clock, Mail, AlertCircle } from 'lucide-react'
import { getAuthToken } from '../../lib/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface ScheduledReport {
  id: string
  reportType: string
  frequency: string
  dayOfWeek: number | null
  dayOfMonth: number | null
  timeOfDay: string
  recipients: string
  isActive: boolean
  nextRunAt: string | null
  lastSentAt: string | null
}

interface ScheduleReportModalProps {
  projectId: string
  onClose: () => void
}

const REPORT_TYPES = [
  { value: 'lot-status', label: 'Lot Status Report' },
  { value: 'ncr', label: 'NCR Report' },
  { value: 'test', label: 'Test Results Report' },
  { value: 'diary', label: 'Daily Diary Report' },
]

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export function ScheduleReportModal({ projectId, onClose }: ScheduleReportModalProps) {
  const [schedules, setSchedules] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state for creating new schedule
  const [showForm, setShowForm] = useState(false)
  const [reportType, setReportType] = useState('lot-status')
  const [frequency, setFrequency] = useState('weekly')
  const [dayOfWeek, setDayOfWeek] = useState(1) // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [timeOfDay, setTimeOfDay] = useState('09:00')
  const [recipients, setRecipients] = useState('')

  useEffect(() => {
    fetchSchedules()
  }, [projectId])

  const fetchSchedules = async () => {
    setLoading(true)
    setError(null)

    try {
      const token = getAuthToken()
      const response = await fetch(
        `${API_URL}/api/reports/schedules?projectId=${projectId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch schedules')
      }

      const data = await response.json()
      setSchedules(data.schedules || [])
    } catch (err) {
      console.error('Error fetching schedules:', err)
      setError('Failed to load scheduled reports')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/reports/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          reportType,
          frequency,
          dayOfWeek: frequency === 'weekly' ? dayOfWeek : null,
          dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
          timeOfDay,
          recipients: recipients.split(',').map((e) => e.trim()).filter(Boolean),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to create schedule')
      }

      // Refresh the list and reset form
      await fetchSchedules()
      setShowForm(false)
      resetForm()
    } catch (err: any) {
      console.error('Error creating schedule:', err)
      setError(err.message || 'Failed to create scheduled report')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (schedule: ScheduledReport) => {
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/reports/schedules/${schedule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: !schedule.isActive,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update schedule')
      }

      // Refresh the list
      await fetchSchedules()
    } catch (err) {
      console.error('Error updating schedule:', err)
      setError('Failed to update schedule')
    }
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return
    }

    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/reports/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Failed to delete schedule')
      }

      // Refresh the list
      await fetchSchedules()
    } catch (err) {
      console.error('Error deleting schedule:', err)
      setError('Failed to delete schedule')
    }
  }

  const resetForm = () => {
    setReportType('lot-status')
    setFrequency('weekly')
    setDayOfWeek(1)
    setDayOfMonth(1)
    setTimeOfDay('09:00')
    setRecipients('')
  }

  const formatNextRun = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled'
    const date = new Date(dateStr)
    return date.toLocaleString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getFrequencyLabel = (schedule: ScheduledReport) => {
    switch (schedule.frequency) {
      case 'daily':
        return `Daily at ${schedule.timeOfDay}`
      case 'weekly':
        const day = DAYS_OF_WEEK.find((d) => d.value === schedule.dayOfWeek)?.label || 'Monday'
        return `Weekly on ${day} at ${schedule.timeOfDay}`
      case 'monthly':
        return `Monthly on day ${schedule.dayOfMonth} at ${schedule.timeOfDay}`
      default:
        return schedule.frequency
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-xl w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Email Reports
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Existing Schedules */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Scheduled Reports</h3>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                + New Schedule
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 bg-muted/50 rounded-lg border border-dashed">
              <Mail className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No scheduled reports yet</p>
              <p className="text-sm text-muted-foreground">
                Create a schedule to receive reports via email
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`p-4 border rounded-lg ${
                    schedule.isActive ? 'bg-white' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {REPORT_TYPES.find((t) => t.value === schedule.reportType)?.label ||
                            schedule.reportType}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            schedule.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {schedule.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        <Clock className="h-3.5 w-3.5 inline mr-1" />
                        {getFrequencyLabel(schedule)}
                      </p>
                      <p className="text-sm text-muted-foreground mb-1">
                        <Mail className="h-3.5 w-3.5 inline mr-1" />
                        {schedule.recipients.split(',').length} recipient(s)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Next: {formatNextRun(schedule.nextRunAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(schedule)}
                        className={`text-xs px-2 py-1 rounded ${
                          schedule.isActive
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {schedule.isActive ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create New Schedule Form */}
        {showForm && (
          <form onSubmit={handleCreateSchedule} className="border-t pt-6">
            <h3 className="font-medium mb-4">Create New Schedule</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium mb-1">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  {REPORT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium mb-1">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  {FREQUENCIES.map((freq) => (
                    <option key={freq.value} value={freq.value}>
                      {freq.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Day of Week (for weekly) */}
              {frequency === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Day of Week</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Day of Month (for monthly) */}
              {frequency === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Day of Month</label>
                  <select
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Time of Day */}
              <div>
                <label className="block text-sm font-medium mb-1">Time</label>
                <input
                  type="time"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
            </div>

            {/* Recipients */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Recipients (comma-separated emails)
              </label>
              <input
                type="text"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="email1@example.com, email2@example.com"
                className="w-full px-3 py-2 border rounded-md bg-background"
                required
              />
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="px-4 py-2 border rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !recipients.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Schedule'}
              </button>
            </div>
          </form>
        )}

        {/* Close Button */}
        {!showForm && (
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-muted"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
