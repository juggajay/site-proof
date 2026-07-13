import { describe, expect, it } from 'vitest';

import { ALL_WORK_TYPES, selectCoverageGroup, type CoverageLine } from './coverageData';

function group(activityType: string) {
  return {
    activityType,
    lotCount: 1,
    percentLotted: 50,
    percentConformed: 25,
    coveredLengthM: 50,
    conformedLengthM: 25,
    gaps: [],
  };
}

const line: CoverageLine = {
  id: 'cl-1',
  name: 'MC00',
  extentStart: 0,
  extentEnd: 100,
  groups: [group(ALL_WORK_TYPES), group('Earthworks'), group('Drainage')],
};

describe('selectCoverageGroup', () => {
  it('returns the group matching the requested activity', () => {
    expect(selectCoverageGroup(line, 'Earthworks')?.activityType).toBe('Earthworks');
  });

  it('falls back to the "All work types" aggregate for an unknown activity', () => {
    expect(selectCoverageGroup(line, 'Nonexistent')?.activityType).toBe(ALL_WORK_TYPES);
  });

  it('returns null for an error line with no groups', () => {
    expect(
      selectCoverageGroup({ id: 'x', name: 'Broken', error: 'bad' }, ALL_WORK_TYPES),
    ).toBeNull();
  });

  it('returns null when groups is empty', () => {
    expect(selectCoverageGroup({ id: 'y', name: 'Empty', groups: [] }, ALL_WORK_TYPES)).toBeNull();
  });
});
