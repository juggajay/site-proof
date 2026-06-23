/**
 * M33: decide whether to offer "copy yesterday's crew & plant forward".
 *
 * The gate is based on the day's MANUALLY-entered crew/plant, not the full
 * timeline. Docket-sourced rows are synced automatically each day, so a day that
 * has only docket crew still has nothing manual yet — and the foreman may still
 * want to copy yesterday's manual crew forward. This mirrors the H11 backend
 * filter, which only copies source='manual' rows.
 */
export function shouldShowCopyFromYesterday(input: {
  isSubmitted: boolean;
  hasDiary: boolean;
  loading: boolean;
  manualPersonnelCount: number;
  manualPlantCount: number;
  hasCopyHandler: boolean;
}): boolean {
  return (
    !input.isSubmitted &&
    input.hasDiary &&
    !input.loading &&
    input.manualPersonnelCount === 0 &&
    input.manualPlantCount === 0 &&
    input.hasCopyHandler
  );
}
