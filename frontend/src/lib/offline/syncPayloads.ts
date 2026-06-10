// Pure payload/build helpers for offline sync, moved verbatim from
// ../useOfflineStatus.ts so the data shaping lives beside the offline database
// core. The sync worker (queue, retry, locking, API calls) stays in
// useOfflineStatus.ts and imports these helpers.

import type { OfflineDailyDiary, OfflineDocket, OfflineLotEditTable } from './core';

export function toFiniteNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function compactText(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

export function syncKey(...parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part === null || part === undefined ? '' : String(part).trim().toLowerCase()))
    .join('|');
}

function buildOfflineDiaryNotes(diary: OfflineDailyDiary): string | undefined {
  const sections: string[] = [];

  const notes = compactText(diary.notes);
  if (notes) {
    sections.push(notes);
  }

  const workforceParts = [
    diary.workforce.contractors > 0 ? `${diary.workforce.contractors} contractors` : '',
    diary.workforce.subcontractors > 0 ? `${diary.workforce.subcontractors} subcontractors` : '',
    diary.workforce.visitors > 0 ? `${diary.workforce.visitors} visitors` : '',
  ].filter(Boolean);
  const workforceNotes = compactText(diary.workforce.notes);
  if (workforceParts.length > 0 || workforceNotes) {
    sections.push(
      ['Offline workforce summary:', workforceParts.join(', '), workforceNotes]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return sections.join('\n\n') || undefined;
}

export function buildOfflineDiaryPayload(diary: OfflineDailyDiary) {
  // New offline weather writes store the real min/max pair; older records on
  // devices only carry the legacy single `temperature`, which keeps mapping to
  // both bounds exactly as before.
  const temperature = toFiniteNumber(diary.weather.temperature);

  return {
    projectId: diary.projectId,
    date: diary.date,
    weatherConditions: compactText(diary.weather.conditions),
    temperatureMin: toFiniteNumber(diary.weather.temperatureMin) ?? temperature,
    temperatureMax: toFiniteNumber(diary.weather.temperatureMax) ?? temperature,
    rainfallMm: toFiniteNumber(diary.weather.rainfall),
    weatherNotes: compactText(diary.weather.notes),
    generalNotes: buildOfflineDiaryNotes(diary),
  };
}

export function sumDocketLabourHours(docket: OfflineDocket): number {
  return docket.labourEntries.reduce((total, entry) => {
    const workers = toFiniteNumber(entry.numberOfWorkers) ?? 1;
    const hours = toFiniteNumber(entry.hoursWorked) ?? 0;
    return total + workers * hours;
  }, 0);
}

export function sumDocketPlantHours(docket: OfflineDocket): number {
  return docket.plantEntries.reduce(
    (total, entry) => total + (toFiniteNumber(entry.hoursUsed) ?? 0),
    0,
  );
}

export function buildOfflineDocketNotes(docket: OfflineDocket): string | undefined {
  const sections: string[] = [];
  const notes = compactText(docket.notes);
  if (notes) {
    sections.push(notes);
  }

  if (docket.labourEntries.length > 0) {
    sections.push(
      [
        'Offline labour summary:',
        ...docket.labourEntries.map(
          (entry) =>
            `- ${entry.description}: ${entry.numberOfWorkers} worker(s) x ${entry.hoursWorked}h${entry.notes ? ` (${entry.notes})` : ''}`,
        ),
      ].join('\n'),
    );
  }

  if (docket.plantEntries.length > 0) {
    sections.push(
      [
        'Offline plant summary:',
        ...docket.plantEntries.map(
          (entry) =>
            `- ${entry.equipmentType}: ${entry.hoursUsed}h${entry.notes ? ` (${entry.notes})` : ''}`,
        ),
      ].join('\n'),
    );
  }

  return sections.join('\n\n') || undefined;
}

// Shape the PATCH body sent to /api/lots/:id when an offline lot edit syncs.
//
// The offline record stores the budget under the internal key `budget`, but the
// backend updateLotSchema field is `budgetAmount` and Zod silently strips any
// unknown key. Sending `budget` therefore discarded offline budget edits on
// sync (the value never reached the database). This builder maps the internal
// field name to the server's API field name so the budget actually lands.
//
// `notes` is intentionally omitted: the lot update route's schema does not
// accept a `notes` key (it is stripped server-side today), so sending it was a
// no-op. The offline lot-edit form never populates `notes` either.
export function buildOfflineLotEditPayload(lot: OfflineLotEditTable) {
  return {
    lotNumber: lot.lotNumber,
    description: lot.description,
    chainage: lot.chainage,
    chainageStart: lot.chainageStart,
    chainageEnd: lot.chainageEnd,
    offset: lot.offset,
    offsetLeft: lot.offsetLeft,
    offsetRight: lot.offsetRight,
    layer: lot.layer,
    areaZone: lot.areaZone,
    activityType: lot.activityType,
    status: lot.status,
    budgetAmount: lot.budget,
  };
}
