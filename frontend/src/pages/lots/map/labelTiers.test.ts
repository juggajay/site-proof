import { describe, expect, it } from 'vitest';

import { labelTier, placeLabels, MAX_LABELS, type LabelCandidate } from './labelTiers';

function candidate(over: Partial<LabelCandidate> = {}): LabelCandidate {
  return {
    lotId: 'lot-1',
    lotNumber: 'LOT-001',
    status: 'conformed',
    chainage: 'Ch 0–100',
    x: 100,
    y: 100,
    ...over,
  };
}

describe('labelTier', () => {
  it('tiers by zoom: dots at overview, numbers at working, number+chainage at detail', () => {
    expect(labelTier(10)).toBe('dot');
    expect(labelTier(14.9)).toBe('dot');
    expect(labelTier(15)).toBe('number');
    expect(labelTier(16.9)).toBe('number');
    expect(labelTier(17)).toBe('detail');
    expect(labelTier(20)).toBe('detail');
  });
});

describe('placeLabels', () => {
  it('keeps non-colliding labels and prunes an overlapping lower-priority one', () => {
    const placed = placeLabels(
      [
        candidate(),
        candidate({ lotId: 'lot-2', lotNumber: 'LOT-002', x: 104, y: 100 }), // overlaps lot-1
        candidate({ lotId: 'lot-3', lotNumber: 'LOT-003', x: 400, y: 400 }),
      ],
      16,
      null,
    );
    expect(placed.map((p) => p.lotId)).toEqual(['lot-1', 'lot-3']);
    expect(placed[0].tier).toBe('number');
    expect(placed[0].detail).toBeNull();
  });

  it('the selected lot wins a collision against an earlier-numbered neighbour', () => {
    const placed = placeLabels(
      [candidate(), candidate({ lotId: 'lot-2', lotNumber: 'LOT-002', x: 104, y: 100 })],
      16,
      'lot-2',
    );
    expect(placed.map((p) => p.lotId)).toEqual(['lot-2']);
  });

  it('active work fronts outrank settled lots in a collision', () => {
    const placed = placeLabels(
      [
        candidate({ lotId: 'settled', lotNumber: 'LOT-001', status: 'conformed' }),
        candidate({ lotId: 'front', lotNumber: 'LOT-999', status: 'hold_point', x: 104, y: 100 }),
      ],
      16,
      null,
    );
    expect(placed.map((p) => p.lotId)).toEqual(['front']);
  });

  it('detail tier carries the chainage as a second line', () => {
    const placed = placeLabels([candidate()], 18, null);
    expect(placed[0].tier).toBe('detail');
    expect(placed[0].detail).toBe('Ch 0–100');
  });

  it('dot tier collides on the dot footprint, so near neighbours both place', () => {
    const placed = placeLabels(
      [candidate(), candidate({ lotId: 'lot-2', lotNumber: 'LOT-002', x: 100, y: 125 })],
      12,
      null,
    );
    expect(placed).toHaveLength(2);
    expect(placed.every((p) => p.tier === 'dot')).toBe(true);
  });

  it('caps placements at MAX_LABELS even with room to spare', () => {
    const many = Array.from({ length: MAX_LABELS + 50 }, (_, i) =>
      candidate({
        lotId: `lot-${i}`,
        lotNumber: `LOT-${String(i).padStart(4, '0')}`,
        x: (i % 30) * 200,
        y: Math.floor(i / 30) * 200,
      }),
    );
    expect(placeLabels(many, 16, null)).toHaveLength(MAX_LABELS);
  });
});
