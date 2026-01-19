// Script to create many lots for testing infinite scroll
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find the Cumulative Chart Test Project
  const project = await prisma.project.findFirst({
    where: { projectNumber: 'CUMUL-TEST-001' }
  })

  if (!project) {
    console.log('Project CUMUL-TEST-001 not found, trying to find any project...')
    const anyProject = await prisma.project.findFirst()
    if (!anyProject) {
      console.log('No projects found. Please create a project first.')
      return
    }
    console.log('Using project:', anyProject.name, anyProject.id)
    await createLots(anyProject.id)
    return
  }

  console.log('Found project:', project.name, project.id)
  await createLots(project.id)
}

async function createLots(projectId) {
  // Check how many lots already exist
  const existingLots = await prisma.lot.count({ where: { projectId } })
  console.log('Existing lots:', existingLots)

  // Create 50 lots for testing infinite scroll
  const lotsToCreate = 50
  console.log(`Creating ${lotsToCreate} lots for infinite scroll testing...`)

  const activities = ['Earthworks', 'Concrete', 'Asphalt', 'Drainage', 'Utilities', 'Landscaping']
  const statuses = ['not_started', 'in_progress', 'completed', 'hold_point', 'awaiting_test']

  for (let i = 1; i <= lotsToCreate; i++) {
    const lotNumber = `SCROLL-TEST-${String(i).padStart(3, '0')}`

    // Check if lot already exists
    const existing = await prisma.lot.findFirst({
      where: { projectId, lotNumber }
    })

    if (existing) {
      console.log(`Lot ${lotNumber} already exists, skipping...`)
      continue
    }

    await prisma.lot.create({
      data: {
        projectId,
        lotNumber,
        description: `Test lot ${i} for infinite scroll verification - ${activities[i % activities.length]}`,
        status: statuses[i % statuses.length],
        activityType: activities[i % activities.length],
        chainageStart: 1000 + (i * 50),
        chainageEnd: 1000 + (i * 50) + 30,
        layer: `Layer ${(i % 3) + 1}`,
        areaZone: `Zone ${String.fromCharCode(65 + (i % 4))}`, // Zone A, B, C, D
        lotType: 'standard',
      }
    })

    if (i % 10 === 0) {
      console.log(`Created ${i} lots...`)
    }
  }

  const finalCount = await prisma.lot.count({ where: { projectId } })
  console.log(`Done! Total lots in project: ${finalCount}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
