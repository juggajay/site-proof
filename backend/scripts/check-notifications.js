import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Check for HP release notifications
  const hpNotifications = await prisma.notification.findMany({
    where: {
      OR: [
        { type: 'hold_point_release' },
        { title: { contains: 'Hold Point' } }
      ]
    },
    include: {
      user: { select: { email: true, fullName: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })
  console.log('HP Release Notifications:')
  console.log(JSON.stringify(hpNotifications, null, 2))

  // Show all recent notifications
  const allRecent = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  })
  console.log('\nMost recent 5 notifications:')
  console.log(JSON.stringify(allRecent, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
