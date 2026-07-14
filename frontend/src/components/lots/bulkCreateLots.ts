import { parseOptionalNonNegativeDecimalInput } from '@/lib/numericInput';

export interface LotPreview {
  lotNumber: string;
  description: string;
  chainageStart: number;
  chainageEnd: number;
  activityType: string;
  layer: string;
}

export type WizardStep = 'chainage' | 'parameters' | 'preview' | 'confirm';

export const ACTIVITY_TYPES = [
  'Earthworks',
  'Pavement',
  'Drainage',
  'Concrete',
  'Structures',
  'Rail',
];
export const LAYERS = ['Subgrade', 'Subbase', 'Base', 'Surface', 'Wearing Course'];
export const MAX_BULK_LOTS = 500;
export const INTERVAL_TOO_SMALL_MESSAGE =
  'Lot interval is too small to create distinct chainage ranges.';

interface BulkLotRangeValidation {
  lotCount: number | null;
  error: string | null;
}

interface BuildBulkLotPreviewInput {
  start: number;
  end: number;
  interval: number;
  lotPrefix: string;
  descriptionTemplate: string;
  activityType: string;
  layer: string;
}

interface BuildBulkLotPreviewResult {
  lots: LotPreview[];
  error: string | null;
}

export function parseChainageInput(value: string): number | null {
  return parseOptionalNonNegativeDecimalInput(value);
}

export interface ChainageExtent {
  min: number;
  max: number;
}

/** Chainage extent of a control line's ordered points, or null when unusable. */
export function controlLineChainageExtent(
  points: { chainage: number }[] | undefined,
): ChainageExtent | null {
  if (!points || points.length < 2) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.chainage)) return null;
    if (point.chainage < min) min = point.chainage;
    if (point.chainage > max) max = point.chainage;
  }
  return min < max ? { min, max } : null;
}

/**
 * Generating geometry needs every lot's chainage window inside the control
 * line — the server rejects the whole batch otherwise, so catch it here.
 */
export function validateRangeAgainstControlLine(
  start: number,
  end: number,
  extent: ChainageExtent,
  lineName: string,
): string | null {
  if (start < extent.min || end > extent.max) {
    return `${lineName} covers CH ${extent.min}–${extent.max}. Adjust the chainage range to fit inside it, or create the lots without map geometry.`;
  }
  return null;
}

function roundChainage(value: number): number {
  return Number(value.toFixed(6));
}

export function validateBulkLotRange(
  start: number | null,
  end: number | null,
  interval: number | null,
): BulkLotRangeValidation {
  if (start === null || end === null || interval === null || interval <= 0 || end <= start) {
    return { lotCount: null, error: null };
  }

  const lotCount = Math.ceil((end - start) / interval);
  if (!Number.isFinite(lotCount) || lotCount <= 0) {
    return { lotCount: null, error: 'Invalid chainage values' };
  }

  if (roundChainage(start + interval) <= roundChainage(start)) {
    return { lotCount, error: INTERVAL_TOO_SMALL_MESSAGE };
  }

  if (lotCount > MAX_BULK_LOTS) {
    return {
      lotCount,
      error: `Bulk create supports up to ${MAX_BULK_LOTS} lots. Increase the interval or narrow the chainage range.`,
    };
  }

  return { lotCount, error: null };
}

export function buildBulkLotPreview({
  start,
  end,
  interval,
  lotPrefix,
  descriptionTemplate,
  activityType,
  layer,
}: BuildBulkLotPreviewInput): BuildBulkLotPreviewResult {
  const rangeValidation = validateBulkLotRange(start, end, interval);
  if (rangeValidation.error) {
    return { lots: [], error: rangeValidation.error };
  }
  if (rangeValidation.lotCount === null) {
    return { lots: [], error: 'Invalid chainage values' };
  }

  const lots: LotPreview[] = [];
  for (let index = 0; index < rangeValidation.lotCount; index++) {
    const lotNum = index + 1;
    const ch = roundChainage(start + index * interval);
    const lotEnd = roundChainage(Math.min(start + lotNum * interval, end));
    if (lotEnd <= ch) {
      return { lots: [], error: INTERVAL_TOO_SMALL_MESSAGE };
    }

    const lotNumber = `${lotPrefix}-${String(lotNum).padStart(3, '0')}`;
    const description = descriptionTemplate
      .replace('{prefix}', lotPrefix)
      .replace('{start}', String(ch))
      .replace('{end}', String(lotEnd))
      .replace('{num}', String(lotNum));

    lots.push({
      lotNumber,
      description,
      chainageStart: ch,
      chainageEnd: lotEnd,
      activityType,
      layer,
    });
  }

  return { lots, error: null };
}
