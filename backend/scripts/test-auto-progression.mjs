/**
 * Test lot status auto-progression
 */
import dotenv from 'dotenv'
dotenv.config({ path: 'D:/site-proofv3/backend/.env' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Testing Lot Status Auto-Progression ===\n')

  // Find the lot
  const lotNumber = 'AREA-FILTER-A1-1'
  const lot = await prisma.lot.findFirst({
    where: { lotNumber },
    include: {
      itpInstance: {
        include: {
          completions: true,
          template: {
            include: {
              checklistItems: true
            }
          }
        }
      }
    }
  })

  if (!lot) {
    console.log(`Lot ${lotNumber} not found`)
    return
  }

  console.log(`Lot: ${lot.lotNumber}`)
  console.log(`Current status: ${lot.status}`)
  console.log(`Has ITP instance: ${lot.itpInstance ? 'Yes' : 'No'}`)

  if (lot.itpInstance) {
    console.log(`\nITP Instance ID: ${lot.itpInstance.id}`)
    console.log(`Template: ${lot.itpInstance.template?.name}`)
    console.log(`Checklist items: ${lot.itpInstance.template?.checklistItems?.length || 0}`)
    console.log(`Completions: ${lot.itpInstance.completions?.length || 0}`)

    // Show completion details
    for (const completion of lot.itpInstance.completions || []) {
      const item = lot.itpInstance.template?.checklistItems?.find(i => i.id === completion.checklistItemId)
      console.log(`  - ${item?.description || completion.checklistItemId}: ${completion.status}`)
    }

    // Check if we should auto-progress
    const completedCount = lot.itpInstance.completions?.filter(c => c.status === 'completed').length || 0
    console.log(`\nCompleted items: ${completedCount}`)

    // Complete the second item to test awaiting_test status
    const secondItem = lot.itpInstance.template?.checklistItems?.find(
      (item) => item.description === 'Work completion check'
    )

    if (secondItem) {
      // Check if already completed
      const existingCompletion = lot.itpInstance.completions?.find(
        c => c.checklistItemId === secondItem.id
      )

      if (!existingCompletion || existingCompletion.status !== 'completed') {
        console.log(`\n>>> Completing second item: ${secondItem.description}`)

        // Create or update completion
        if (existingCompletion) {
          await prisma.iTPCompletion.update({
            where: { id: existingCompletion.id },
            data: { status: 'completed', completedAt: new Date() }
          })
        } else {
          await prisma.iTPCompletion.create({
            data: {
              itpInstanceId: lot.itpInstance.id,
              checklistItemId: secondItem.id,
              status: 'completed',
              completedAt: new Date()
            }
          })
        }
        console.log('>>> Second item completed')
      }
    }

    // Check for test items
    const testItems = lot.itpInstance.template?.checklistItems?.filter(
      item => item.evidenceRequired === 'test'
    ) || []
    const nonTestItems = lot.itpInstance.template?.checklistItems?.filter(
      item => item.evidenceRequired !== 'test'
    ) || []

    // Refresh completions
    const freshLot = await prisma.lot.findFirst({
      where: { id: lot.id },
      include: {
        itpInstance: { include: { completions: true } }
      }
    })

    const completedItemIds = new Set(
      freshLot.itpInstance.completions
        .filter(c => c.status === 'completed')
        .map(c => c.checklistItemId)
    )

    const completedNonTestCount = nonTestItems.filter(item =>
      completedItemIds.has(item.id)
    ).length

    console.log(`\nTest items: ${testItems.length}`)
    console.log(`Non-test items: ${nonTestItems.length}`)
    console.log(`Completed non-test items: ${completedNonTestCount}`)

    // Check if all non-test items complete but test items remain
    if (nonTestItems.length > 0 && completedNonTestCount === nonTestItems.length && testItems.length > 0) {
      console.log('\n>>> All non-test items complete, should progress to "awaiting_test"!')
      await prisma.lot.update({
        where: { id: lot.id },
        data: { status: 'awaiting_test' }
      })
      console.log('>>> Status updated to "awaiting_test"')
    } else if (lot.status === 'not_started' && completedCount > 0) {
      console.log('\n>>> Should auto-progress to "in_progress"!')
      await prisma.lot.update({
        where: { id: lot.id },
        data: { status: 'in_progress' }
      })
      console.log('>>> Status updated to "in_progress"')
    }
  }

  // Check updated status
  const updatedLot = await prisma.lot.findUnique({
    where: { id: lot.id },
    select: { status: true }
  })
  console.log(`\nFinal lot status: ${updatedLot?.status}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
