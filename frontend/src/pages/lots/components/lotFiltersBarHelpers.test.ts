import { describe, expect, it } from 'vitest';

import {
  buildMobileLotFilterConfigs,
  countActiveLotFilters,
  createSavedFilterSnapshot,
  parseSavedFiltersPreference,
} from './lotFiltersBarHelpers';

describe('lotFiltersBarHelpers', () => {
  describe('parseSavedFiltersPreference', () => {
    it('returns valid saved filters and drops malformed entries', () => {
      const savedFilters = parseSavedFiltersPreference(
        JSON.stringify([
          {
            id: 'saved-1',
            name: 'Open earthworks',
            status: 'in_progress',
            activity: 'earthworks',
            search: 'EW',
            subcontractor: 'sub-1',
            areaZone: 'North',
            createdAt: '2026-06-06T00:00:00.000Z',
          },
          { id: 'bad', name: 'Missing required fields' },
          null,
        ]),
      );

      expect(savedFilters).toEqual([
        {
          id: 'saved-1',
          name: 'Open earthworks',
          status: 'in_progress',
          activity: 'earthworks',
          search: 'EW',
          subcontractor: 'sub-1',
          areaZone: 'North',
          createdAt: '2026-06-06T00:00:00.000Z',
        },
      ]);
    });

    it('falls back to an empty list for invalid JSON or non-array values', () => {
      expect(parseSavedFiltersPreference('not json')).toEqual([]);
      expect(parseSavedFiltersPreference('{"id":"saved-1"}')).toEqual([]);
      expect(parseSavedFiltersPreference(null)).toEqual([]);
    });
  });

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

  it('creates a trimmed saved filter snapshot and rejects blank names', () => {
    expect(
      createSavedFilterSnapshot({
        name: '  North hold points  ',
        id: 'filter-1',
        createdAt: '2026-06-06T00:00:00.000Z',
        statusFilters: ['hold_point', 'ncr_raised'],
        activityFilter: 'pavements',
        searchQuery: 'HP',
        subcontractorFilter: 'sub-2',
        areaZoneFilter: 'North',
      }),
    ).toEqual({
      id: 'filter-1',
      name: 'North hold points',
      status: 'hold_point,ncr_raised',
      activity: 'pavements',
      search: 'HP',
      subcontractor: 'sub-2',
      areaZone: 'North',
      createdAt: '2026-06-06T00:00:00.000Z',
    });

    expect(
      createSavedFilterSnapshot({
        name: '   ',
        id: 'filter-1',
        createdAt: '2026-06-06T00:00:00.000Z',
        statusFilters: [],
        activityFilter: '',
        searchQuery: '',
        subcontractorFilter: '',
        areaZoneFilter: '',
      }),
    ).toBeNull();
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
