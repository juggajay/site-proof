/**
 * Tests for useItpContentDrag — the v3 whole-screen scrub gesture wiring.
 *
 * The pure math (contentFracFromDrag / projectFling / resolveDragAxis) is covered
 * exhaustively in itpTrackPhysics.test.ts. Here we verify the HOOK glue:
 *   - a horizontal drag past the threshold engages, emits live fractions, then
 *     commits a fling-projected index on release;
 *   - a vertical drag yields (never scrubs, never commits) so native scrolling
 *     passes through;
 *   - taps under the engage threshold do nothing;
 *   - reduced motion disables the fling (direct positioning).
 *
 * framer-motion's useReducedMotion is mocked per-suite so we can assert both the
 * fling and the reduced-motion paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let reducedMotion = false;
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return { ...actual, useReducedMotion: () => reducedMotion };
});

import { useItpContentDrag } from '../useItpContentDrag';

const ZONE_WIDTH = 360;

// A synthetic React.PointerEvent good enough for the hook's reads.
function evt(clientX: number, clientY: number, pointerId = 1) {
  return {
    clientX,
    clientY,
    pointerId,
    currentTarget: {
      getBoundingClientRect: () => ({ width: ZONE_WIDTH }) as DOMRect,
      setPointerCapture: vi.fn(),
    },
  } as unknown as React.PointerEvent<HTMLDivElement>;
}

function setup(overrides: Partial<Parameters<typeof useItpContentDrag>[0]> = {}) {
  const onCommit = vi.fn();
  const onScrubChange = vi.fn();
  const { result } = renderHook(() =>
    useItpContentDrag({
      count: 22,
      currentIndex: 10,
      onCommit,
      onScrubChange,
      ...overrides,
    }),
  );
  return { result, onCommit, onScrubChange };
}

describe('useItpContentDrag', () => {
  beforeEach(() => {
    reducedMotion = false;
    vi.clearAllMocks();
  });

  it('a horizontal drag past threshold engages and emits live fractions', () => {
    const { result, onScrubChange } = setup();
    act(() => result.current.handlers.onPointerDown(evt(300, 200)));
    // Move sideways past the 10px engage threshold (content dragged LEFT → forward).
    act(() => result.current.handlers.onPointerMove(evt(260, 202)));
    expect(result.current.engaged).toBe(true);
    expect(onScrubChange).toHaveBeenCalled();
    const lastFrac = onScrubChange.mock.calls.at(-1)?.[0] as number;
    expect(lastFrac).toBeGreaterThan(10); // advanced forward
  });

  it('commits a fling-projected index on release (carries velocity)', () => {
    const { result, onCommit, onScrubChange } = setup();
    act(() => result.current.handlers.onPointerDown(evt(300, 200)));
    act(() => result.current.handlers.onPointerMove(evt(200, 201))); // engage, moving left fast
    act(() => result.current.handlers.onPointerUp(evt(150, 201)));
    // Scrub ended (null emitted) and a single index committed.
    expect(onScrubChange).toHaveBeenLastCalledWith(null);
    expect(onCommit).toHaveBeenCalledTimes(1);
    const landed = onCommit.mock.calls[0][0] as number;
    expect(landed).toBeGreaterThan(10); // forward of the start
    expect(landed).toBeLessThanOrEqual(21);
  });

  it('a vertical drag yields — never scrubs, never commits', () => {
    const { result, onCommit, onScrubChange } = setup();
    act(() => result.current.handlers.onPointerDown(evt(300, 200)));
    act(() => result.current.handlers.onPointerMove(evt(302, 260))); // dominant vertical
    expect(result.current.engaged).toBe(false);
    act(() => result.current.handlers.onPointerUp(evt(303, 320)));
    expect(onScrubChange).not.toHaveBeenCalledWith(expect.any(Number));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('a sub-threshold tap does nothing (passes through to buttons)', () => {
    const { result, onCommit, onScrubChange } = setup();
    act(() => result.current.handlers.onPointerDown(evt(300, 200)));
    act(() => result.current.handlers.onPointerMove(evt(304, 203))); // < 10px both axes
    act(() => result.current.handlers.onPointerUp(evt(304, 203)));
    expect(result.current.engaged).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onScrubChange).not.toHaveBeenCalledWith(expect.any(Number));
  });

  it('does not engage when there is a single item', () => {
    const { result, onCommit } = setup({ count: 1 });
    act(() => result.current.handlers.onPointerDown(evt(300, 200)));
    act(() => result.current.handlers.onPointerMove(evt(100, 200)));
    expect(result.current.engaged).toBe(false);
    act(() => result.current.handlers.onPointerUp(evt(100, 200)));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('a slow quarter-drag with a PAUSED finger commits forward (no snap-back)', () => {
    // The owner-reported failure mode: hold, drag ~a third of the screen,
    // pause, lift. The stale-velocity guard zeroes the fling and the
    // directional commit still advances one item. The clock is value-based so
    // unrelated performance.now() consumers (React scheduler, framer) are
    // harmless — they just read the current scripted time.
    let now = 0;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    try {
      const { result, onCommit } = setup();
      act(() => result.current.handlers.onPointerDown(evt(300, 200)));
      now = 60;
      act(() => result.current.handlers.onPointerMove(evt(250, 201)));
      now = 120;
      act(() => result.current.handlers.onPointerMove(evt(190, 201))); // 110px ≈ 0.31 item
      now = 400; // long pause before lift — stale guard must zero the fling
      act(() => result.current.handlers.onPointerUp(evt(190, 201)));
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0][0]).toBe(11); // forward one — never back to 10
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('reduced motion still commits (direct positioning, no fling)', () => {
    reducedMotion = true;
    const { result, onCommit } = setup();
    act(() => result.current.handlers.onPointerDown(evt(300, 200)));
    act(() => result.current.handlers.onPointerMove(evt(120, 201))); // ~half a zone left → +0.5 item
    act(() => result.current.handlers.onPointerUp(evt(120, 201)));
    expect(onCommit).toHaveBeenCalledTimes(1);
    // Without fling, a half-item drag from 10 snaps to 10 or 11 — never several away.
    const landed = onCommit.mock.calls[0][0] as number;
    expect(Math.abs(landed - 10)).toBeLessThanOrEqual(1);
  });
});
