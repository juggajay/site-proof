import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Calendar, Clock, Mail, AlertCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { extractErrorMessage } from '@/lib/errorHandling'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

const scheduleFormSchema = z.object({
  reportType: z.string().min(1, 'Report type is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  dayOfWeek: z.number(),
  dayOfMonth: z.number(),
  timeOfDay: z.string().min(1, 'Time is required'),
  recipients: z.string().min(1, 'At least one recipient is required'),
})

type ScheduleFormData = z.infer<typeof scheduleFormSchema>

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
  const [showForm, setShowForm] = useState(false)

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    watch,
    reset: resetForm,
    formState: { errors: formErrors },
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleFormSchema),
    mode: 'onBlur',
    defaultValues: {
      reportType: 'lot-status',
      frequency: 'weekly',
      dayOfWeek: 1,
      dayOfMonth: 1,
      timeOfDay: '09:00',
      recipients: '',
    },
  })

  const frequency = watch('frequency')
  const recipients = watch('recipients')

  useEffect(() => {
    fetchSchedules()
  }, [projectId])

  const fetchSchedules = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await apiFetch<{ schedules: ScheduledReport[] }>(
        `/api/reports/schedules?projectId=${projectId}`
      )
      setSchedules(data.schedules || [])
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load scheduled reports'))
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSchedule = async (data: ScheduleFormData) => {
    setSaving(true)
    setError(null)

    try {
      await apiFetch('/api/reports/schedules', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          reportType: data.reportType,
          frequency: data.frequency,
          dayOfWeek: data.frequency === 'weekly' ? data.dayOfWeek : null,
          dayOfMonth: data.frequency === 'monthly' ? data.dayOfMonth : null,
          timeOfDay: data.timeOfDay,
          recipients: data.recipients.split(',').map((e) => e.trim()).filter(Boolean),
        }),
      })

      // Refresh the list and reset form
      await fetchSchedules()
      setShowForm(false)
      resetForm()
    } catch (err) {
      console.error('Error creating schedule:', err)
      setError(extractErrorMessage(err, 'Failed to create scheduled report'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (schedule: ScheduledReport) => {
    try {
      await apiFetch(`/api/reports/schedules/${schedule.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          isActive: !schedule.isActive,
        }),
      })

      // Refresh the list
      await fetchSchedules()
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to update schedule'))
    }
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return
    }

    try {
      await apiFetch(`/api/reports/schedules/${scheduleId}`, {
        method: 'DELETE',
      })

      // Refresh the list
      await fetchSchedules()
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete schedule'))
    }
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
    <Modal onClose={onClose} className="max-w-2xl">
      <ModalHeader>
        <span className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Schedule Email Reports
        </span>
      </ModalHeader>

      <ModalBody>
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
              <Button size="sm" onClick={() => setShowForm(true)}>
                + New Schedule
              </Button>
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
                    schedule.isActive ? 'bg-card' : 'bg-muted/50'
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
                              : 'bg-muted text-muted-foreground'
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(schedule)}
                        className={
                          schedule.isActive
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200'
                        }
                      >
                        {schedule.isActive ? 'Pause' : 'Activate'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create New Schedule Form */}
        {showForm && (
          <form onSubmit={rhfHandleSubmit(handleCreateSchedule)} className="border-t pt-6">
            <h3 className="font-medium mb-4">Create New Schedule</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Report Type */}
              <div>
                <Label className="mb-1">Report Type</Label>
                <NativeSelect
                  {...register('reportType')}
                  className={formErrors.reportType ? 'border-destructive' : ''}
                >
                  {REPORT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </NativeSelect>
                {formErrors.reportType && (
                  <p className="mt-1 text-sm text-destructive" role="alert">{formErrors.reportType.message}</p>
                )}
              </div>

              {/* Frequency */}
              <div>
                <Label className="mb-1">Frequency</Label>
                <NativeSelect
                  {...register('frequency')}
                  className={formErrors.frequency ? 'border-destructive' : ''}
                >
                  {FREQUENCIES.map((freq) => (
                    <option key={freq.value} value={freq.value}>
                      {freq.label}
                    </option>
                  ))}
                </NativeSelect>
                {formErrors.frequency && (
                  <p className="mt-1 text-sm text-destructive" role="alert">{formErrors.frequency.message}</p>
                )}
              </div>

              {/* Day of Week (for weekly) */}
              {frequency === 'weekly' && (
                <div>
                  <Label className="mb-1">Day of Week</Label>
                  <NativeSelect {...register('dayOfWeek', { valueAsNumber: true })}>
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}

              {/* Day of Month (for monthly) */}
              {frequency === 'monthly' && (
                <div>
                  <Label className="mb-1">Day of Month</Label>
                  <NativeSelect {...register('dayOfMonth', { valueAsNumber: true })}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}

              {/* Time of Day */}
              <div>
                <Label className="mb-1">Time</Label>
                <Input
                  type="time"
                  {...register('timeOfDay')}
                  className={formErrors.timeOfDay ? 'border-destructive' : ''}
                />
                {formErrors.timeOfDay && (
                  <p className="mt-1 text-sm text-destructive" role="alert">{formErrors.timeOfDay.message}</p>
                )}
              </div>
            </div>

            {/* Recipients */}
            <div className="mb-4">
              <Label className="mb-1">
                Recipients (comma-separated emails)
              </Label>
              <Input
                {...register('recipients')}
                placeholder="email1@example.com, email2@example.com"
                className={formErrors.recipients ? 'border-destructive' : ''}
              />
              {formErrors.recipients && (
                <p className="mt-1 text-sm text-destructive" role="alert">{formErrors.recipients.message}</p>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !recipients?.trim()}
              >
                {saving ? 'Creating...' : 'Create Schedule'}
              </Button>
            </div>
          </form>
        )}
      </ModalBody>

      {/* Close Button */}
      {!showForm && (
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      )}
    </Modal>
  )
}
