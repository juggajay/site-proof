import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Find an existing hold point
  const existingHP = await prisma.holdPoint.findFirst({
    where: {
      status: { in: ['pending', 'scheduled', 'requested'] }
    },
    select: {
      id: true,
      status: true,
      createdAt: true
    }
  })

  if (existingHP) {
    // Update the createdAt to be 10 days ago
    const staleDate = new Date()
    staleDate.setDate(staleDate.getDate() - 10)

    await prisma.holdPoint.update({
      where: { id: existingHP.id },
      data: { createdAt: staleDate }
    })
    console.log('Updated hold point to be stale (10 days old):', existingHP.id)
  } else {
    console.log('No pending hold points found')

    // Let's find a lot and create a hold point
    const lot = await prisma.lot.findFirst({
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

    if (lot && lot.itpInstance && lot.itpInstance.template.checklistItems.length > 0) {
      const checklistItem = lot.itpInstance.template.checklistItems[0]
      const staleDate = new Date()
      staleDate.setDate(staleDate.getDate() - 10)

      await prisma.holdPoint.create({
        data: {
          lotId: lot.id,
          itpChecklistItemId: checklistItem.id,
          pointType: 'hold',
          description: 'Stale test hold point',
          status: 'pending',
          createdAt: staleDate
        }
      })
      console.log('Created stale hold point for lot:', lot.lotNumber)
    } else {
      console.log('No suitable lot found with ITP instance')
    }
  }

  // Verify stale hold points count
  const staleDate = new Date()
  staleDate.setDate(staleDate.getDate() - 7)

  const staleHPs = await prisma.holdPoint.findMany({
    where: {
      status: { in: ['pending', 'scheduled', 'requested'] },
      createdAt: { lt: staleDate }
    },
    select: {
      id: true,
      description: true,
      createdAt: true,
      status: true
    }
  })
  console.log('\nStale Hold Points:', staleHPs.length)
  staleHPs.forEach(hp => {
    const daysOld = Math.ceil((new Date().getTime() - hp.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    console.log(`  - ${hp.description || 'No description'}: ${daysOld} days old, status=${hp.status}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
