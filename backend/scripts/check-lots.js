import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const lots = await prisma.lot.findMany({
    where: { projectId: '28490410-acc1-4d6d-8638-6bfb3f339d92' },
    select: {
      lotNumber: true,
      assignedSubcontractorId: true,
      status: true,
      activityType: true,
      assignedSubcontractor: {
        select: { companyName: true }
      }
    }
  })
  console.log('Lots in Subcontractor Test Project:')
  console.log(JSON.stringify(lots, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
