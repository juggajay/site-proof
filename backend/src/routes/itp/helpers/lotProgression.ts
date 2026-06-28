import { prisma } from '../../../lib/prisma.js';
import { logError } from '../../../lib/serverLogger.js';
import { isReleaseGatedChecklistItem } from '../../../lib/holdPointReleaseGating.js';
import { getChecklistItemsForInstance, type ChecklistItem } from './templateSnapshot.js';

/**
 * Auto-progress lot status based on ITP completion state
 * - NOT_STARTED -> IN_PROGRESS: When first ITP item is completed
 * - IN_PROGRESS -> AWAITING_TEST: When all non-test items are complete but test items remain
 * - AWAITING_TEST -> COMPLETED: When all items including tests are complete
 */
export async function updateLotStatusFromITP(itpInstanceId: string) {
  try {
    // Get the ITP instance with lot and all completion data
    const instance = await prisma.iTPInstance.findUnique({
      where: { id: itpInstanceId },
      include: {
        lot: {
          include: {
            holdPoints: {
              select: {
                itpChecklistItemId: true,
                status: true,
              },
            },
          },
        },
        template: {
          include: {
            checklistItems: true,
          },
        },
        completions: true,
      },
    });

    if (!instance || !instance.lot) {
      return;
    }

    const lot = instance.lot;

    // Don't auto-progress lots that are conformed, claimed, or have NCRs
    if (['conformed', 'claimed', 'ncr_raised'].includes(lot.status)) {
      return;
    }

    // Get checklist items from snapshot or template.
    const checklistItems: ChecklistItem[] = getChecklistItemsForInstance(instance);

    const totalItems = checklistItems.length;
    if (totalItems === 0) {
      return;
    }

    const releaseGatedItemIds = new Set(
      checklistItems.filter(isReleaseGatedChecklistItem).map((item) => item.id),
    );
    const releasedHoldPointItemIds = new Set(
      lot.holdPoints
        .filter((holdPoint) => holdPoint.status === 'released')
        .map((holdPoint) => holdPoint.itpChecklistItemId),
    );

    // Count completed items (including N/A items as "finished"), but work that
    // is still awaiting review or has been rejected is not accepted yet and must
    // not auto-progress the lot. N/A on a release-gated hold point is also not
    // accepted until the hold-point release record exists.
    const completedItemIds = new Set(
      instance.completions
        .filter((c) => {
          if (c.status !== 'completed' && c.status !== 'not_applicable') {
            return false;
          }
          if (
            c.verificationStatus === 'pending_verification' ||
            c.verificationStatus === 'rejected'
          ) {
            return false;
          }
          if (
            c.status === 'not_applicable' &&
            releaseGatedItemIds.has(c.checklistItemId) &&
            !releasedHoldPointItemIds.has(c.checklistItemId)
          ) {
            return false;
          }
          return true;
        })
        .map((c) => c.checklistItemId),
    );

    const completedCount = completedItemIds.size;

    // Identify test items (items with evidenceRequired === 'test' or testType set)
    const testItems = checklistItems.filter(
      (item) => item.evidenceRequired === 'test' || item.testType,
    );
    const nonTestItems = checklistItems.filter(
      (item) => item.evidenceRequired !== 'test' && !item.testType,
    );

    // Count completed non-test items
    const completedNonTestCount = nonTestItems.filter((item) =>
      completedItemIds.has(item.id),
    ).length;

    // Count completed test items
    const completedTestCount = testItems.filter((item) => completedItemIds.has(item.id)).length;

    // Determine new status
    let newStatus: string | null = null;

    if (lot.status === 'in_progress' || lot.status === 'not_started') {
      if (completedCount === totalItems) {
        newStatus = 'completed';
      } else if (
        nonTestItems.length > 0 &&
        completedNonTestCount === nonTestItems.length &&
        testItems.length > 0
      ) {
        // All non-test items done, but test items remain.
        newStatus = 'awaiting_test';
      }
      if (!newStatus && lot.status === 'not_started' && completedCount > 0) {
        // First item completed, but the ITP still has outstanding work.
        newStatus = 'in_progress';
      }
    } else if (lot.status === 'awaiting_test') {
      // Check if all test items are now complete
      if (testItems.length > 0 && completedTestCount === testItems.length) {
        newStatus = 'completed';
      }
    }

    // Update lot status if changed
    if (newStatus && newStatus !== lot.status) {
      await prisma.lot.update({
        where: { id: lot.id },
        data: { status: newStatus },
      });
    }
    if (newStatus && newStatus !== instance.status) {
      await prisma.iTPInstance.update({
        where: { id: instance.id },
        data: { status: newStatus },
      });
    }
  } catch (error) {
    // Log but don't throw - status update is not critical
    // Note: This helper intentionally catches errors since lot status update is non-critical
    logError('Error auto-progressing lot status:', error);
  }
}
