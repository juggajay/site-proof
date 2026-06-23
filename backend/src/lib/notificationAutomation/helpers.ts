const DEFAULT_TIME_OF_DAY = '17:00';
const DEFAULT_WORKING_DAYS = new Set([1, 2, 3, 4, 5]);

type ProjectWorkingDays = {
  workingDays: string | null;
};

export function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseTimeOfDay(value: string | null | undefined): {
  hours: number;
  minutes: number;
} {
  const candidate = value?.trim() || DEFAULT_TIME_OF_DAY;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(candidate);
  if (!match) {
    return parseTimeOfDay(DEFAULT_TIME_OF_DAY);
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
}

export function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function formatDateKey(value: Date): string {
  return value.toISOString().split('T')[0]!;
}

export function parseWorkingDays(value: string | null | undefined): Set<number> {
  const days = new Set(
    (value ?? '')
      .split(',')
      .map((day) => Number(day.trim()))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  );

  return days.size > 0 ? days : DEFAULT_WORKING_DAYS;
}

export function getPreviousWorkingDay(
  now: Date,
  workingDaysValue: string | null | undefined,
): Date {
  const workingDays = parseWorkingDays(workingDaysValue);
  let candidate = startOfDay(addDays(now, -1));

  for (let attempt = 0; attempt < 7; attempt += 1) {
    if (workingDays.has(candidate.getDay())) {
      return candidate;
    }
    candidate = addDays(candidate, -1);
  }

  return startOfDay(addDays(now, -1));
}

export function isWorkingDay(project: ProjectWorkingDays, date: Date): boolean {
  return parseWorkingDays(project.workingDays).has(date.getDay());
}

/**
 * Default application timezone. The product targets Australian civil
 * contractors, so daily reminder/digest "wall-clock" times (e.g. 17:00) are
 * evaluated in Australian Eastern time, not the server's UTC clock. Overridable
 * via APP_TIMEZONE (the test suite pins it to UTC for deterministic fixtures;
 * the Australia/Sydney conversion itself is covered by getZonedMinutesOfDay
 * unit tests that pass the zone explicitly).
 */
export const APP_TIME_ZONE = 'Australia/Sydney';

export function resolveAppTimeZone(): string {
  return process.env.APP_TIMEZONE || APP_TIME_ZONE;
}

/**
 * Minutes-since-midnight of `date`'s wall clock in `timeZone`. DST-correct:
 * Intl resolves the zone's offset for that exact instant (AEST +10 vs AEDT +11),
 * so a daily fire-time gate is evaluated in local time regardless of the
 * server's timezone.
 */
export function getZonedMinutesOfDay(date: Date, timeZone: string = resolveAppTimeZone()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const partValue = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  let hour = partValue('hour');
  if (hour === 24) hour = 0; // some engines emit '24' for midnight
  return hour * 60 + partValue('minute');
}

export function isDueForProjectTime(
  now: Date,
  timeOfDay: string | null | undefined,
  timeZone: string = resolveAppTimeZone(),
): boolean {
  const { hours, minutes } = parseTimeOfDay(process.env.DIARY_REMINDER_TIME_OF_DAY ?? timeOfDay);
  // M84: evaluate the wall-clock gate in the PROJECT'S timezone, so a Perth
  // project's 17:00 reminder fires on Perth time, not app-wide Sydney time.
  return getZonedMinutesOfDay(now, timeZone) >= hours * 60 + minutes;
}

export function appendQueryParams(
  pathname: string,
  params?: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function buildProjectEntityLink(
  entityType: string,
  entityId: string,
  projectId?: string | null,
  params?: Record<string, string | undefined>,
): string {
  if (!projectId) {
    return '/dashboard';
  }

  const encodedProjectId = encodeURIComponent(projectId);
  const encodedEntityId = encodeURIComponent(entityId);
  const normalizedType = entityType.toLowerCase().replace(/[\s-]/g, '_');

  switch (normalizedType) {
    case 'lot':
      return appendQueryParams(`/projects/${encodedProjectId}/lots/${encodedEntityId}`, params);
    case 'ncr':
      return appendQueryParams(`/projects/${encodedProjectId}/ncr`, { ncr: entityId, ...params });
    case 'test':
    case 'test_result':
    case 'testresult':
      return appendQueryParams(`/projects/${encodedProjectId}/tests`, {
        test: entityId,
        ...params,
      });
    case 'holdpoint':
    case 'hold_point':
      return appendQueryParams(`/projects/${encodedProjectId}/hold-points`, {
        holdPoint: entityId,
        ...params,
      });
    case 'document':
      return appendQueryParams(`/projects/${encodedProjectId}/documents`, {
        document: entityId,
        ...params,
      });
    case 'drawing':
      return appendQueryParams(`/projects/${encodedProjectId}/drawings`, {
        drawing: entityId,
        ...params,
      });
    case 'docket':
    case 'daily_docket':
    case 'dailydocket':
      return appendQueryParams(`/projects/${encodedProjectId}/dockets`, {
        docket: entityId,
        ...params,
      });
    case 'diary':
    case 'daily_diary':
    case 'dailydiary':
      return appendQueryParams(`/projects/${encodedProjectId}/diary`, params);
    case 'progress_claim':
    case 'progressclaim':
    case 'claim':
      return appendQueryParams(`/projects/${encodedProjectId}/claims`, {
        claim: entityId,
        ...params,
      });
    case 'itp':
    case 'itp_instance':
    case 'itpinstance':
      return appendQueryParams(`/projects/${encodedProjectId}/itp`, { itp: entityId, ...params });
    default:
      return appendQueryParams(`/projects/${encodedProjectId}`, params);
  }
}
