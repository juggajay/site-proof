import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const notifications = await prisma.notification.findMany({
    where: {
      projectId: '28490410-acc1-4d6d-8638-6bfb3f339d92',
      type: 'ncr_raised'
    },
    include: {
      user: { select: { email: true, fullName: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
  console.log('NCR Raised Notifications:')
  console.log(JSON.stringify(notifications, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
