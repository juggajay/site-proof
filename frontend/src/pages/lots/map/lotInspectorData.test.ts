import { describe, expect, it } from 'vitest';

import type { HoldPoint } from '@/pages/holdpoints/types';
import type { ITPInstance } from '@/pages/lots/types';
import {
  completionPhotos,
  daysOpen,
  neighbouringLotIds,
  openHoldPointsForLot,
  orderGeometriesAlongAlignment,
  provenanceLabel,
  searchLotGeometries,
} from './lotInspectorData';
import type { ProjectLotGeometry } from './lotMapData';

function geometry(over: Partial<ProjectLotGeometry>): ProjectLotGeometry {
  return {
    id: 'g',
    lotId: 'lot',
    lotNumber: 'LOT-000',
    status: 'in_progress',
    activityType: 'Earthworks',
    kind: 'chainage_offset',
    controlLineId: 'cl-1',
    geometryWgs84: { type: 'Feature', geometry: { type: 'Point', coordinates: [151, -33.8] } },
    areaM2: null,
    lengthM: null,
    chainageStart: null,
    chainageEnd: null,
    ...over,
  };
}

const fixture = [
  geometry({ lotId: 'c', lotNumber: 'LOT-003', chainageStart: 200, chainageEnd: 300 }),
  geometry({ lotId: 'a', lotNumber: 'LOT-001', chainageStart: 0, chainageEnd: 100 }),
  // No control line: sorts after every aligned lot regardless of chainage.
  geometry({ lotId: 'z', lotNumber: 'LOT-000', controlLineId: null, chainageStart: 0 }),
  geometry({ lotId: 'b', lotNumber: 'LOT-002', chainageStart: 100, chainageEnd: 200 }),
];

describe('orderGeometriesAlongAlignment', () => {
  it('walks control line then chainage, unaligned lots last', () => {
    expect(orderGeometriesAlongAlignment(fixture).map((g) => g.lotId)).toEqual([
      'a',
      'b',
      'c',
      'z',
    ]);
  });

  it('breaks chainage ties on lot number, numerically', () => {
    const tied = [
      geometry({ lotId: 'x10', lotNumber: 'LOT-10', chainageStart: 0 }),
      geometry({ lotId: 'x2', lotNumber: 'LOT-2', chainageStart: 0 }),
    ];
    expect(orderGeometriesAlongAlignment(tied).map((g) => g.lotId)).toEqual(['x2', 'x10']);
  });
});

describe('neighbouringLotIds', () => {
  it('returns the ordered neighbours of the selected lot', () => {
    expect(neighbouringLotIds(fixture, 'b')).toEqual({ prevId: 'a', nextId: 'c' });
  });

  it('has no prev at the start and no next at the end', () => {
    expect(neighbouringLotIds(fixture, 'a')).toEqual({ prevId: null, nextId: 'b' });
    expect(neighbouringLotIds(fixture, 'z')).toEqual({ prevId: 'c', nextId: null });
  });

  it('returns nulls for a lot not in the set', () => {
    expect(neighbouringLotIds(fixture, 'missing')).toEqual({ prevId: null, nextId: null });
  });
});

describe('searchLotGeometries', () => {
  it('matches lot number fragments case-insensitively', () => {
    expect(searchLotGeometries(fixture, 'lot-003').map((g) => g.lotId)).toEqual(['c']);
  });

  it('matches a bare chainage number that falls inside an extent', () => {
    expect(searchLotGeometries(fixture, '150').map((g) => g.lotId)).toEqual(['b']);
  });

  it('matches plain-word status text', () => {
    const mixed = [
      geometry({ lotId: 'p', lotNumber: 'LOT-009', status: 'conformed' }),
      geometry({ lotId: 'q', lotNumber: 'LOT-008', status: 'in_progress' }),
    ];
    expect(searchLotGeometries(mixed, 'conformed').map((g) => g.lotId)).toEqual(['p']);
  });

  it('matches activity text', () => {
    const mixed = [
      geometry({ lotId: 'p', lotNumber: 'LOT-009', activityType: 'Drainage' }),
      geometry({ lotId: 'q', lotNumber: 'LOT-008', activityType: 'Earthworks' }),
    ];
    expect(searchLotGeometries(mixed, 'drain').map((g) => g.lotId)).toEqual(['p']);
  });

  it('returns nothing for an empty query and caps the result count', () => {
    expect(searchLotGeometries(fixture, '   ')).toEqual([]);
    const many = Array.from({ length: 10 }, (_, i) =>
      geometry({ lotId: `m${i}`, lotNumber: `LOT-10${i}` }),
    );
    expect(searchLotGeometries(many, 'lot')).toHaveLength(6);
  });
});

describe('provenanceLabel', () => {
  it('names the three geometry kinds in words', () => {
    expect(provenanceLabel('chainage_offset')).toBe('From chainage');
    expect(provenanceLabel('drawn')).toBe('Drawn on map');
    expect(provenanceLabel('point')).toBe('Point marker');
  });
});

describe('openHoldPointsForLot', () => {
  const hp = (over: Partial<HoldPoint>): HoldPoint =>
    ({
      id: 'hp',
      lotId: 'lot-1',
      status: 'notified',
      description: 'Inspect',
      createdAt: '2026-01-01T00:00:00.000Z',
      ...over,
    }) as HoldPoint;

  it('keeps everything not released for the lot (the readiness rule)', () => {
    const rows = [
      hp({ id: 'open', status: 'notified' }),
      hp({ id: 'released', status: 'released' }),
      hp({ id: 'other-lot', lotId: 'lot-2' }),
    ];
    expect(openHoldPointsForLot(rows, 'lot-1').map((h) => h.id)).toEqual(['open']);
  });

  it('is empty while the register has not loaded', () => {
    expect(openHoldPointsForLot(undefined, 'lot-1')).toEqual([]);
  });
});

describe('daysOpen', () => {
  it('floors to whole days and never goes negative', () => {
    const now = Date.parse('2026-01-11T12:00:00.000Z');
    expect(daysOpen('2026-01-01T00:00:00.000Z', now)).toBe(10);
    expect(daysOpen('2026-02-01T00:00:00.000Z', now)).toBe(0);
    expect(daysOpen('not-a-date', now)).toBe(0);
  });
});

describe('completionPhotos', () => {
  it('flattens attachments newest-first and caps the count', () => {
    const doc = (id: string, uploadedAt: string) => ({
      id,
      documentId: id,
      document: {
        id,
        filename: `${id}.jpg`,
        caption: null,
        uploadedAt,
        uploadedBy: null,
        gpsLatitude: null,
        gpsLongitude: null,
      },
    });
    const instance = {
      id: 'inst',
      template: { id: 't', name: 'T', checklistItems: [] },
      completions: [
        {
          id: 'c1',
          checklistItemId: 'i1',
          isCompleted: true,
          notes: null,
          completedAt: null,
          completedBy: null,
          isVerified: false,
          verifiedAt: null,
          verifiedBy: null,
          attachments: [doc('old', '2026-01-01'), doc('new', '2026-03-01')],
        },
      ],
    } as unknown as ITPInstance;

    expect(completionPhotos(instance).map((d) => d.id)).toEqual(['new', 'old']);
    expect(completionPhotos(null)).toEqual([]);
    expect(completionPhotos(instance, 1)).toHaveLength(1);
  });
});
