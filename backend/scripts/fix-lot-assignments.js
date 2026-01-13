import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get subcontractor company IDs
  const subA = await prisma.subcontractorCompany.findFirst({
    where: { companyName: 'Test Subcontractor A' }
  })
  const subB = await prisma.subcontractorCompany.findFirst({
    where: { companyName: 'Test Subcontractor B' }
  })

  console.log('Subcontractor A ID:', subA?.id)
  console.log('Subcontractor B ID:', subB?.id)

  // Fix SUB-A-LOT-001 to be assigned to Subcontractor A
  await prisma.lot.update({
    where: {
      projectId_lotNumber: {
        projectId: '28490410-acc1-4d6d-8638-6bfb3f339d92',
        lotNumber: 'SUB-A-LOT-001'
      }
    },
    data: {
      assignedSubcontractorId: subA.id
    }
  })
  console.log('Fixed SUB-A-LOT-001 -> Subcontractor A')

  // Fix SUB-B-LOT-001 to be assigned to Subcontractor B (just to confirm)
  await prisma.lot.update({
    where: {
      projectId_lotNumber: {
        projectId: '28490410-acc1-4d6d-8638-6bfb3f339d92',
        lotNumber: 'SUB-B-LOT-001'
      }
    },
    data: {
      assignedSubcontractorId: subB.id
    }
  })
  console.log('Confirmed SUB-B-LOT-001 -> Subcontractor B')

  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
