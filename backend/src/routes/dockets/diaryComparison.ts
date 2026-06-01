import { formatDocketDate } from './formatting.js';

// =============================================================================
// Docket vs. same-day foreman-diary comparison (Feature #265 Steps 3-4).
// Pure presentation/comparison logic extracted from the GET /api/dockets/:id
// handler: it summarizes the diary into a `foremanDiary` response object and
// flags personnel/plant/weather discrepancies between the docket and diary.
// Behavior-preserving — same fields, same weather-hours math, same discrepancy
// messages and guard conditions. Data fetching + the response-level
// `discrepancies.length > 0 ? ... : null` shaping stay in the route handler.
//
// Input types are structural (not Prisma-generated) so the route's `findFirst`
// payload satisfies them; only the fields actually read are required.
// =============================================================================

interface ComparableDocketEntries {
  labourEntries: unknown[];
  plantEntries: unknown[];
}

interface ComparableDiaryDelay {
  delayType: string;
  // Coerced via `Number(...)`, matching the original (handles Prisma Decimal,
  // number, or string the same way).
  durationHours: unknown;
}

interface ComparableDiary {
  id: string;
  date: Date;
  status: string;
  weatherConditions: string | null;
  personnel: unknown[];
  plant: unknown[];
  activities: unknown[];
  delays: ComparableDiaryDelay[];
}

export interface ForemanDiarySummary {
  id: string;
  date: string;
  status: string;
  personnelCount: number;
  plantCount: number;
  weatherConditions: string | null;
  weatherHoursLost: number;
  activitiesCount: number;
}

export interface DocketDiaryComparison {
  foremanDiary: ForemanDiarySummary | null;
  discrepancies: string[];
}

/**
 * Builds the `foremanDiary` summary and the docket/diary discrepancy list.
 * Returns `foremanDiary: null` with no discrepancies when there is no same-day
 * diary, matching the original inline behavior.
 */
export function buildDocketDiaryComparison(
  docket: ComparableDocketEntries,
  diary: ComparableDiary | null,
): DocketDiaryComparison {
  if (!diary) {
    return { foremanDiary: null, discrepancies: [] };
  }

  // Calculate weather hours lost from delays
  const weatherDelays = diary.delays.filter((d) => d.delayType === 'weather');
  const weatherHoursLost = weatherDelays.reduce(
    (sum, d) => sum + (Number(d.durationHours) || 0),
    0,
  );

  const foremanDiary: ForemanDiarySummary = {
    id: diary.id,
    date: formatDocketDate(diary.date),
    status: diary.status,
    personnelCount: diary.personnel.length,
    plantCount: diary.plant.length,
    weatherConditions: diary.weatherConditions,
    weatherHoursLost,
    activitiesCount: diary.activities.length,
  };

  // Feature #265 Step 4 - Highlight discrepancies
  const discrepancies: string[] = [];

  const docketPersonnelCount = docket.labourEntries.length;
  const diaryPersonnelCount = diary.personnel.length;
  if (docketPersonnelCount > 0 && diaryPersonnelCount !== docketPersonnelCount) {
    discrepancies.push(
      `Personnel count may differ: docket has ${docketPersonnelCount} entries, diary has ${diaryPersonnelCount}`,
    );
  }

  const docketPlantCount = docket.plantEntries.length;
  const diaryPlantCount = diary.plant.length;
  if (docketPlantCount > 0 && diaryPlantCount !== docketPlantCount) {
    discrepancies.push(
      `Plant/equipment count may differ: docket has ${docketPlantCount} entries, diary has ${diaryPlantCount}`,
    );
  }

  if (weatherHoursLost > 0) {
    discrepancies.push(`Weather hours lost noted in diary: ${weatherHoursLost} hours`);
  }

  return { foremanDiary, discrepancies };
}
