import { describe, expect, it } from 'vitest';

import { buildMobileLotFilterConfigs, countActiveLotFilters } from './lotFiltersBarHelpers';

describe('lotFiltersBarHelpers', () => {
  it('counts each active lot filter category once', () => {
    expect(
      countActiveLotFilters({
        statusFilters: ['in_progress', 'hold_point'],
        activityFilter: 'earthworks',
        searchQuery: 'EW',
        chainageMinFilter: '10',
        chainageMaxFilter: '',
        subcontractorFilter: 'sub-1',
        areaZoneFilter: 'North',
      }),
    ).toBe(6);

    expect(
      countActiveLotFilters({
        statusFilters: [],
        activityFilter: '',
        searchQuery: '',
        chainageMinFilter: '',
        chainageMaxFilter: '',
        subcontractorFilter: '',
        areaZoneFilter: '',
      }),
    ).toBe(0);
  });

  it('builds mobile filter configs with subcontractor and area options only when available', () => {
    expect(
      buildMobileLotFilterConfigs({
        statusFilters: ['in_progress'],
        activityFilter: 'earthworks',
        activityTypes: ['earthworks', null, undefined, 'drainage'],
        isSubcontractor: false,
        subcontractors: [{ id: 'sub-1', companyName: 'Road Crew Pty Ltd' }],
        subcontractorFilter: 'sub-1',
        areaZones: ['North'],
        areaZoneFilter: 'North',
      }).map((filter) => ({ id: filter.id, type: filter.type, value: filter.value })),
    ).toEqual([
      { id: 'status', type: 'multiselect', value: ['in_progress'] },
      { id: 'activity', type: 'select', value: 'earthworks' },
      { id: 'subcontractor', type: 'select', value: 'sub-1' },
      { id: 'areaZone', type: 'select', value: 'North' },
    ]);

    expect(
      buildMobileLotFilterConfigs({
        statusFilters: [],
        activityFilter: '',
        activityTypes: [],
        isSubcontractor: true,
        subcontractors: [{ id: 'sub-1', companyName: 'Road Crew Pty Ltd' }],
        subcontractorFilter: '',
        areaZones: [],
        areaZoneFilter: '',
      }).map((filter) => filter.id),
    ).toEqual(['status', 'activity']);
  });
});
