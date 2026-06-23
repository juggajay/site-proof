import { describe, expect, it } from 'vitest';
import { shouldShowCopyFromYesterday } from './diaryCopyAffordance';

const base = {
  isSubmitted: false,
  hasDiary: true,
  loading: false,
  manualPersonnelCount: 0,
  manualPlantCount: 0,
  hasCopyHandler: true,
};

describe('shouldShowCopyFromYesterday (M33)', () => {
  it('shows when a draft diary exists with no manual crew/plant and a copy handler', () => {
    expect(shouldShowCopyFromYesterday(base)).toBe(true);
  });

  it('still shows when only docket-sourced rows exist (manual counts are zero)', () => {
    // Docket rows do not bump the manual counts, so the affordance stays visible.
    expect(
      shouldShowCopyFromYesterday({ ...base, manualPersonnelCount: 0, manualPlantCount: 0 }),
    ).toBe(true);
  });

  it('hides once there is a manually-entered crew or plant row', () => {
    expect(shouldShowCopyFromYesterday({ ...base, manualPersonnelCount: 1 })).toBe(false);
    expect(shouldShowCopyFromYesterday({ ...base, manualPlantCount: 1 })).toBe(false);
  });

  it('hides without a diary, while loading, or when submitted', () => {
    expect(shouldShowCopyFromYesterday({ ...base, hasDiary: false })).toBe(false);
    expect(shouldShowCopyFromYesterday({ ...base, loading: true })).toBe(false);
    expect(shouldShowCopyFromYesterday({ ...base, isSubmitted: true })).toBe(false);
  });

  it('hides when no copy handler is available', () => {
    expect(shouldShowCopyFromYesterday({ ...base, hasCopyHandler: false })).toBe(false);
  });
});
