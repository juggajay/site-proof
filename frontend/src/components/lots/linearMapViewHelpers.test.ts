import { describe, expect, it } from 'vitest';

import { LOT_STATUS_OVERVIEW_ITEMS } from '@/lib/lotStatusOverview';

import {
  assignLanes,
  getActivityColor,
  getChainageTicks,
  getChainageX,
  getLinearMapScale,
  getStatusColor,
  LOT_STATUS_LEGEND,
  statusUsesDarkText,
  type LinearMapLot,
} from './linearMapViewHelpers';

const lot = (overrides: Partial<LinearMapLot>): LinearMapLot => ({
  id: 'lot-1',
  lotNumber: 'LOT-001',
  description: null,
  status: 'in_progress',
  activityType: null,
  chainageStart: null,
  chainageEnd: null,
  layer: null,
  areaZone: null,
  ...overrides,
});

describe('linear map view helpers', () => {
  it('gives every canonical lot status a distinct colour', () => {
    const colors = LOT_STATUS_OVERVIEW_ITEMS.map((item) => getStatusColor(item.key));
    expect(new Set(colors).size).toBe(LOT_STATUS_OVERVIEW_ITEMS.length);
    // No canonical status may fall through to the unknown-status default.
    colors.forEach((color) => expect(color).not.toBe('#9ca3af'));
    expect(getStatusColor('conformed')).toBe('#009E73');
    expect(getStatusColor('claimed')).toBe('#CC79A7');
    expect(getStatusColor('unknown')).toBe('#9ca3af');
  });

  it('marks light fills for dark label text', () => {
    expect(statusUsesDarkText('awaiting_test')).toBe(true);
    expect(statusUsesDarkText('ncr_raised')).toBe(false);
    expect(statusUsesDarkText('unknown')).toBe(false);
  });

  it('builds the legend from the canonical status list', () => {
    expect(LOT_STATUS_LEGEND.map((entry) => entry.key)).toEqual(
      LOT_STATUS_OVERVIEW_ITEMS.map((item) => item.key),
    );
    expect(LOT_STATUS_LEGEND.map((entry) => entry.label)).toEqual(
      LOT_STATUS_OVERVIEW_ITEMS.map((item) => item.label),
    );
  });

  it('maps activity types and blank values to the existing colors', () => {
    expect(getActivityColor('Earthworks')).toBe('#8b5cf6');
    expect(getActivityColor('Concrete')).toBe('#78716c');
    expect(getActivityColor(null)).toBe('#9ca3af');
  });

  it('returns the default scale and counts unmapped lots when none have chainage', () => {
    expect(getLinearMapScale([lot({ id: 'no-chainage' })])).toEqual({
      minChainage: 0,
      maxChainage: 1000,
      totalRange: 1000,
      layers: [],
      unmappedCount: 1,
    });
  });

  it('groups chainage lots by activity type before layer and sorts layer names', () => {
    const scale = getLinearMapScale([
      lot({ id: 'b', lotNumber: 'B', chainageStart: 200, chainageEnd: 300, layer: 'Layer B' }),
      lot({
        id: 'a',
        lotNumber: 'A',
        chainageStart: 0,
        chainageEnd: 100,
        activityType: 'Earthworks',
        layer: 'Layer A',
      }),
      lot({ id: 'c', lotNumber: 'C', chainageStart: 100, chainageEnd: 200 }),
      lot({ id: 'd', lotNumber: 'D' }),
    ]);

    expect(scale.minChainage).toBe(0);
    expect(scale.maxChainage).toBe(300);
    expect(scale.totalRange).toBe(300);
    expect(scale.layers.map(([name]) => name)).toEqual(['Earthworks', 'Layer B', 'Uncategorized']);
    expect(scale.unmappedCount).toBe(1);
  });

  it('stacks overlapping lots into separate lanes', () => {
    const { positioned, laneCount } = assignLanes([
      lot({ id: 'subgrade', chainageStart: 0, chainageEnd: 200 }),
      lot({ id: 'basecourse', chainageStart: 50, chainageEnd: 150 }),
      lot({ id: 'after', chainageStart: 200, chainageEnd: 300 }),
    ]);

    const laneOf = (id: string) => positioned.find((p) => p.lot.id === id)!.lane;
    expect(laneCount).toBe(2);
    expect(laneOf('subgrade')).toBe(0);
    expect(laneOf('basecourse')).toBe(1);
    // Touching end-to-start lots share a lane.
    expect(laneOf('after')).toBe(0);
  });

  it('keeps non-overlapping lots in a single lane', () => {
    const { laneCount } = assignLanes([
      lot({ id: 'a', chainageStart: 0, chainageEnd: 100 }),
      lot({ id: 'b', chainageStart: 100, chainageEnd: 200 }),
    ]);
    expect(laneCount).toBe(1);
  });

  it('keeps the 100m tick interval for typical road-length ranges', () => {
    expect(getChainageTicks(25, 925, 900)).toEqual([
      0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
    ]);
  });

  it('picks a fine interval for short chainage ranges', () => {
    expect(getChainageTicks(1, 30, 29)).toEqual([0, 5, 10, 15, 20, 25, 30, 35]);
  });

  it('converts chainage to x percentages with zoom and pan applied', () => {
    expect(getChainageX(500, 0, 1000, 2, 20)).toBe(80);
  });
});
