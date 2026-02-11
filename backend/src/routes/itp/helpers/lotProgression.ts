import { prisma } from '../../../lib/prisma.js'
import type { ChecklistItem, TemplateSnapshot } from './witnessPoints.js'

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
        lot: true,
        template: {
          include: {
            checklistItems: true
          }
        },
        completions: true
      }
    })

    if (!instance || !instance.lot) {
      return
    }

    const lot = instance.lot

    // Don't auto-progress lots that are conformed, claimed, or have NCRs
    if (['conformed', 'claimed', 'ncr_raised'].includes(lot.status)) {
      return
    }

    // Get checklist items from snapshot or template
    let checklistItems: ChecklistItem[]
    if (instance.templateSnapshot) {
      const snapshot: TemplateSnapshot = JSON.parse(instance.templateSnapshot)
      checklistItems = snapshot.checklistItems || []
    } else {
      checklistItems = instance.template.checklistItems
    }

    const totalItems = checklistItems.length
    if (totalItems === 0) {
      return
    }

    // Count completed items (including N/A items as "finished")
    const completedItemIds = new Set(
      instance.completions
        .filter(c => c.status === 'completed' || c.status === 'not_applicable')
        .map(c => c.checklistItemId)
    )

    const completedCount = completedItemIds.size

    // Identify test items (items with evidenceRequired === 'test' or testType set)
    const testItems = checklistItems.filter((item) => item.evidenceRequired === 'test' || item.testType)
    const nonTestItems = checklistItems.filter((item) => item.evidenceRequired !== 'test' && !item.testType)

    // Count completed non-test items
    const completedNonTestCount = nonTestItems.filter((item) =>
      completedItemIds.has(item.id)
    ).length

    // Count completed test items
    const completedTestCount = testItems.filter((item) =>
      completedItemIds.has(item.id)
    ).length

    // Determine new status
    let newStatus: string | null = null

    if (lot.status === 'not_started' && completedCount > 0) {
      // First item completed - transition to in_progress
      newStatus = 'in_progress'
    } else if (lot.status === 'in_progress' || lot.status === 'not_started') {
      // Check if all non-test items are complete
      if (nonTestItems.length > 0 && completedNonTestCount === nonTestItems.length) {
        if (testItems.length > 0 && completedTestCount < testItems.length) {
          // All non-test items done, but test items remain
          newStatus = 'awaiting_test'
        } else if (testItems.length === 0 || completedTestCount === testItems.length) {
          // All items complete (or no test items)
          newStatus = 'completed'
        }
      }
    } else if (lot.status === 'awaiting_test') {
      // Check if all test items are now complete
      if (testItems.length > 0 && completedTestCount === testItems.length) {
        newStatus = 'completed'
      }
    }

    // Update lot status if changed
    if (newStatus && newStatus !== lot.status) {
      await prisma.lot.update({
        where: { id: lot.id },
        data: { status: newStatus }
      })
    }
  } catch (error) {
    // Log but don't throw - status update is not critical
    // Note: This helper intentionally catches errors since lot status update is non-critical
    console.error('Error auto-progressing lot status:', error)
  }
}
