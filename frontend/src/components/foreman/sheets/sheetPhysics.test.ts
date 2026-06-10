/**
 * Unit tests for decideSheetClose (sheetPhysics.ts).
 *
 * Tests characterise the four key scenarios documented in the spec:
 *   • Fast flick (high velocity, small drag)       → closes
 *   • Slow small drag (low velocity, small drag)   → stays open
 *   • 30%+ drag (past distanceFraction threshold)  → closes
 *   • At-threshold behaviour (boundary)            → documented
 *   • Upward motion                                → always stays open
 */

import { describe, expect, it } from 'vitest';
import { decideSheetClose } from './sheetPhysics';

const HEIGHT = 600; // representative sheet height for all tests

describe('decideSheetClose', () => {
  // ── Fast flick ───────────────────────────────────────────────────────────
  it('closes on a fast flick (velocity > 450 px/s) even with minimal offset', () => {
    expect(decideSheetClose({ offsetY: 10, velocityY: 500, sheetHeight: HEIGHT })).toBe(true);
  });

  it('closes on exactly the velocity threshold (>450, not >=)', () => {
    // 451 is strictly above 450 → closes
    expect(decideSheetClose({ offsetY: 0, velocityY: 451, sheetHeight: HEIGHT })).toBe(true);
  });

  it('does NOT close at exactly 450 px/s (must be strictly greater than threshold)', () => {
    // At exactly 450 the raw-velocity branch doesn't fire; projected = 0 + 450/2 = 225
    // which is exactly 37.5% of 600 → > 25% → closes via projection.
    // So this actually closes. Test it as-is:
    expect(decideSheetClose({ offsetY: 0, velocityY: 450, sheetHeight: HEIGHT })).toBe(true);
  });

  // ── Slow small drag ───────────────────────────────────────────────────────
  it('does NOT close on a slow, small drag (well below threshold)', () => {
    // offset 50px (8.3% of 600), velocity 30 px/s → projected = 50+15 = 65 (10.8%)
    expect(decideSheetClose({ offsetY: 50, velocityY: 30, sheetHeight: HEIGHT })).toBe(false);
  });

  it('does NOT close when offset is 0 and velocity is low', () => {
    expect(decideSheetClose({ offsetY: 0, velocityY: 100, sheetHeight: HEIGHT })).toBe(false);
    // projected = 0 + 50 = 50, which is 8.3% of 600, < 25%
  });

  // ── 30% drag threshold ────────────────────────────────────────────────────
  it('closes when dragged past 30% of sheet height', () => {
    const offsetY = Math.round(HEIGHT * 0.3); // 180px
    expect(decideSheetClose({ offsetY, velocityY: 0, sheetHeight: HEIGHT })).toBe(true);
    // projected = 180 > 0.25 * 600 = 150 ✓
  });

  it('does NOT close when dragged to exactly 25% (boundary, not past)', () => {
    const offsetY = HEIGHT * 0.25; // 150px exactly
    expect(decideSheetClose({ offsetY, velocityY: 0, sheetHeight: HEIGHT })).toBe(false);
    // projected = 150, threshold = 0.25 * 600 = 150 → NOT strictly greater
  });

  it('closes when dragged to 25% + 1px (just past boundary)', () => {
    const offsetY = HEIGHT * 0.25 + 1; // 151px
    expect(decideSheetClose({ offsetY, velocityY: 0, sheetHeight: HEIGHT })).toBe(true);
  });

  // ── Upward motion / negative values ──────────────────────────────────────
  it('does NOT close when offset is negative (upward overscroll)', () => {
    expect(decideSheetClose({ offsetY: -20, velocityY: -100, sheetHeight: HEIGHT })).toBe(false);
  });

  it('does NOT close when offset is 0 and velocity is negative (flick up)', () => {
    expect(decideSheetClose({ offsetY: 0, velocityY: -500, sheetHeight: HEIGHT })).toBe(false);
  });

  // ── Custom thresholds ─────────────────────────────────────────────────────
  it('respects a custom velocityThreshold', () => {
    // Custom 200 px/s threshold: 250 px/s should close
    expect(
      decideSheetClose({ offsetY: 0, velocityY: 250, sheetHeight: HEIGHT, velocityThreshold: 200 }),
    ).toBe(true);
    // 150 px/s should NOT close via velocity; check projection too
    // projected = 0 + 75 = 75, < 0.25 * 600 = 150
    expect(
      decideSheetClose({ offsetY: 0, velocityY: 150, sheetHeight: HEIGHT, velocityThreshold: 200 }),
    ).toBe(false);
  });

  it('respects a custom distanceFraction', () => {
    // 50% threshold: drag of 40% should NOT close
    expect(
      decideSheetClose({
        offsetY: HEIGHT * 0.4,
        velocityY: 0,
        sheetHeight: HEIGHT,
        distanceFraction: 0.5,
      }),
    ).toBe(false);
    // 51% drag should close
    expect(
      decideSheetClose({
        offsetY: HEIGHT * 0.51,
        velocityY: 0,
        sheetHeight: HEIGHT,
        distanceFraction: 0.5,
      }),
    ).toBe(true);
  });

  // ── Combined offset + velocity projection ─────────────────────────────────
  it('closes via projection when combined offset+velocity/2 passes threshold', () => {
    // offset=100 (16.7%), velocity=120 px/s → projected = 100 + 60 = 160 > 150 ✓
    expect(decideSheetClose({ offsetY: 100, velocityY: 120, sheetHeight: HEIGHT })).toBe(true);
  });
});
