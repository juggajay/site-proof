// Characterization tests for the pure offline sync payload helpers. These pin
// the wire payload shapes, summary text, dedupe key construction, numeric
// parsing, and empty-value handling that the offline sync worker relies on.

import { describe, expect, it } from 'vitest';

import type { OfflineDailyDiary, OfflineDocket, OfflineLotEditTable } from './core';
import {
  buildOfflineDiaryPayload,
  buildOfflineDocketNotes,
  buildOfflineLotEditPayload,
  compactText,
  sumDocketLabourHours,
  sumDocketPlantHours,
  syncKey,
  toFiniteNumber,
} from './syncPayloads';

function makeDiary(overrides: Partial<OfflineDailyDiary> = {}): OfflineDailyDiary {
  return {
    id: 'diary-1',
    projectId: 'project-1',
    date: '2026-06-04',
    status: 'draft',
    weather: {},
    workforce: { contractors: 0, subcontractors: 0, visitors: 0 },
    activities: [],
    delays: [],
    equipment: [],
    createdBy: 'user-1',
    syncStatus: 'pending',
    localUpdatedAt: '2026-06-04T00:00:00.000Z',
    ...overrides,
  };
}

function makeDocket(overrides: Partial<OfflineDocket> = {}): OfflineDocket {
  return {
    id: 'docket-1',
    projectId: 'project-1',
    subcontractorCompanyId: 'subbie-1',
    date: '2026-06-04',
    status: 'draft',
    labourEntries: [],
    plantEntries: [],
    createdBy: 'user-1',
    syncStatus: 'pending',
    localUpdatedAt: '2026-06-04T00:00:00.000Z',
    ...overrides,
  };
}

function makeOfflineLot(overrides: Partial<OfflineLotEditTable> = {}): OfflineLotEditTable {
  return {
    id: 'lot-1',
    projectId: 'project-1',
    lotNumber: 'LOT-001',
    syncStatus: 'pending',
    localUpdatedAt: '2026-06-04T00:00:00.000Z',
    editedBy: 'user-1',
    ...overrides,
  };
}

function makeLabourEntry(
  overrides: Partial<OfflineDocket['labourEntries'][number]> = {},
): OfflineDocket['labourEntries'][number] {
  return {
    id: 'labour-1',
    description: 'Formwork crew',
    numberOfWorkers: 1,
    hoursWorked: 0,
    ...overrides,
  };
}

function makePlantEntry(
  overrides: Partial<OfflineDocket['plantEntries'][number]> = {},
): OfflineDocket['plantEntries'][number] {
  return {
    id: 'plant-1',
    equipmentType: 'Excavator',
    hoursUsed: 0,
    ...overrides,
  };
}

describe('toFiniteNumber', () => {
  it('parses finite numbers and rejects blanks and non-numeric values', () => {
    expect(toFiniteNumber(4.5)).toBe(4.5);
    expect(toFiniteNumber('4.5')).toBe(4.5);
    expect(toFiniteNumber(0)).toBe(0);
    expect(toFiniteNumber('')).toBeUndefined();
    expect(toFiniteNumber(null)).toBeUndefined();
    expect(toFiniteNumber(undefined)).toBeUndefined();
    expect(toFiniteNumber('abc')).toBeUndefined();
    expect(toFiniteNumber(Number.NaN)).toBeUndefined();
  });
});

describe('compactText', () => {
  it('trims text and collapses blank or missing values to undefined', () => {
    expect(compactText('  trimmed  ')).toBe('trimmed');
    expect(compactText('   ')).toBeUndefined();
    expect(compactText('')).toBeUndefined();
    expect(compactText(null)).toBeUndefined();
    expect(compactText(undefined)).toBeUndefined();
  });
});

describe('syncKey', () => {
  it('normalises null, undefined, and empty parts to the same key', () => {
    expect(syncKey('Pour Slab', null, undefined)).toBe('pour slab||');
    expect(syncKey(' Pour Slab ', '', '')).toBe('pour slab||');
    expect(syncKey('A', 1, null)).toBe(syncKey('a', '1', undefined));
  });

  it('keeps part positions distinct so different field orders never collide', () => {
    expect(syncKey('a', '', 'b')).not.toBe(syncKey('a', 'b', ''));
  });
});

describe('buildOfflineDiaryPayload', () => {
  it('preserves the project/date/weather/general notes mapping', () => {
    const payload = buildOfflineDiaryPayload(
      makeDiary({
        notes: '  Poured slab  ',
        weather: { conditions: ' Sunny ', temperature: 24, rainfall: 3.5, notes: ' Humid ' },
      }),
    );

    expect(payload).toEqual({
      projectId: 'project-1',
      date: '2026-06-04',
      weatherConditions: 'Sunny',
      temperatureMin: 24,
      temperatureMax: 24,
      rainfallMm: 3.5,
      weatherNotes: 'Humid',
      generalNotes: 'Poured slab',
    });
  });

  it('prefers the stored min/max temperature pair and falls back to the legacy single reading', () => {
    const withPair = buildOfflineDiaryPayload(
      makeDiary({ weather: { temperatureMin: 8, temperatureMax: 31 } }),
    );
    expect(withPair.temperatureMin).toBe(8);
    expect(withPair.temperatureMax).toBe(31);

    // Records written before the quick-add wiring only carry `temperature`;
    // it keeps mapping to both bounds exactly as before.
    const legacy = buildOfflineDiaryPayload(
      makeDiary({ weather: { temperature: 24, temperatureMax: 31 } }),
    );
    expect(legacy.temperatureMin).toBe(24);
    expect(legacy.temperatureMax).toBe(31);
  });

  it('drops blank weather fields and empty notes instead of sending empty strings', () => {
    const payload = buildOfflineDiaryPayload(makeDiary({ weather: { conditions: '   ' } }));

    expect(payload.weatherConditions).toBeUndefined();
    expect(payload.temperatureMin).toBeUndefined();
    expect(payload.temperatureMax).toBeUndefined();
    expect(payload.rainfallMm).toBeUndefined();
    expect(payload.weatherNotes).toBeUndefined();
    expect(payload.generalNotes).toBeUndefined();
  });

  it('includes the workforce summary only when workforce data is present', () => {
    const withoutWorkforce = buildOfflineDiaryPayload(makeDiary({ notes: 'Site notes' }));
    expect(withoutWorkforce.generalNotes).toBe('Site notes');

    const withWorkforce = buildOfflineDiaryPayload(
      makeDiary({
        notes: 'Site notes',
        workforce: { contractors: 3, subcontractors: 2, visitors: 0, notes: 'Inducted late' },
      }),
    );
    expect(withWorkforce.generalNotes).toBe(
      'Site notes\n\nOffline workforce summary:\n3 contractors, 2 subcontractors\nInducted late',
    );

    const workforceNotesOnly = buildOfflineDiaryPayload(
      makeDiary({
        workforce: { contractors: 0, subcontractors: 0, visitors: 0, notes: 'Visitors expected' },
      }),
    );
    expect(workforceNotesOnly.generalNotes).toBe('Offline workforce summary:\nVisitors expected');
  });
});

describe('sumDocketLabourHours', () => {
  it('multiplies workers by hours and defaults workers to 1', () => {
    const docket = makeDocket({
      labourEntries: [
        makeLabourEntry({ numberOfWorkers: 2, hoursWorked: 8 }),
        makeLabourEntry({ id: 'labour-2', numberOfWorkers: Number.NaN, hoursWorked: 4 }),
        makeLabourEntry({ id: 'labour-3', numberOfWorkers: 3, hoursWorked: Number.NaN }),
      ],
    });

    // 2 x 8 = 16, NaN workers default to 1 x 4 = 4, NaN hours default to 0.
    expect(sumDocketLabourHours(docket)).toBe(20);
  });
});

describe('sumDocketPlantHours', () => {
  it('sums plant hours and treats non-finite hours as zero', () => {
    const docket = makeDocket({
      plantEntries: [
        makePlantEntry({ hoursUsed: 5.5 }),
        makePlantEntry({ id: 'plant-2', hoursUsed: Number.NaN }),
      ],
    });

    expect(sumDocketPlantHours(docket)).toBe(5.5);
  });
});

describe('buildOfflineDocketNotes', () => {
  it('includes docket notes plus labour and plant summaries', () => {
    const docket = makeDocket({
      notes: ' Wet morning ',
      labourEntries: [
        makeLabourEntry({
          description: 'Formwork crew',
          numberOfWorkers: 2,
          hoursWorked: 8,
          notes: 'Overtime',
        }),
      ],
      plantEntries: [makePlantEntry({ equipmentType: 'Excavator', hoursUsed: 5 })],
    });

    expect(buildOfflineDocketNotes(docket)).toBe(
      'Wet morning\n\nOffline labour summary:\n- Formwork crew: 2 worker(s) x 8h (Overtime)\n\nOffline plant summary:\n- Excavator: 5h',
    );
  });

  it('returns undefined when there is nothing to summarise', () => {
    expect(buildOfflineDocketNotes(makeDocket())).toBeUndefined();
  });
});

describe('buildOfflineLotEditPayload', () => {
  it('sends the budget under the server field name budgetAmount, never budget', () => {
    const payload = buildOfflineLotEditPayload(makeOfflineLot({ budget: 125000 }));

    // Regression guard: the backend updateLotSchema strips unknown keys, so an
    // offline budget edit sent as `budget` silently vanished on sync. It must be
    // mapped to `budgetAmount` (the schema's field) to actually reach the DB.
    expect(payload.budgetAmount).toBe(125000);
    expect(payload).not.toHaveProperty('budget');
  });

  it('omits notes, which the lot update schema does not accept', () => {
    const payload = buildOfflineLotEditPayload(makeOfflineLot({ notes: 'should be dropped' }));

    expect(payload).not.toHaveProperty('notes');
  });

  it('maps the remaining editable fields straight through', () => {
    const payload = buildOfflineLotEditPayload(
      makeOfflineLot({
        lotNumber: 'LOT-042',
        description: 'Subgrade prep',
        chainage: 100,
        chainageStart: 100,
        chainageEnd: 200,
        offset: 1.5,
        offsetLeft: 1,
        offsetRight: 2,
        layer: 'Subgrade',
        areaZone: 'Zone A',
        activityType: 'earthworks',
        status: 'in_progress',
        budget: 5000,
      }),
    );

    expect(payload).toEqual({
      lotNumber: 'LOT-042',
      description: 'Subgrade prep',
      chainage: 100,
      chainageStart: 100,
      chainageEnd: 200,
      offset: 1.5,
      offsetLeft: 1,
      offsetRight: 2,
      layer: 'Subgrade',
      areaZone: 'Zone A',
      activityType: 'earthworks',
      status: 'in_progress',
      budgetAmount: 5000,
    });
  });
});
