import type { ITPAttachment, ITPChecklistItem, ITPCompletion, ITPTemplate } from '../types';

export type ItpStatusFilter = 'all' | 'pending' | 'completed' | 'na' | 'failed';

export interface ItpChecklistProgress {
  totalItems: number;
  completedItems: number;
  naItems: number;
  finishedItems: number;
  percentage: number;
}

export interface ItpCategoryProgress {
  completedInCategory: number;
  totalInCategory: number;
  isCategoryComplete: boolean;
}

export function getItpChecklistProgress(
  checklistItems: ITPChecklistItem[],
  completions: ITPCompletion[],
): ItpChecklistProgress {
  const totalItems = checklistItems.length;
  const completedItems = completions.filter((completion) => completion.isCompleted).length;
  const naItems = completions.filter((completion) => completion.isNotApplicable).length;
  const finishedItems = completedItems + naItems;
  const percentage = totalItems > 0 ? Math.round((finishedItems / totalItems) * 100) : 0;

  return { totalItems, completedItems, naItems, finishedItems, percentage };
}

export function groupItpChecklistItemsByCategory(
  checklistItems: ITPChecklistItem[],
): Record<string, ITPChecklistItem[]> {
  const categorizedItems: Record<string, ITPChecklistItem[]> = {};

  checklistItems.forEach((item) => {
    const category = item.category || 'General';
    if (!categorizedItems[category]) categorizedItems[category] = [];
    categorizedItems[category].push(item);
  });

  return categorizedItems;
}

export function filterItpChecklistItems(
  checklistItems: ITPChecklistItem[],
  completions: ITPCompletion[],
  statusFilter: ItpStatusFilter,
  showIncompleteOnly: boolean,
): ITPChecklistItem[] {
  return checklistItems.filter((item) => {
    const completion = completions.find((entry) => entry.checklistItemId === item.id);
    const isCompleted = completion?.isCompleted || false;
    const isNotApplicable = completion?.isNotApplicable || false;
    const isFailed = completion?.isFailed || false;
    const isPending = !isCompleted && !isNotApplicable && !isFailed;

    if (statusFilter === 'pending' && !isPending) return false;
    if (statusFilter === 'completed' && !isCompleted) return false;
    if (statusFilter === 'na' && !isNotApplicable) return false;
    if (statusFilter === 'failed' && !isFailed) return false;
    if (showIncompleteOnly && !isPending) return false;

    return true;
  });
}

export type ItpVerificationTone = 'verified' | 'pending' | 'rejected';

export interface ItpVerificationDisplay {
  tone: ItpVerificationTone;
  label: string;
  /** Only populated for the rejected state — the head-contractor's reason. */
  rejectionReason: string | null;
}

/**
 * M15: derive the head-contractor verification field-state shown on an ITP item
 * row. A rejected item (with its reason) takes precedence so a field worker
 * always sees why work was sent back; otherwise pending/verified are surfaced,
 * and items not in a verification workflow ("none") show no badge.
 */
export function getItpVerificationDisplay(
  completion: ITPCompletion | undefined,
): ItpVerificationDisplay | null {
  if (!completion) return null;

  if (completion.isRejected) {
    return {
      tone: 'rejected',
      label: 'Rejected',
      rejectionReason: completion.verificationNotes ?? null,
    };
  }
  if (completion.isPendingVerification) {
    return { tone: 'pending', label: 'Pending verification', rejectionReason: null };
  }
  if (completion.isVerified) {
    return { tone: 'verified', label: 'Verified', rejectionReason: null };
  }
  return null;
}

// H4: roles permitted to verify/reject an ITP completion. Mirrors the backend
// ITP_VERIFY_ROLES in backend/src/routes/itp/helpers/access.ts; the backend
// independently enforces this, so this gate is purely for affordance/UX.
export const ITP_VERIFY_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'superintendent',
] as const;

export function canReviewItpByRole(role: string | null | undefined): boolean {
  return !!role && (ITP_VERIFY_ROLES as readonly string[]).includes(role);
}

/**
 * H4: decide whether the current user may verify/reject a specific ITP item.
 * Requires a verification role, the item to be awaiting verification, and — per
 * the backend's assertDifferentVerifier — that the reviewer is not the person
 * who completed the item.
 */
export function canReviewItpItem(input: {
  canReviewByRole: boolean;
  currentUserId: string | null | undefined;
  completion: ITPCompletion | undefined;
}): boolean {
  if (!input.canReviewByRole) return false;
  if (!input.completion?.isPendingVerification) return false;
  if (input.currentUserId && input.completion.completedBy?.id === input.currentUserId) {
    return false;
  }
  return true;
}

export function getItpCategoryProgress(
  checklistItems: ITPChecklistItem[],
  completions: ITPCompletion[],
): ItpCategoryProgress {
  const completedInCategory = checklistItems.filter((item) => {
    const completion = completions.find((entry) => entry.checklistItemId === item.id);
    return completion?.isCompleted || completion?.isNotApplicable;
  }).length;
  const totalInCategory = checklistItems.length;
  const isCategoryComplete = completedInCategory === totalInCategory;

  return { completedInCategory, totalInCategory, isCategoryComplete };
}

export function getItpAttachments(completions: ITPCompletion[]): ITPAttachment[] {
  const allPhotos: ITPAttachment[] = [];

  completions.forEach((completion) => {
    if (completion.attachments && completion.attachments.length > 0) {
      completion.attachments.forEach((attachment) => {
        allPhotos.push(attachment);
      });
    }
  });

  return allPhotos;
}

export function getAdjacentItpAttachment(
  attachments: ITPAttachment[],
  selectedPhotoId: string,
  direction: 'previous' | 'next',
): ITPAttachment | null {
  const currentIndex = attachments.findIndex((attachment) => attachment.id === selectedPhotoId);

  if (direction === 'previous' && currentIndex > 0) {
    return attachments[currentIndex - 1];
  }

  if (direction === 'next' && currentIndex >= 0 && currentIndex < attachments.length - 1) {
    return attachments[currentIndex + 1];
  }

  return null;
}

export function isItpTemplateActivityMatch(
  template: ITPTemplate,
  lotActivityType: string | null,
): boolean {
  return Boolean(
    lotActivityType && template.activityType?.toLowerCase() === lotActivityType.toLowerCase(),
  );
}

export function sortItpTemplatesForLotActivity(
  templates: ITPTemplate[],
  lotActivityType: string | null,
): ITPTemplate[] {
  return [...templates].sort((a, b) => {
    const aMatches = isItpTemplateActivityMatch(a, lotActivityType);
    const bMatches = isItpTemplateActivityMatch(b, lotActivityType);
    if (aMatches && !bMatches) return -1;
    if (!aMatches && bMatches) return 1;
    return 0;
  });
}

export function toggleExpandedItpCategory(
  expandedCategories: Set<string>,
  category: string,
): Set<string> {
  const next = new Set(expandedCategories);
  if (next.has(category)) {
    next.delete(category);
  } else {
    next.add(category);
  }
  return next;
}
