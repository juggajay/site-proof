/**
 * Fix N/A status for items that were intended to be marked as N/A
 * These items have notes that indicate they should be N/A but the status wasn't saved
 */
import dotenv from 'dotenv'
dotenv.config({ path: 'D:/site-proofv3/backend/.env' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Fixing N/A Status for Test Lot ===\n')

  // Find completions for NA-TEST-LOT-001 that should be N/A based on their notes
  const completions = await prisma.iTPCompletion.findMany({
    where: {
      itpInstance: {
        lotId: 'd1499c3e-b18c-44b9-9986-04e679513471'
      }
    },
    include: {
      itpInstance: {
        include: {
          template: {
            include: {
              checklistItems: true
            }
          }
        }
      }
    }
  })

  console.log(`Found ${completions.length} completions`)

  // Get admin user for completedById
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@test.com' }
  })

  if (!admin) {
    console.log('Admin user not found')
    return
  }

  // Items that were marked as N/A but didn't save properly
  const naPatterns = [
    'not required',
    'not needed',
    'not applicable',
    'n/a',
    'already verified',
    'already prepared'
  ]

  for (const completion of completions) {
    const item = completion.itpInstance.template.checklistItems.find(
      i => i.id === completion.checklistItemId
    )
    const notes = completion.notes?.toLowerCase() || ''

    // Check if notes indicate this should be N/A
    const shouldBeNA = naPatterns.some(pattern => notes.includes(pattern))

    if (shouldBeNA && completion.status !== 'not_applicable') {
      console.log(`\nUpdating ${item?.description}:`)
      console.log(`  Notes: ${completion.notes}`)
      console.log(`  Old status: ${completion.status}`)

      await prisma.iTPCompletion.update({
        where: { id: completion.id },
        data: {
          status: 'not_applicable',
          completedAt: new Date(),
          completedById: admin.id
        }
      })

      console.log(`  New status: not_applicable`)
    } else {
      console.log(`Skipping ${item?.description}: status=${completion.status}`)
    }
  }

  console.log('\n=== Done ===')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
