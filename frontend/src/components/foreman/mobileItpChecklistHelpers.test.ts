import { describe, expect, it } from 'vitest';
import {
  calculateItpProgressPercent,
  countCompletedItpItems,
  countsTowardItpProgress,
  findItpCompletion,
  getItpCategoryStats,
  getItpItemStatus,
  groupItpItemsByCategory,
} from './mobileItpChecklistHelpers';

const completion = (
  checklistItemId: string,
  flags: Partial<{ isCompleted: boolean; isNotApplicable: boolean; isFailed: boolean }> = {},
) => ({
  checklistItemId,
  isCompleted: false,
  ...flags,
});

describe('findItpCompletion', () => {
  it('finds the completion for a checklist item id', () => {
    const completions = [completion('item-1'), completion('item-2', { isCompleted: true })];

    expect(findItpCompletion(completions, 'item-2')).toBe(completions[1]);
    expect(findItpCompletion(completions, 'item-3')).toBeUndefined();
  });
});

describe('getItpItemStatus', () => {
  it('returns pending when there is no completion record', () => {
    expect(getItpItemStatus(undefined)).toBe('pending');
  });

  it('returns pending when no flag is set', () => {
    expect(getItpItemStatus({ isCompleted: false })).toBe('pending');
  });

  it('failed beats N/A and completed', () => {
    expect(getItpItemStatus({ isCompleted: true, isNotApplicable: true, isFailed: true })).toBe(
      'failed',
    );
  });

  it('N/A beats completed', () => {
    expect(getItpItemStatus({ isCompleted: true, isNotApplicable: true })).toBe('na');
  });

  it('returns completed when only isCompleted is set', () => {
    expect(getItpItemStatus({ isCompleted: true })).toBe('completed');
  });
});

describe('groupItpItemsByCategory', () => {
  it('groups by category with a General fallback for blank categories', () => {
    const items = [
      { id: 'a', category: 'Earthworks' },
      { id: 'b', category: '' },
      { id: 'c', category: 'Earthworks' },
      { id: 'd', category: 'Drainage' },
    ];

    const groups = groupItpItemsByCategory(items);

    expect(Object.keys(groups)).toEqual(['Earthworks', 'General', 'Drainage']);
    expect(groups['Earthworks'].map((item) => item.id)).toEqual(['a', 'c']);
    expect(groups['General'].map((item) => item.id)).toEqual(['b']);
  });
});

describe('getItpCategoryStats', () => {
  it('counts completed and N/A items against the category total', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const completions = [
      completion('a', { isCompleted: true }),
      completion('b', { isNotApplicable: true }),
      completion('c', { isFailed: true }),
      // 'd' has no completion record
    ];

    expect(getItpCategoryStats(items, completions)).toEqual({ completed: 2, total: 4 });
  });

  it('returns zero stats for an empty category', () => {
    expect(getItpCategoryStats([], [completion('a', { isCompleted: true })])).toEqual({
      completed: 0,
      total: 0,
    });
  });
});

describe('progress', () => {
  it('counts passed and N/A completions but not failed or pending ones', () => {
    expect(countsTowardItpProgress({ isCompleted: true })).toBe(true);
    expect(countsTowardItpProgress({ isCompleted: false, isNotApplicable: true })).toBe(true);
    expect(countsTowardItpProgress({ isCompleted: false })).toBe(false);

    const completions = [
      completion('a', { isCompleted: true }),
      completion('b', { isNotApplicable: true }),
      completion('c', { isFailed: true }),
      completion('d'),
    ];
    expect(countCompletedItpItems(completions)).toBe(2);
  });

  it('returns 0% for an empty checklist', () => {
    expect(calculateItpProgressPercent(0, 0)).toBe(0);
  });

  it('rounds the percentage with Math.round', () => {
    expect(calculateItpProgressPercent(1, 3)).toBe(33);
    expect(calculateItpProgressPercent(2, 3)).toBe(67);
    expect(calculateItpProgressPercent(3, 3)).toBe(100);
  });
});
