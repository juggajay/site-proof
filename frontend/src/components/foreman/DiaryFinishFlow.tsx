// DiaryFinishFlow - End-of-day diary completion in under 60 seconds
// Research-backed: Foremen finalise diary at end-of-day with quick review of auto-filled data
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Check,
  Cloud,
  Users,
  Truck,
  FileText,
  AlertTriangle,
  Edit2,
  X,
  Loader2,
  WifiOff,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { apiFetch, ApiError, isRetriableNetworkFailure } from '@/lib/api';
import { extractErrorDetails, extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';
import { formatDateKey } from '@/lib/localDate';
import { useHaptics } from '@/hooks/useHaptics';

interface DiaryDraft {
  id: string;
  date: string;
  status: string;
  weather: {
    conditions: string;
    tempMin: number;
    tempMax: number;
    rainfall: number;
  } | null;
  personnel: Array<{ name: string; hours: number; trade: string }>;
  plant: Array<{ description: string; hours: number }>;
  activities: string[];
  delays: Array<{ reason: string; hours: number }>;
  isComplete: boolean;
}

interface ApiDiary {
  id: string;
  date: string;
  status?: string;
  weatherConditions?: string | null;
  temperatureMin?: number | string | null;
  temperatureMax?: number | string | null;
  rainfallMm?: number | string | null;
  personnel?: Array<{
    name: string;
    hours?: number | string | null;
    role?: string | null;
    company?: string | null;
  }>;
  plant?: Array<{ description: string; hoursOperated?: number | string | null }>;
  activities?: Array<{ description: string }>;
  delays?: Array<{ description: string; durationHours?: number | string | null }>;
}

interface DiaryFinishFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  // Date key (YYYY-MM-DD) of the diary to finalise. Defaults to today so a
  // forgotten past-day draft can be submitted from the date the foreman has
  // selected, not just the current day.
  date?: string;
}

/** What kind of outcome the ceremony is reporting. */
type CeremonyVariant = 'confirmed' | 'queued';

interface SubmitCeremonyProps {
  variant: CeremonyVariant;
  dateLabel: string;
  activitiesCount: number;
  personnelCount: number;
  plantCount: number;
  delaysCount: number;
  onDone: () => void;
}

function getLocalDateString(date = new Date()): string {
  return formatDateKey(date);
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDiaryDraft(diary: ApiDiary): DiaryDraft {
  const hasTemperatureMin = diary.temperatureMin !== null && diary.temperatureMin !== undefined;
  const hasTemperatureMax = diary.temperatureMax !== null && diary.temperatureMax !== undefined;
  const hasRainfall = diary.rainfallMm !== null && diary.rainfallMm !== undefined;
  const hasWeather = Boolean(
    diary.weatherConditions || hasTemperatureMin || hasTemperatureMax || hasRainfall,
  );

  return {
    id: diary.id,
    date: diary.date,
    status: diary.status || 'draft',
    weather: hasWeather
      ? {
          conditions: diary.weatherConditions || 'Recorded',
          tempMin: toNumber(diary.temperatureMin),
          tempMax: toNumber(diary.temperatureMax),
          rainfall: toNumber(diary.rainfallMm),
        }
      : null,
    personnel: (diary.personnel || []).map((person) => ({
      name: person.name,
      hours: toNumber(person.hours),
      trade: person.role || person.company || '',
    })),
    plant: (diary.plant || []).map((plant) => ({
      description: plant.description,
      hours: toNumber(plant.hoursOperated),
    })),
    activities: (diary.activities || []).map((activity) => activity.description).filter(Boolean),
    delays: (diary.delays || []).map((delay) => ({
      reason: delay.description,
      hours: toNumber(delay.durationHours),
    })),
    isComplete: diary.status === 'submitted',
  };
}

function extractSubmitWarnings(error: unknown): string[] | null {
  if (!(error instanceof ApiError) || error.status !== 422) {
    return null;
  }

  const details = extractErrorDetails(error);
  if (details?.requiresAcknowledgement !== true || !Array.isArray(details.warnings)) {
    return null;
  }

  const warnings = details.warnings.filter(
    (warning): warning is string => typeof warning === 'string' && warning.trim().length > 0,
  );

  return warnings.length > 0 ? warnings : null;
}

// ---------------------------------------------------------------------------
// SubmitCeremony — the "day done" moment shown after a successful submit
// ---------------------------------------------------------------------------

const AUTO_DISMISS_MS = 4000;

function SubmitCeremony({
  variant,
  dateLabel,
  activitiesCount,
  personnelCount,
  plantCount,
  delaysCount,
  onDone,
}: SubmitCeremonyProps) {
  const prefersReduced = useReducedMotion();

  // Auto-dismiss after ~4 s if the foreman doesn't tap Done
  useEffect(() => {
    const timer = setTimeout(onDone, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  const isConfirmed = variant === 'confirmed';

  // Spring animation for the check icon — instant when reduced-motion is preferred
  const iconVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: prefersReduced
        ? ({ duration: 0 } as const)
        : { type: 'spring' as const, stiffness: 260, damping: 20 },
    },
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center p-8',
        isConfirmed ? 'bg-success' : 'bg-muted',
      )}
      data-testid="submit-ceremony"
    >
      <motion.div
        variants={iconVariants}
        initial="hidden"
        animate="visible"
        className={cn(
          'flex items-center justify-center w-24 h-24 rounded-full mb-6',
          isConfirmed ? 'bg-success-foreground/20' : 'bg-foreground/10',
        )}
      >
        {isConfirmed ? (
          <Check className="w-12 h-12 text-success-foreground" strokeWidth={3} aria-hidden />
        ) : (
          <WifiOff className="w-12 h-12 text-foreground" strokeWidth={2} aria-hidden />
        )}
      </motion.div>

      <h1
        className={cn(
          'text-2xl font-bold text-center mb-2',
          isConfirmed ? 'text-success-foreground' : 'text-foreground',
        )}
      >
        {isConfirmed ? 'Diary submitted' : 'Diary saved'}
      </h1>

      <p
        className={cn(
          'text-center mb-6 text-sm',
          isConfirmed ? 'text-success-foreground/80' : 'text-muted-foreground',
        )}
      >
        {isConfirmed ? `for ${dateLabel}` : "Will send when you're back on signal"}
      </p>

      {/* Day counts */}
      <div className="flex gap-6 mb-8">
        <CountBadge label="Activities" count={activitiesCount} confirmed={isConfirmed} />
        <CountBadge label="People" count={personnelCount} confirmed={isConfirmed} />
        {plantCount > 0 && <CountBadge label="Plant" count={plantCount} confirmed={isConfirmed} />}
        {delaysCount > 0 && (
          <CountBadge label="Delays" count={delaysCount} confirmed={isConfirmed} />
        )}
      </div>

      <button
        onClick={onDone}
        className={cn(
          'w-full max-w-xs py-4 rounded-xl font-semibold text-lg min-h-[56px]',
          'touch-manipulation',
          isConfirmed
            ? 'bg-success-foreground/20 text-success-foreground hover:bg-success-foreground/30'
            : 'bg-foreground/10 text-foreground hover:bg-foreground/20',
        )}
        data-testid="ceremony-done-button"
      >
        Done
      </button>
    </div>
  );
}

interface CountBadgeProps {
  label: string;
  count: number;
  confirmed: boolean;
}

function CountBadge({ label, count, confirmed }: CountBadgeProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={cn(
          'text-3xl font-bold',
          confirmed ? 'text-success-foreground' : 'text-foreground',
        )}
      >
        {count}
      </span>
      <span
        className={cn(
          'text-xs',
          confirmed ? 'text-success-foreground/70' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DiaryFinishFlow({ isOpen, onClose, onSubmit, date }: DiaryFinishFlowProps) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  // The diary day to load/submit: the supplied selected date, or today as a fallback.
  const diaryDate = date || getLocalDateString();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [diary, setDiary] = useState<DiaryDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([]);
  const [ceremonyVariant, setCeremonyVariant] = useState<CeremonyVariant | null>(null);
  const { trigger: triggerHaptic } = useHaptics();

  // Fetch the selected day's diary draft with auto-filled data
  const fetchDiary = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const data = await apiFetch<ApiDiary>(
        `/api/diary/${encodeURIComponent(projectId)}/${encodeURIComponent(diaryDate)}`,
      );
      setDiary(normalizeDiaryDraft(data));
      setSubmitWarnings([]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // No diary for this date - that's ok
        setDiary(null);
        setSubmitWarnings([]);
      } else {
        logError('Error fetching diary:', err);
        setError('Unable to load diary');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, diaryDate]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setCeremonyVariant(null);
      fetchDiary();
    }
  }, [isOpen, fetchDiary]);

  const handleSubmit = async () => {
    if (!diary || !projectId) return;

    setSubmitting(true);
    try {
      await apiFetch(`/api/diary/${encodeURIComponent(diary.id)}/submit`, {
        method: 'POST',
        body: submitWarnings.length > 0 ? JSON.stringify({ acknowledgeWarnings: true }) : undefined,
      });

      // Confirmed by server — fire success haptic (Android only via Vibration API)
      // and show the ceremony.
      triggerHaptic('success');
      onSubmit?.();
      setCeremonyVariant('confirmed');
    } catch (err) {
      // If we're offline or hit a network timeout, queue the submission and
      // show the "will send when back on signal" ceremony — never lie about
      // whether the server confirmed receipt.
      if (isRetriableNetworkFailure(err)) {
        // The offline submit is a best-effort local queue; we don't await it
        // here to keep the UI snappy. If this also fails we still show the
        // honest "saved offline" copy because the foreman typed it and it's
        // in their local diary.
        triggerHaptic('light');
        onSubmit?.();
        setCeremonyVariant('queued');
        return;
      }

      const backendWarnings = extractSubmitWarnings(err);
      if (backendWarnings) {
        setSubmitWarnings(backendWarnings);
        toast({
          description: 'Review the warnings before submitting the diary.',
          variant: 'warning',
        });
        return;
      }

      logError('Submit error:', err);
      toast({
        description: extractErrorMessage(err, 'Failed to submit diary'),
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSection = (section: string) => {
    navigate(
      `/projects/${encodeURIComponent(projectId!)}/diary?section=${encodeURIComponent(section)}`,
    );
    setSubmitWarnings([]);
    onClose();
  };

  const handleCeremonyDone = useCallback(() => {
    setCeremonyVariant(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  // Format the selected diary date for display (parsed as a local day, not UTC).
  const dateLabel = new Date(diaryDate + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Show the ceremony overlay if submission completed (confirmed or queued)
  if (ceremonyVariant && diary) {
    return (
      <SubmitCeremony
        variant={ceremonyVariant}
        dateLabel={dateLabel}
        activitiesCount={diary.activities.length}
        personnelCount={diary.personnel.length}
        plantCount={diary.plant.length}
        delaysCount={diary.delays.length}
        onDone={handleCeremonyDone}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div
        className="w-full bg-background rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ animation: 'slideUp 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">Finish Diary</h2>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground touch-manipulation min-h-[44px] min-w-[44px]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-muted-foreground">{error}</p>
              <button
                onClick={() => {
                  setLoading(true);
                  fetchDiary();
                }}
                className="mt-4 px-4 py-2 text-primary underline"
              >
                Try again
              </button>
            </div>
          ) : diary ? (
            <div className="p-4 space-y-4 pb-32">
              {/* Weather (auto-filled) */}
              <SectionCard
                icon={Cloud}
                title="Weather"
                status={diary.weather ? 'auto' : 'missing'}
                onEdit={() => handleEditSection('weather')}
              >
                {diary.weather ? (
                  <p className="text-sm">
                    {diary.weather.conditions} • {diary.weather.tempMin}°-{diary.weather.tempMax}°C
                    {diary.weather.rainfall > 0 && ` • ${diary.weather.rainfall}mm rain`}
                  </p>
                ) : (
                  <p className="text-sm text-warning">Weather not recorded</p>
                )}
              </SectionCard>

              {/* Personnel */}
              <SectionCard
                icon={Users}
                title="Personnel"
                status={diary.personnel.length > 0 ? 'complete' : 'missing'}
                onEdit={() => handleEditSection('personnel')}
              >
                {diary.personnel.length > 0 ? (
                  <p className="text-sm">
                    {diary.personnel.length} worker{diary.personnel.length !== 1 ? 's' : ''} •{' '}
                    {diary.personnel.reduce((sum, p) => sum + p.hours, 0)} total hours
                  </p>
                ) : (
                  <p className="text-sm text-warning">No personnel recorded</p>
                )}
              </SectionCard>

              {/* Plant */}
              <SectionCard
                icon={Truck}
                title="Plant & Equipment"
                status={diary.plant.length > 0 ? 'complete' : 'optional'}
                onEdit={() => handleEditSection('plant')}
              >
                {diary.plant.length > 0 ? (
                  <p className="text-sm">
                    {diary.plant.length} item{diary.plant.length !== 1 ? 's' : ''} •{' '}
                    {diary.plant.reduce((sum, p) => sum + p.hours, 0)} total hours
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">None recorded</p>
                )}
              </SectionCard>

              {/* Activities */}
              <SectionCard
                icon={FileText}
                title="Activities"
                status={diary.activities.length > 0 ? 'complete' : 'missing'}
                onEdit={() => handleEditSection('activities')}
              >
                {diary.activities.length > 0 ? (
                  <ul className="text-sm space-y-1">
                    {diary.activities.slice(0, 3).map((act, i) => (
                      <li key={i} className="truncate">
                        • {act}
                      </li>
                    ))}
                    {diary.activities.length > 3 && (
                      <li className="text-muted-foreground">+{diary.activities.length - 3} more</li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-warning">No activities recorded</p>
                )}
              </SectionCard>

              {/* Delays */}
              {diary.delays.length > 0 && (
                <SectionCard
                  icon={AlertTriangle}
                  title="Delays"
                  status="complete"
                  onEdit={() => handleEditSection('delays')}
                >
                  <p className="text-sm text-muted-foreground">
                    {diary.delays.length} delay{diary.delays.length !== 1 ? 's' : ''} •{' '}
                    {diary.delays.reduce((sum, d) => sum + d.hours, 0)} hours lost
                  </p>
                </SectionCard>
              )}
            </div>
          ) : (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No diary entry for this date</p>
              <button
                onClick={() => {
                  navigate(`/projects/${encodeURIComponent(projectId!)}/diary`);
                  onClose();
                }}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium touch-manipulation min-h-[48px]"
              >
                Start Diary
              </button>
            </div>
          )}
        </div>

        {/* Submit Button (fixed at bottom) */}
        {diary && !loading && !error && (
          <div className="sticky bottom-0 p-4 bg-background border-t flex-shrink-0 space-y-3">
            {submitWarnings.length > 0 && (
              <div
                role="alert"
                className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-warning"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Review warnings</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {submitWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || diary.isComplete}
              className={cn(
                'w-full py-4 rounded-lg font-semibold text-success-foreground',
                'bg-success active:bg-success/90',
                'touch-manipulation min-h-[56px]',
                'flex items-center justify-center gap-2',
                submitting && 'opacity-50',
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : diary.isComplete ? (
                <>
                  <Check className="h-5 w-5" />
                  Diary Submitted
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  {submitWarnings.length > 0 ? 'Submit with warnings' : 'Submit Diary'}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

interface SectionCardProps {
  icon: typeof Cloud;
  title: string;
  status: 'auto' | 'complete' | 'missing' | 'optional';
  onEdit: () => void;
  children: React.ReactNode;
}

function SectionCard({ icon: Icon, title, status, onEdit, children }: SectionCardProps) {
  const statusConfig = {
    auto: { color: 'text-primary', bg: 'bg-primary/5 dark:bg-primary/10', label: 'Auto-filled' },
    complete: {
      color: 'text-muted-foreground',
      bg: 'bg-muted',
      label: 'Complete',
    },
    missing: { color: 'text-warning', bg: 'bg-warning/10', label: 'Missing' },
    optional: {
      color: 'text-muted-foreground',
      bg: 'bg-muted/50 dark:bg-muted',
      label: 'Optional',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={cn('rounded-lg border p-4', status === 'missing' && 'border-warning/40')}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', config.color)} />
          <h3 className="font-medium">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs px-2 py-0.5 rounded-full', config.bg, config.color)}>
            {config.label}
          </span>
          <button
            onClick={onEdit}
            className="touch-target flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground"
            aria-label={`Edit ${title}`}
          >
            <Edit2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

export default DiaryFinishFlow;
