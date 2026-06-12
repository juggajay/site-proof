/**
 * Tests for ItpDotTrack — the dot-track scrubber component.
 *
 * jsdom cannot reproduce real pointer-scrub feel (getBoundingClientRect is 0×0,
 * no layout), so these tests cover what IS verifiable in jsdom: rendering one dot
 * per item, role="slider" semantics + aria-valuetext, keyboard prev/next/Home/End
 * navigation committing the right index, tap-to-commit, and the reduced-motion
 * path mounting cleanly. The scrub FEEL is covered by itpTrackPhysics.test.ts
 * (pure) and the manual QA checklist in the PR.
 *
 * useReducedMotion is forced true so framer-motion does no async animation in the
 * jsdom run.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return { ...actual, useReducedMotion: () => true };
});

import { ItpDotTrack, type ItpDotTrackItem } from '../ItpDotTrack';
import { dotStateFor } from '../itpTrackPhysics';
import type { ITPChecklistItem, ITPCompletion } from '@/pages/lots/types';

function makeItem(i: number, over: Partial<ITPChecklistItem> = {}): ITPChecklistItem {
  return {
    id: `item-${i}`,
    description: `Check ${i + 1}`,
    category: 'Earthworks',
    responsibleParty: 'contractor',
    isHoldPoint: false,
    pointType: 'standard',
    evidenceRequired: 'none',
    order: i,
    ...over,
  };
}

function makeEntries(
  n: number,
  completions: Record<string, ITPCompletion> = {},
): ItpDotTrackItem[] {
  return Array.from({ length: n }, (_, i) => {
    const item = makeItem(i);
    const completion = completions[item.id];
    return { item, completion, state: dotStateFor(item, completion) };
  });
}

describe('ItpDotTrack', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders one dot per item and a slider with aria-valuetext', () => {
    const onCommit = vi.fn();
    render(<ItpDotTrack entries={makeEntries(12)} currentIndex={3} onCommit={onCommit} />);
    const slider = screen.getByRole('slider', { name: /Inspection checks/i });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '12');
    expect(slider).toHaveAttribute('aria-valuenow', '4');
    expect(slider.getAttribute('aria-valuetext')).toMatch(/Check 4 of 12, Check 4 — open/);
  });

  it('renders nothing when there are no items', () => {
    const { container } = render(<ItpDotTrack entries={[]} currentIndex={-1} onCommit={vi.fn()} />);
    expect(container.querySelector('[data-testid="itp-dot-track"]')).toBeNull();
  });

  it('ArrowRight commits the next item; ArrowLeft the previous', () => {
    const onCommit = vi.fn();
    const entries = makeEntries(22);
    const { rerender } = render(
      <ItpDotTrack entries={entries} currentIndex={14} onCommit={onCommit} />,
    );
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onCommit).toHaveBeenLastCalledWith(15);
    // Parent commits the index → prop updates and resyncs focus (as in the screen).
    rerender(<ItpDotTrack entries={entries} currentIndex={15} onCommit={onCommit} />);
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onCommit).toHaveBeenLastCalledWith(14);
  });

  it('Home/End jump to the first/last item', () => {
    const onCommit = vi.fn();
    render(<ItpDotTrack entries={makeEntries(22)} currentIndex={10} onCommit={onCommit} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onCommit).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onCommit).toHaveBeenLastCalledWith(21);
  });

  it('does not move past the ends', () => {
    const onCommit = vi.fn();
    render(<ItpDotTrack entries={makeEntries(5)} currentIndex={4} onCommit={onCommit} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onCommit).toHaveBeenLastCalledWith(4); // clamped at last
  });

  it('a tap (pointer down + up) commits a snapped index', () => {
    const onCommit = vi.fn();
    const onScrub = vi.fn();
    render(
      <ItpDotTrack
        entries={makeEntries(12)}
        currentIndex={0}
        onCommit={onCommit}
        onScrubChange={onScrub}
      />,
    );
    const slider = screen.getByRole('slider');
    // jsdom rect is 0×0 so this resolves to index 0, but it must still commit and
    // signal scrub start/end through onScrubChange.
    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(expect.any(Number));
    fireEvent.pointerUp(slider, { clientX: 100, pointerId: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(null); // scrub ended
    expect(onCommit).toHaveBeenCalled();
  });

  it('reflects a hold-point item state in its aria text when focused', () => {
    const entries = makeEntries(3);
    entries[1] = {
      ...entries[1],
      item: { ...entries[1].item, pointType: 'hold_point', isHoldPoint: true },
      state: 'hold',
    };
    render(<ItpDotTrack entries={entries} currentIndex={1} onCommit={vi.fn()} />);
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toMatch(/hold/);
  });
});
