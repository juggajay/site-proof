import { describe, expect, it } from 'vitest';

import { traceRingPath, whiteToAlpha, type RingPathTarget } from './clipImageToPerimeter';

describe('traceRingPath', () => {
  it('moves to the first vertex, lines to the rest, and closes', () => {
    const calls: string[] = [];
    const ctx: RingPathTarget = {
      moveTo: (x, y) => calls.push(`move ${x},${y}`),
      lineTo: (x, y) => calls.push(`line ${x},${y}`),
      closePath: () => calls.push('close'),
    };

    traceRingPath(ctx, [
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ]);

    expect(calls).toEqual(['move 0,0', 'line 100,0', 'line 100,50', 'line 0,50', 'close']);
  });

  it('always closes even a degenerate single-point ring', () => {
    const calls: string[] = [];
    const ctx: RingPathTarget = {
      moveTo: () => calls.push('move'),
      lineTo: () => calls.push('line'),
      closePath: () => calls.push('close'),
    };
    traceRingPath(ctx, [[5, 5]]);
    expect(calls).toEqual(['move', 'close']);
  });
});

describe('whiteToAlpha', () => {
  it('keys pure white to fully transparent', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255]);
    whiteToAlpha(data);
    expect(data[3]).toBe(0);
  });

  it('leaves black opaque and black', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255]);
    whiteToAlpha(data);
    expect([...data]).toEqual([0, 0, 0, 255]);
  });

  it('keeps pure blue linework pure and opaque', () => {
    const data = new Uint8ClampedArray([0, 0, 255, 255]);
    whiteToAlpha(data);
    expect([...data]).toEqual([0, 0, 255, 255]);
  });

  it('makes light-grey scan noise nearly transparent', () => {
    const data = new Uint8ClampedArray([230, 230, 230, 255]);
    whiteToAlpha(data);
    expect(data[3]).toBeLessThan(40);
  });
});
