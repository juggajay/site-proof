import { describe, expect, it } from 'vitest';
import {
  buildItpChecklistCompleteness,
  isItpCompletionFinished,
} from './conformancePrerequisites.js';

/**
 * Characterizes the pure (DB-free) ITP checklist completeness used by the lot
 * conformance gate. The key behaviour: an item is "finished" when its completion
 * status is 'completed' OR 'not_applicable' (mirroring the isFinished semantics
 * in routes/itp/helpers/lotProgression.ts). N/A is a first-class status (the app
 * requires a reason and renders it as done), so an N/A item must NOT permanently
 * block conformance. A 'failed' status and a missing completion still block.
 */

const items = [
  { id: 'i1', description: 'First', pointType: 'standard' },
  { id: 'i2', description: 'Second', pointType: 'witness_point' },
  { id: 'i3', description: 'Third', pointType: 'hold_point' },
];

describe('isItpCompletionFinished', () => {
  it('counts completed and not_applicable as finished', () => {
    expect(isItpCompletionFinished('completed')).toBe(true);
    expect(isItpCompletionFinished('not_applicable')).toBe(true);
  });

  it('does not count failed, pending, in_progress, missing as finished', () => {
    expect(isItpCompletionFinished('failed')).toBe(false);
    expect(isItpCompletionFinished('pending')).toBe(false);
    expect(isItpCompletionFinished('in_progress')).toBe(false);
    expect(isItpCompletionFinished(null)).toBe(false);
    expect(isItpCompletionFinished(undefined)).toBe(false);
  });
});

describe('buildItpChecklistCompleteness', () => {
  it('reports complete when every item is completed', () => {
    const result = buildItpChecklistCompleteness(items, [
      { checklistItemId: 'i1', status: 'completed' },
      { checklistItemId: 'i2', status: 'completed' },
      { checklistItemId: 'i3', status: 'completed' },
    ]);

    expect(result).toEqual({
      completedCount: 3,
      totalCount: 3,
      completed: true,
      incompleteItems: [],
    });
  });

  it('reports complete when one item is N/A and the rest are completed', () => {
    const result = buildItpChecklistCompleteness(items, [
      { checklistItemId: 'i1', status: 'completed' },
      { checklistItemId: 'i2', status: 'not_applicable' },
      { checklistItemId: 'i3', status: 'completed' },
    ]);

    expect(result.completed).toBe(true);
    expect(result.completedCount).toBe(3);
    expect(result.incompleteItems).toEqual([]);
  });

  it('blocks (incomplete) when one item is failed', () => {
    const result = buildItpChecklistCompleteness(items, [
      { checklistItemId: 'i1', status: 'completed' },
      { checklistItemId: 'i2', status: 'failed' },
      { checklistItemId: 'i3', status: 'completed' },
    ]);

    expect(result.completed).toBe(false);
    expect(result.completedCount).toBe(2);
    expect(result.incompleteItems).toEqual([
      { id: 'i2', description: 'Second', pointType: 'witness_point' },
    ]);
  });

  it('blocks (incomplete) when one item has no completion record', () => {
    const result = buildItpChecklistCompleteness(items, [
      { checklistItemId: 'i1', status: 'completed' },
      { checklistItemId: 'i2', status: 'not_applicable' },
      // i3 has no completion at all
    ]);

    expect(result.completed).toBe(false);
    expect(result.completedCount).toBe(2);
    expect(result.incompleteItems).toEqual([
      { id: 'i3', description: 'Third', pointType: 'hold_point' },
    ]);
  });

  it('is not complete for an empty checklist (matches existing semantics)', () => {
    const result = buildItpChecklistCompleteness([], []);

    expect(result).toEqual({
      completedCount: 0,
      totalCount: 0,
      completed: false,
      incompleteItems: [],
    });
  });
});
