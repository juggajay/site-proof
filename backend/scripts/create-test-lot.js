import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // First ensure a company exists
  const company = await prisma.company.upsert({
    where: { id: 'main-company-id' },
    update: {},
    create: {
      id: 'main-company-id',
      name: 'Main Construction Co',
      abn: '11111111111',
    },
  })
  console.log('Created/Found company:', company.name)

  // First create a test project if it doesn't exist
  const project = await prisma.project.upsert({
    where: { id: 'test-project-1' },
    update: {},
    create: {
      id: 'test-project-1',
      companyId: company.id,
      projectNumber: 'PRJ-001',
      name: 'Test Project 1',
      status: 'active',
      state: 'NSW',
      specificationSet: 'AUS-SPEC',
    },
  })
  console.log('Created/Found project:', project.name)

  // Create a lot assigned to Subcontractor A
  const lotA = await prisma.lot.upsert({
    where: { id: 'lot-for-subcontractor-a' },
    update: {
      subcontractorId: 'subcontractor-a-company-id',
    },
    create: {
      id: 'lot-for-subcontractor-a',
      projectId: project.id,
      lotNumber: 'LOT-SUBA-001',
      description: 'Lot assigned to Subcontractor A',
      status: 'in_progress',
      activityType: 'earthworks',
      subcontractorId: 'subcontractor-a-company-id',
    },
  })
  console.log('Created/Updated lot for SubA:', lotA.lotNumber, '- ID:', lotA.id)

  // Create a lot assigned to Subcontractor B
  const lotB = await prisma.lot.upsert({
    where: { id: 'lot-for-subcontractor-b' },
    update: {
      subcontractorId: 'subcontractor-b-company-id',
    },
    create: {
      id: 'lot-for-subcontractor-b',
      projectId: project.id,
      lotNumber: 'LOT-SUBB-001',
      description: 'Lot assigned to Subcontractor B',
      status: 'pending',
      activityType: 'concreting',
      subcontractorId: 'subcontractor-b-company-id',
    },
  })
  console.log('Created/Updated lot for SubB:', lotB.lotNumber, '- ID:', lotB.id)

  // Create an unassigned lot (for other users)
  const lotUnassigned = await prisma.lot.upsert({
    where: { id: 'lot-unassigned' },
    update: {},
    create: {
      id: 'lot-unassigned',
      projectId: project.id,
      lotNumber: 'LOT-GENERAL-001',
      description: 'General lot - not assigned to subcontractor',
      status: 'pending',
      activityType: 'general',
    },
  })
  console.log('Created/Updated unassigned lot:', lotUnassigned.lotNumber, '- ID:', lotUnassigned.id)

  console.log('\nTest lot IDs:')
  console.log('- Lot for SubA:', lotA.id)
  console.log('- Lot for SubB:', lotB.id)
  console.log('- Unassigned lot:', lotUnassigned.id)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
