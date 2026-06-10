/**
 * useCopyFromYesterday
 *
 * Provides "copy from yesterday" logic for personnel and plant sections of the
 * daily diary. Fetches the previous day's entries via the existing
 * GET /api/diary/:projectId/:date/previous-personnel and
 * GET /api/diary/:projectId/:date/previous-plant endpoints, deduplicates
 * against today's entries, and creates each new entry via the single-entry
 * POST path — so offline queueing (plant) and the existing mutation contract
 * (personnel) are preserved untouched.
 *
 * The diary must exist before entries can attach. When `diary` is null the
 * copy action is disabled — callers should surface the same "Record the
 * weather to start the day's diary" guidance the rest of the app uses.
 */

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { parseOptionalDiaryHoursInput } from '../diaryNumericInput';
import type { DailyDiary, Personnel, Plant } from '../types';

// ----- Types matching backend response shapes --------------------------------

interface PreviousPersonnelEntry {
  name: string;
  company?: string | null;
  role?: string | null;
  startTime?: string | null;
  finishTime?: string | null;
  hours?: number | string | null;
}

interface PreviousPlantEntry {
  description: string;
  idRego?: string | null;
  company?: string | null;
  hoursOperated?: number | string | null;
  notes?: string | null;
}

interface PreviousPersonnelResponse {
  personnel: PreviousPersonnelEntry[];
  previousDate?: string;
  message?: string;
}

interface PreviousPlantResponse {
  plant: PreviousPlantEntry[];
  previousDate?: string;
  message?: string;
}

// ----- Pure mapping helpers (exported for unit tests) -----------------------

/**
 * Maps a previous-day personnel entry to a POST-ready create payload.
 * Coerces Prisma-Decimal string hours (e.g. "8.5") to numbers because the
 * POST schema validates hours as z.number(). Omits invalid/zero values.
 */
export function mapPersonnelEntryToPayload(entry: PreviousPersonnelEntry): Record<string, unknown> {
  const payload: Record<string, unknown> = { name: entry.name };
  if (entry.company) payload.company = entry.company;
  if (entry.role) payload.role = entry.role;
  if (entry.startTime) payload.startTime = entry.startTime;
  if (entry.finishTime) payload.finishTime = entry.finishTime;
  if (entry.hours !== null && entry.hours !== undefined) {
    const hours = parseOptionalDiaryHoursInput(String(entry.hours));
    if (typeof hours === 'number') payload.hours = hours;
  }
  return payload;
}

/**
 * Maps a previous-day plant entry to a POST-ready create payload.
 * Same hours coercion as personnel.
 */
export function mapPlantEntryToPayload(entry: PreviousPlantEntry): Record<string, unknown> {
  const payload: Record<string, unknown> = { description: entry.description };
  if (entry.idRego) payload.idRego = entry.idRego;
  if (entry.company) payload.company = entry.company;
  if (entry.notes) payload.notes = entry.notes;
  if (entry.hoursOperated !== null && entry.hoursOperated !== undefined) {
    const hours = parseOptionalDiaryHoursInput(String(entry.hoursOperated));
    if (typeof hours === 'number') payload.hoursOperated = hours;
  }
  return payload;
}

/**
 * Returns entries from `incoming` that are not already present in `existing`
 * by matching on the identity field (name for personnel, description for plant).
 * Case-insensitive trim to avoid minor whitespace dupes.
 */
export function dedupePersonnel(
  incoming: PreviousPersonnelEntry[],
  existing: Personnel[],
): PreviousPersonnelEntry[] {
  const existingNames = new Set(existing.map((p) => p.name.trim().toLowerCase()));
  return incoming.filter((p) => !existingNames.has(p.name.trim().toLowerCase()));
}

export function dedupePlant(
  incoming: PreviousPlantEntry[],
  existing: Plant[],
): PreviousPlantEntry[] {
  const existingDescs = new Set(existing.map((p) => p.description.trim().toLowerCase()));
  return incoming.filter((p) => !existingDescs.has(p.description.trim().toLowerCase()));
}

// ----- Hook ------------------------------------------------------------------

interface UseCopyFromYesterdayParams {
  projectId: string | undefined;
  selectedDate: string;
  diary: DailyDiary | null;
  onDiaryUpdate: (diary: DailyDiary) => void;
}

export function useCopyFromYesterday({
  projectId,
  selectedDate,
  diary,
  onDiaryUpdate,
}: UseCopyFromYesterdayParams) {
  const [copyingPersonnel, setCopyingPersonnel] = useState(false);
  const [copyingPlant, setCopyingPlant] = useState(false);

  const copyPersonnelFromYesterday = async () => {
    if (!projectId || !diary || copyingPersonnel) return;
    setCopyingPersonnel(true);
    try {
      const data = await apiFetch<PreviousPersonnelResponse>(
        `/api/diary/${encodeURIComponent(projectId)}/${encodeURIComponent(selectedDate)}/previous-personnel`,
      );

      const candidates = data.personnel ?? [];
      if (candidates.length === 0) {
        toast({
          title: 'No personnel found',
          description: 'There were no personnel records on the previous day.',
          variant: 'warning',
        });
        return;
      }

      const toAdd = dedupePersonnel(candidates, diary.personnel);
      if (toAdd.length === 0) {
        toast({
          title: 'Already up to date',
          description: "Yesterday's personnel are already on today's diary.",
          variant: 'warning',
        });
        return;
      }

      let addedCount = 0;
      let updatedDiary = diary;
      for (const entry of toAdd) {
        const payload = mapPersonnelEntryToPayload(entry);
        try {
          const created = await apiFetch<Personnel>(
            `/api/diary/${encodeURIComponent(diary.id)}/personnel`,
            { method: 'POST', body: JSON.stringify(payload) },
          );
          updatedDiary = { ...updatedDiary, personnel: [...updatedDiary.personnel, created] };
          addedCount++;
        } catch {
          // skip individual failures — partial success is still useful
        }
      }

      onDiaryUpdate(updatedDiary);
      toast({
        title: addedCount > 0 ? `Added ${addedCount} from yesterday` : 'No personnel copied',
        description:
          addedCount > 0
            ? `${addedCount} personnel carried forward from the previous day.`
            : 'Previous personnel records could not be added.',
        variant: addedCount > 0 ? 'success' : 'warning',
      });
    } catch (err) {
      logError('Error copying personnel from yesterday:', err);
      toast({
        title: 'Error copying personnel',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      setCopyingPersonnel(false);
    }
  };

  const copyPlantFromYesterday = async () => {
    if (!projectId || !diary || copyingPlant) return;
    setCopyingPlant(true);
    try {
      const data = await apiFetch<PreviousPlantResponse>(
        `/api/diary/${encodeURIComponent(projectId)}/${encodeURIComponent(selectedDate)}/previous-plant`,
      );

      const candidates = data.plant ?? [];
      if (candidates.length === 0) {
        toast({
          title: 'No plant found',
          description: 'There was no plant recorded on the previous day.',
          variant: 'warning',
        });
        return;
      }

      const toAdd = dedupePlant(candidates, diary.plant);
      if (toAdd.length === 0) {
        toast({
          title: 'Already up to date',
          description: "Yesterday's plant is already on today's diary.",
          variant: 'warning',
        });
        return;
      }

      let addedCount = 0;
      let updatedDiary = diary;
      for (const entry of toAdd) {
        const payload = mapPlantEntryToPayload(entry);
        try {
          const created = await apiFetch<Plant>(
            `/api/diary/${encodeURIComponent(diary.id)}/plant`,
            { method: 'POST', body: JSON.stringify(payload) },
          );
          updatedDiary = { ...updatedDiary, plant: [...updatedDiary.plant, created] };
          addedCount++;
        } catch {
          // skip individual failures
        }
      }

      onDiaryUpdate(updatedDiary);
      toast({
        title: addedCount > 0 ? `Added ${addedCount} from yesterday` : 'No plant copied',
        description:
          addedCount > 0
            ? `${addedCount} plant entries carried forward from the previous day.`
            : 'Previous plant records could not be added.',
        variant: addedCount > 0 ? 'success' : 'warning',
      });
    } catch (err) {
      logError('Error copying plant from yesterday:', err);
      toast({
        title: 'Error copying plant',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      setCopyingPlant(false);
    }
  };

  return {
    copyPersonnelFromYesterday,
    copyingPersonnel,
    copyPlantFromYesterday,
    copyingPlant,
    /** Whether the copy actions are available (diary must exist) */
    canCopy: diary !== null,
  };
}
