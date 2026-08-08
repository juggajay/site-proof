import type { DryRunRow, Resolutions } from './importData';

/**
 * Bulk-learn: one activity pick teaches every row that failed on the SAME raw
 * value. The server's `unresolvable_activity` detail line quotes the raw value,
 * so equal detail = equal raw. Rows with NO activity (unquoted detail) keep
 * per-row picks — different lots on one register can genuinely be different
 * activities.
 */
export function learnActivityAcrossRows(
  resolutions: Resolutions,
  rows: DryRunRow[],
  pickedKey: string,
  activitySlug: string | undefined,
): Resolutions {
  const source = rows.find((row) => row.key === pickedKey);
  if (source?.reason !== 'unresolvable_activity' || !source.detail?.startsWith('"')) {
    return resolutions;
  }
  const next = { ...resolutions };
  for (const row of rows) {
    if (
      row.key !== pickedKey &&
      row.reason === 'unresolvable_activity' &&
      row.detail === source.detail
    ) {
      next[row.key] = { ...next[row.key], activitySlug };
    }
  }
  return next;
}
