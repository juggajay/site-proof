import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find the most recent NCR raised notification
  const notifications = await prisma.notification.findMany({
    where: {
      type: 'ncr_raised'
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      user: { select: { email: true, fullName: true } },
      project: { select: { name: true } }
    }
  })

  console.log('=== NCR Raised Notifications ===')
  if (notifications.length === 0) {
    console.log('No NCR raised notifications found')
  } else {
    notifications.forEach((n, i) => {
      console.log(`\n[${i + 1}] ${n.title}`)
      console.log(`    Message: ${n.message}`)
      console.log(`    To: ${n.user?.fullName || n.user?.email || 'Unknown'}`)
      console.log(`    Project: ${n.project?.name || 'Unknown'}`)
      console.log(`    Created: ${n.createdAt}`)
      console.log(`    Read: ${n.isRead}`)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
