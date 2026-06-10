// Pure checklist status/progress/category helpers moved out of
// MobileITPChecklist. The logic is moved verbatim from the component; inputs
// are structural/generic so the component's private ITPChecklistItem and
// ITPCompletion interfaces keep flowing through unchanged.

export type ItpItemStatus = 'pending' | 'completed' | 'na' | 'failed';

export interface ItpCompletionStatusFlags {
  isCompleted: boolean;
  isNotApplicable?: boolean;
  isFailed?: boolean;
}

export function findItpCompletion<T extends { checklistItemId: string }>(
  completions: T[],
  itemId: string,
): T | undefined {
  return completions.find((c) => c.checklistItemId === itemId);
}

/** Failed beats N/A, which beats completed; anything else is pending. */
export function getItpItemStatus(completion: ItpCompletionStatusFlags | undefined): ItpItemStatus {
  if (!completion) return 'pending';
  if (completion.isFailed) return 'failed';
  if (completion.isNotApplicable) return 'na';
  if (completion.isCompleted) return 'completed';
  return 'pending';
}

/** Groups checklist items by category, falling back to 'General' when blank. */
export function groupItpItemsByCategory<T extends { category: string }>(
  items: T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  items.forEach((item) => {
    const category = item.category || 'General';
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
  });
  return groups;
}

/**
 * A completion counts toward progress when passed or marked N/A. Failed items
 * do not count because their completion records carry isCompleted: false —
 * deliberately the same predicate the component has always used.
 */
export function countsTowardItpProgress(completion: {
  isCompleted: boolean;
  isNotApplicable?: boolean;
}): boolean {
  return Boolean(completion.isCompleted || completion.isNotApplicable);
}

export function getItpCategoryStats(
  items: { id: string }[],
  completions: ({ checklistItemId: string } & ItpCompletionStatusFlags)[],
): { completed: number; total: number } {
  const completed = items.filter((item) => {
    const completion = findItpCompletion(completions, item.id);
    return completion ? countsTowardItpProgress(completion) : false;
  }).length;
  return { completed, total: items.length };
}

export function countCompletedItpItems(completions: ItpCompletionStatusFlags[]): number {
  return completions.filter(countsTowardItpProgress).length;
}

/** Whole-number percentage via Math.round; 0 total gives 0%. */
export function calculateItpProgressPercent(completedCount: number, totalCount: number): number {
  return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
}

/**
 * First category (in display/grouping order) that still has an item needing
 * action — pending or failed (failed items need rework, so their category
 * counts as incomplete). Used to default-expand that category on mount.
 * Returns null when every item is passed or N/A.
 */
export function findFirstIncompleteItpCategory<T extends { id: string; category: string }>(
  items: T[],
  completions: ({ checklistItemId: string } & ItpCompletionStatusFlags)[],
): string | null {
  const grouped = groupItpItemsByCategory(items);
  for (const [category, categoryItems] of Object.entries(grouped)) {
    const hasIncomplete = categoryItems.some((item) => {
      const completion = findItpCompletion(completions, item.id);
      return !completion || !countsTowardItpProgress(completion);
    });
    if (hasIncomplete) return category;
  }
  return null;
}

/**
 * Items that require photo evidence and have no photo attached yet — the same
 * predicate as the per-row "Photo req" badge, surfaced on collapsed category
 * headers so missing evidence is visible without expanding.
 */
export function countItpPhotoRequiredItems(
  items: { id: string; evidenceRequired: string }[],
  completions: { checklistItemId: string; attachments?: unknown[] }[],
): number {
  return items.filter((item) => {
    if (item.evidenceRequired !== 'photo') return false;
    const completion = findItpCompletion(completions, item.id);
    return (completion?.attachments?.length || 0) === 0;
  }).length;
}
