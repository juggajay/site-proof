import { useRef, useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Clock, Mail, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';

const MAX_SCHEDULE_RECIPIENTS = 50;
const DEFAULT_MAX_SCHEDULED_REPORTS = 25;
const recipientEmailSchema = z.string().trim().email().max(254);

function parseRecipientList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function normalizeRecipientList(value: string): string[] {
  return Array.from(new Set(parseRecipientList(value).map((email) => email.toLowerCase())));
}

function getRecipientValidationError(value: string): string | null {
  const recipients = parseRecipientList(value);

  if (recipients.length === 0) {
    return 'At least one recipient is required';
  }

  if (normalizeRecipientList(value).length > MAX_SCHEDULE_RECIPIENTS) {
    return `Use ${MAX_SCHEDULE_RECIPIENTS} or fewer recipients`;
  }

  if (recipients.some((email) => !recipientEmailSchema.safeParse(email).success)) {
    return 'Enter valid email addresses';
  }

  return null;
}

const scheduleFormSchema = z.object({
  reportType: z.enum(['lot-status', 'ncr', 'test', 'diary']),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  dayOfWeek: z.number().int().min(0).max(6),
  dayOfMonth: z.number().int().min(1).max(31),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time'),
  recipients: z.string().superRefine((value, ctx) => {
    const error = getRecipientValidationError(value);
    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error,
      });
    }
  }),
});

type ScheduleFormData = z.infer<typeof scheduleFormSchema>;

interface ScheduledReport {
  id: string;
  reportType: string;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  recipients: string;
  isActive: boolean;
  nextRunAt: string | null;
  lastSentAt: string | null;
}

interface ScheduleReportModalProps {
  projectId: string;
  onClose: () => void;
}

const REPORT_TYPES = [
  { value: 'lot-status', label: 'Lot Status Report' },
  { value: 'ncr', label: 'NCR Report' },
  { value: 'test', label: 'Test Results Report' },
  { value: 'diary', label: 'Daily Diary Report' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function ScheduleReportModal({ projectId, onClose }: ScheduleReportModalProps) {
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [maxSchedules, setMaxSchedules] = useState(DEFAULT_MAX_SCHEDULED_REPORTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [schedulePendingDelete, setSchedulePendingDelete] = useState<ScheduledReport | null>(null);
  const creatingScheduleRef = useRef(false);
  const togglingSchedulesRef = useRef(new Set<string>());
  const deletingSchedulesRef = useRef(new Set<string>());

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
  });

  const frequency = watch('frequency');
  const recipients = watch('recipients');
  const hasReachedScheduleLimit = schedules.length >= maxSchedules;

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const queryParams = new URLSearchParams({ projectId });
      const data = await apiFetch<{ schedules: ScheduledReport[]; maxSchedules?: number }>(
        `/api/reports/schedules?${queryParams.toString()}`,
      );
      setSchedules(data.schedules || []);
      setMaxSchedules(
        Number.isInteger(data.maxSchedules) && Number(data.maxSchedules) > 0
          ? Number(data.maxSchedules)
          : DEFAULT_MAX_SCHEDULED_REPORTS,
      );
    } catch (err) {
      logError('Error loading schedules:', err);
      setSchedules([]);
      setLoadError(extractErrorMessage(err, 'Failed to load scheduled reports'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchSchedules();
  }, [fetchSchedules]);

  const handleCreateSchedule = async (data: ScheduleFormData) => {
    if (creatingScheduleRef.current) return;

    if (hasReachedScheduleLimit) {
      setActionError(`A project can have up to ${maxSchedules} scheduled reports`);
      return;
    }

    creatingScheduleRef.current = true;
    setSaving(true);
    setActionError(null);

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
          recipients: normalizeRecipientList(data.recipients),
        }),
      });

      // Refresh the list and reset form
      await fetchSchedules();
      setShowForm(false);
      resetForm();
      toast({
        title: 'Scheduled report created',
        description: 'The report schedule was saved.',
        variant: 'success',
      });
    } catch (err) {
      logError('Error creating schedule:', err);
      setActionError(extractErrorMessage(err, 'Failed to create scheduled report'));
    } finally {
      creatingScheduleRef.current = false;
      setSaving(false);
    }
  };

  const handleToggleActive = async (schedule: ScheduledReport) => {
    if (togglingSchedulesRef.current.has(schedule.id)) return;

    togglingSchedulesRef.current.add(schedule.id);
    setActionError(null);
    try {
      await apiFetch(`/api/reports/schedules/${encodeURIComponent(schedule.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          isActive: !schedule.isActive,
        }),
      });

      // Refresh the list
      await fetchSchedules();
      toast({
        title: !schedule.isActive ? 'Schedule activated' : 'Schedule paused',
        description: 'The scheduled report was updated.',
        variant: 'success',
      });
    } catch (err) {
      logError('Error updating schedule:', err);
      setActionError(extractErrorMessage(err, 'Failed to update schedule'));
    } finally {
      togglingSchedulesRef.current.delete(schedule.id);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (deletingSchedulesRef.current.has(scheduleId)) return;

    deletingSchedulesRef.current.add(scheduleId);
    setActionError(null);
    try {
      await apiFetch(`/api/reports/schedules/${encodeURIComponent(scheduleId)}`, {
        method: 'DELETE',
      });

      // Refresh the list
      await fetchSchedules();
      setSchedulePendingDelete(null);
      toast({
        title: 'Scheduled report deleted',
        description: 'Recipients will no longer receive this report automatically.',
        variant: 'success',
      });
    } catch (err) {
      logError('Error deleting schedule:', err);
      setActionError(extractErrorMessage(err, 'Failed to delete schedule'));
    } finally {
      deletingSchedulesRef.current.delete(scheduleId);
    }
  };

  const formatNextRun = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    return date.toLocaleString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFrequencyLabel = (schedule: ScheduledReport) => {
    switch (schedule.frequency) {
      case 'daily':
        return `Daily at ${schedule.timeOfDay}`;
      case 'weekly': {
        const day = DAYS_OF_WEEK.find((d) => d.value === schedule.dayOfWeek)?.label || 'Monday';
        return `Weekly on ${day} at ${schedule.timeOfDay}`;
      }
      case 'monthly':
        return `Monthly on day ${schedule.dayOfMonth} at ${schedule.timeOfDay}`;
      default:
        return schedule.frequency;
    }
  };

  const displayError = actionError || loadError;

  return (
    <>
      <Modal onClose={onClose} className="max-w-2xl">
        <ModalHeader>
          <span className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Email Reports
          </span>
        </ModalHeader>
        <ModalDescription>
          Create and manage automatic report emails for this project.
        </ModalDescription>

        <ModalBody>
          {displayError && (
            <div
              className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center justify-between gap-3"
              role="alert"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{displayError}</span>
              </div>
              {loadError && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchSchedules()}
                >
                  Try again
                </Button>
              )}
            </div>
          )}

          {/* Existing Schedules */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Scheduled Reports</h3>
              {!showForm && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowForm(true)}
                  disabled={hasReachedScheduleLimit}
                  title={
                    hasReachedScheduleLimit
                      ? `Maximum ${maxSchedules} scheduled reports`
                      : undefined
                  }
                >
                  + New Schedule
                </Button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : loadError && schedules.length === 0 ? null : schedules.length === 0 ? (
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
                          onClick={() => setSchedulePendingDelete(schedule)}
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
                  <Label htmlFor="schedule-report-type" className="mb-1">
                    Report Type
                  </Label>
                  <NativeSelect
                    id="schedule-report-type"
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
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {formErrors.reportType.message}
                    </p>
                  )}
                </div>

                {/* Frequency */}
                <div>
                  <Label htmlFor="schedule-frequency" className="mb-1">
                    Frequency
                  </Label>
                  <NativeSelect
                    id="schedule-frequency"
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
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {formErrors.frequency.message}
                    </p>
                  )}
                </div>

                {/* Day of Week (for weekly) */}
                {frequency === 'weekly' && (
                  <div>
                    <Label htmlFor="schedule-day-of-week" className="mb-1">
                      Day of Week
                    </Label>
                    <NativeSelect
                      id="schedule-day-of-week"
                      {...register('dayOfWeek', { valueAsNumber: true })}
                    >
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
                    <Label htmlFor="schedule-day-of-month" className="mb-1">
                      Day of Month
                    </Label>
                    <NativeSelect
                      id="schedule-day-of-month"
                      {...register('dayOfMonth', { valueAsNumber: true })}
                    >
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
                  <Label htmlFor="schedule-time" className="mb-1">
                    Time
                  </Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    {...register('timeOfDay')}
                    className={formErrors.timeOfDay ? 'border-destructive' : ''}
                  />
                  {formErrors.timeOfDay && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {formErrors.timeOfDay.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Recipients */}
              <div className="mb-4">
                <Label htmlFor="schedule-recipients" className="mb-1">
                  Recipients (comma-separated emails)
                </Label>
                <Input
                  id="schedule-recipients"
                  {...register('recipients')}
                  placeholder="email1@example.com, email2@example.com"
                  className={formErrors.recipients ? 'border-destructive' : ''}
                />
                {formErrors.recipients && (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {formErrors.recipients.message}
                  </p>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !recipients?.trim()}>
                  {saving ? 'Creating...' : 'Create Schedule'}
                </Button>
              </div>
            </form>
          )}
        </ModalBody>

        {/* Close Button */}
        {!showForm && (
          <ModalFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(schedulePendingDelete)}
        title="Delete Scheduled Report"
        description={
          <>
            <p>Delete this {schedulePendingDelete?.reportType || ''} scheduled report?</p>
            <p>Recipients will no longer receive it automatically.</p>
          </>
        }
        confirmLabel="Delete"
        variant="destructive"
        onCancel={() => setSchedulePendingDelete(null)}
        onConfirm={() => {
          if (schedulePendingDelete) void handleDeleteSchedule(schedulePendingDelete.id);
        }}
      />
    </>
  );
}
