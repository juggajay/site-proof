import { describe, expect, it } from 'vitest';

import {
  getActivityColor,
  getChainageTicks,
  getChainageX,
  getLinearMapScale,
  getStatusColor,
  type LinearMapLot,
} from './linearMapViewHelpers';

const lot = (overrides: Partial<LinearMapLot>): LinearMapLot => ({
  id: 'lot-1',
  lotNumber: 'LOT-001',
  description: null,
  status: 'active',
  activityType: null,
  chainageStart: null,
  chainageEnd: null,
  layer: null,
  areaZone: null,
  ...overrides,
});

describe('linear map view helpers', () => {
  it('maps known statuses and unknown statuses to the existing colors', () => {
    expect(getStatusColor('active')).toBe('#3b82f6');
    expect(getStatusColor('in_progress')).toBe('#f59e0b');
    expect(getStatusColor('unknown')).toBe('#9ca3af');
  });

  it('maps activity types and blank values to the existing colors', () => {
    expect(getActivityColor('Earthworks')).toBe('#8b5cf6');
    expect(getActivityColor('Concrete')).toBe('#78716c');
    expect(getActivityColor(null)).toBe('#9ca3af');
  });

  it('returns the default scale when no lots have chainage', () => {
    expect(getLinearMapScale([lot({ id: 'no-chainage' })])).toEqual({
      minChainage: 0,
      maxChainage: 1000,
      totalRange: 1000,
      layers: [],
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
    ]);

    expect(scale.minChainage).toBe(0);
    expect(scale.maxChainage).toBe(300);
    expect(scale.totalRange).toBe(300);
    expect(scale.layers.map(([name]) => name)).toEqual(['Earthworks', 'Layer B', 'Uncategorized']);
  });

  it('rounds chainage ticks to the existing 100m interval behavior', () => {
    expect(getChainageTicks(25, 925, 900)).toEqual([
      0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
    ]);
  });

  it('converts chainage to x percentages with zoom and pan applied', () => {
    expect(getChainageX(500, 0, 1000, 2, 20)).toBe(80);
  });
});
