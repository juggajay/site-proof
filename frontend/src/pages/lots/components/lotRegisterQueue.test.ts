import { describe, expect, it } from 'vitest';
import {
  LOT_PRESET_VIEWS,
  buildLotRegisterRows,
  countLotGroups,
  lotDaysOpen,
  lotGroupKey,
  lotGroupLabel,
  lotGroupSortKey,
  parseCollapsedGroupsPreference,
  parseLotGroupBy,
  roleDefaultLotPreset,
} from './lotRegisterQueue';
import type { Lot } from '../lotsPageTypes';

function lot(overrides: Partial<Lot> & { id: string }): Lot {
  return {
    lotNumber: `LOT-${overrides.id}`,
    description: null,
    status: 'in_progress',
    chainageStart: null,
    chainageEnd: null,
    offset: null,
    layer: null,
    areaZone: null,
    ...overrides,
  };
}

const NOW = Date.parse('2026-08-06T00:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

describe('lotDaysOpen', () => {
  it('counts created -> now while the lot is still open', () => {
    expect(lotDaysOpen(lot({ id: '1', createdAt: daysAgo(37) }), NOW)).toBe(37);
  });

  it('stops the clock at conformance rather than running forever', () => {
    const conformed = lot({
      id: '1',
      status: 'conformed',
      createdAt: daysAgo(100),
      conformedAt: daysAgo(40),
    });
    expect(lotDaysOpen(conformed, NOW)).toBe(60);
  });

  it('returns null when the payload carries no createdAt', () => {
    expect(lotDaysOpen(lot({ id: '1' }), NOW)).toBeNull();
    expect(lotDaysOpen(lot({ id: '2', createdAt: 'not-a-date' }), NOW)).toBeNull();
  });

  it('never reports a negative age from a clock-skewed createdAt', () => {
    expect(lotDaysOpen(lot({ id: '1', createdAt: daysAgo(-5) }), NOW)).toBe(0);
  });
});

describe('parseLotGroupBy', () => {
  it('accepts the four curated fields and rejects anything else', () => {
    expect(parseLotGroupBy('status')).toBe('status');
    expect(parseLotGroupBy('areaZone')).toBe('areaZone');
    expect(parseLotGroupBy('budgetAmount')).toBeNull();
    expect(parseLotGroupBy('')).toBeNull();
    expect(parseLotGroupBy(null)).toBeNull();
  });
});

describe('lot grouping', () => {
  it('labels each grouping in the register’s own vocabulary', () => {
    expect(lotGroupLabel(lot({ id: '1', status: 'ncr_raised' }), 'status')).toBe('NCR Raised');
    expect(
      lotGroupLabel(
        lot({ id: '2', assignedSubcontractor: { companyName: 'Ryox Civil' } }),
        'subcontractor',
      ),
    ).toBe('Ryox Civil');
    expect(lotGroupLabel(lot({ id: '3' }), 'subcontractor')).toBe('Unassigned');
    expect(lotGroupLabel(lot({ id: '4' }), 'areaZone')).toBe('No area');
  });

  it('namespaces group keys so identical labels under different groupings differ', () => {
    const target = lot({ id: '1', status: 'conformed', areaZone: 'conformed' });
    expect(lotGroupKey(target, 'status')).not.toBe(lotGroupKey(target, 'areaZone'));
  });

  it('orders status bands by workflow order and puts the empty bucket last', () => {
    const notStarted = lotGroupSortKey(lot({ id: '1', status: 'not_started' }), 'status');
    const conformed = lotGroupSortKey(lot({ id: '2', status: 'conformed' }), 'status');
    const none = lotGroupSortKey(lot({ id: '3', status: '' }), 'status');

    expect(notStarted < conformed).toBe(true);
    expect(conformed < none).toBe(true);
  });

  it('counts every lot in the filtered register, not just the loaded page', () => {
    const counts = countLotGroups(
      [
        lot({ id: '1', status: 'conformed' }),
        lot({ id: '2', status: 'conformed' }),
        lot({ id: '3', status: 'ncr_raised' }),
      ],
      'status',
    );
    expect(counts.get('status:conformed')).toBe(2);
    expect(counts.get('status:ncr_raised')).toBe(1);
  });
});

describe('buildLotRegisterRows', () => {
  const lots = [
    lot({ id: '1', status: 'ncr_raised' }),
    lot({ id: '2', status: 'ncr_raised' }),
    lot({ id: '3', status: 'conformed' }),
  ];
  const counts = countLotGroups(lots, 'status');

  it('returns a flat lot list when no grouping is active', () => {
    const rows = buildLotRegisterRows({
      displayedLots: lots,
      groupBy: null,
      groupCounts: new Map(),
      collapsedGroups: new Set(),
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.kind === 'lot')).toBe(true);
  });

  it('opens a band each time the group changes and carries the full count', () => {
    const rows = buildLotRegisterRows({
      displayedLots: lots,
      groupBy: 'status',
      groupCounts: counts,
      collapsedGroups: new Set(),
    });

    expect(rows.map((row) => (row.kind === 'band' ? `band:${row.label}` : row.lot.id))).toEqual([
      'band:NCR Raised',
      '1',
      '2',
      'band:Conformed',
      '3',
    ]);
    const firstBand = rows[0];
    expect(firstBand.kind === 'band' && firstBand.count).toBe(2);
  });

  it('keeps a collapsed band visible but drops its rows', () => {
    const rows = buildLotRegisterRows({
      displayedLots: lots,
      groupBy: 'status',
      groupCounts: counts,
      collapsedGroups: new Set(['status:ncr_raised']),
    });

    expect(rows.map((row) => (row.kind === 'band' ? `band:${row.label}` : row.lot.id))).toEqual([
      'band:NCR Raised',
      'band:Conformed',
      '3',
    ]);
    const collapsedBand = rows[0];
    expect(collapsedBand.kind === 'band' && collapsedBand.collapsed).toBe(true);
    // The count still reports the hidden rows, which is the point of collapsing.
    expect(collapsedBand.kind === 'band' && collapsedBand.count).toBe(2);
  });
});

describe('parseCollapsedGroupsPreference', () => {
  it('reads a stored key list and shrugs off anything malformed', () => {
    expect(parseCollapsedGroupsPreference('["status:conformed"]')).toEqual(
      new Set(['status:conformed']),
    );
    expect(parseCollapsedGroupsPreference('["status:conformed", 7]')).toEqual(
      new Set(['status:conformed']),
    );
    expect(parseCollapsedGroupsPreference('not json')).toEqual(new Set());
    expect(parseCollapsedGroupsPreference(null)).toEqual(new Set());
  });
});

describe('preset views', () => {
  it('ships presets whose queries the register can actually parse', () => {
    for (const preset of LOT_PRESET_VIEWS) {
      // A preset is applied by replacing the whole querystring, so an unparsable
      // one would silently drop every filter it claims to set.
      expect(() => new URLSearchParams(preset.query)).not.toThrow();
    }

    const needsAttention = LOT_PRESET_VIEWS.find((preset) => preset.id === 'needs-attention');
    const params = new URLSearchParams(needsAttention?.query);
    expect(params.get('status')).toBe('ncr_raised,hold_point');
    expect(params.get('group')).toBe('status');

    const all = LOT_PRESET_VIEWS.find((preset) => preset.id === 'all');
    expect(new URLSearchParams(all?.query).toString()).toBe('');
  });

  it('lands quality managers on Needs attention and leaves other roles alone', () => {
    expect(roleDefaultLotPreset('quality_manager')?.id).toBe('needs-attention');
    expect(roleDefaultLotPreset('project_manager')).toBeNull();
    expect(roleDefaultLotPreset('foreman')).toBeNull();
    expect(roleDefaultLotPreset(null)).toBeNull();
  });
});
