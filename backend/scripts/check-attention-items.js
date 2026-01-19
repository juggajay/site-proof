import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const today = new Date()

  // Check for overdue NCRs
  const overdueNCRs = await prisma.nCR.count({
    where: {
      status: { notIn: ['closed', 'closed_concession'] },
      dueDate: { lt: today }
    }
  })
  console.log('Overdue NCRs:', overdueNCRs)

  // Check for stale hold points (older than 7 days)
  const staleDate = new Date()
  staleDate.setDate(staleDate.getDate() - 7)

  const staleHPs = await prisma.holdPoint.count({
    where: {
      status: { in: ['pending', 'scheduled', 'requested'] },
      createdAt: { lt: staleDate }
    }
  })
  console.log('Stale Hold Points:', staleHPs)

  // Show some open NCRs without due dates - we can add due dates to them
  const openNCRs = await prisma.nCR.findMany({
    where: {
      status: { notIn: ['closed', 'closed_concession'] }
    },
    select: {
      id: true,
      ncrNumber: true,
      dueDate: true,
      status: true
    },
    take: 10
  })
  console.log('\nOpen NCRs:')
  openNCRs.forEach(ncr => {
    console.log(`  - ${ncr.ncrNumber}: due=${ncr.dueDate || 'not set'}, status=${ncr.status}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
