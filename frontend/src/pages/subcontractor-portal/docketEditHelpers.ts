// ===== Docket edit time/validation/status helpers =====
// Pure helpers moved verbatim out of DocketEditPage so the labour time
// calculation, plant hours validation, and editable-status rule can be unit
// tested without the page. Display formatters (formatCurrency/formatDate)
// already live in ./docketEditDisplay; the time presets stay with the entry
// sheet UI in ./components/DocketEntrySheet.

export function calculateHours(startTime: string, finishTime: string): number {
  if (!startTime || !finishTime) return 0;
  const [startH, startM] = startTime.split(':').map(Number);
  const [finishH, finishM] = finishTime.split(':').map(Number);
  let hours = finishH + finishM / 60 - (startH + startM / 60);
  if (hours < 0) hours += 24; // Handle overnight
  return Math.round(hours * 10) / 10; // Round to 1 decimal
}

const DAILY_HOURS_PATTERN = /^\d+(?:\.\d+)?$/;
export const PLANT_HOURS_INPUT_ERROR = 'Hours operated must be greater than 0 and 24 or less.';

export function parseDailyHoursInput(value: string): number | null {
  const normalized = value.trim();
  if (!normalized || !DAILY_HOURS_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 24 ? parsed : null;
}

export function getPlantHoursError(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return 'Hours operated is required.';
  }
  if (normalized.startsWith('-')) {
    return 'Hours operated cannot be negative.';
  }
  return parseDailyHoursInput(value) === null ? PLANT_HOURS_INPUT_ERROR : null;
}

export function isEditableDocketStatus(status?: string) {
  return !status || status === 'draft' || status === 'queried' || status === 'rejected';
}
