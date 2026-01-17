// Setup test data for Feature #648: Claim disputed status
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Setting up dispute claim test data...')

  // Use the Subcontractor Test Project which admin@test.com has access to
  const projectId = 'cb950c13-368c-4e33-afb9-27e79fd90dcd'

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectUsers: {
        include: {
          user: true
        }
      }
    }
  })

  if (!project) {
    console.error('Project not found:', projectId)
    process.exit(1)
  }

  console.log(`Using project: ${project.name} (${project.id})`)

  const user = project.projectUsers[0]?.user
  if (!user) {
    console.error('No user found in project.')
    process.exit(1)
  }

  console.log(`Using user: ${user.fullName} (${user.id})`)

  // Create a conformed lot for the claim
  const lotNumber = `LOT-DISPUTE-TEST-${Date.now()}`
  const lot = await prisma.lot.create({
    data: {
      projectId: project.id,
      lotNumber,
      lotType: 'construction',
      description: 'Test lot for dispute claim feature',
      status: 'conformed',
      activityType: 'Earthworks',
      budgetAmount: 75000,
      chainageStart: 100,
      chainageEnd: 200,
      layer: 'base'
    }
  })

  console.log(`Created lot: ${lot.lotNumber} (${lot.id})`)

  // Get the next claim number
  const lastClaim = await prisma.progressClaim.findFirst({
    where: { projectId: project.id },
    orderBy: { claimNumber: 'desc' }
  })
  const claimNumber = (lastClaim?.claimNumber || 0) + 1

  // Create a submitted claim (3 days ago to make it realistic)
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  const claim = await prisma.progressClaim.create({
    data: {
      projectId: project.id,
      claimNumber,
      claimPeriodStart: new Date('2026-01-01'),
      claimPeriodEnd: new Date('2026-01-15'),
      status: 'submitted',
      preparedById: user.id,
      preparedAt: threeDaysAgo,
      submittedAt: threeDaysAgo,
      totalClaimedAmount: 75000,
      claimedLots: {
        create: {
          lotId: lot.id,
          quantity: 1,
          unit: 'ea',
          rate: 75000,
          amountClaimed: 75000,
          percentageComplete: 100
        }
      }
    }
  })

  // Update the lot to link to this claim
  await prisma.lot.update({
    where: { id: lot.id },
    data: {
      claimedInId: claim.id,
      status: 'claimed'
    }
  })

  console.log(`\nCreated submitted claim: Claim ${claimNumber}`)
  console.log(`  Claim ID: ${claim.id}`)
  console.log(`  Submitted at: ${threeDaysAgo.toISOString()}`)
  console.log(`  Status: ${claim.status}`)
  console.log(`  Total Amount: $${claim.totalClaimedAmount}`)
  console.log(`\nThis claim is in 'submitted' status and can be marked as disputed.`)
  console.log(`\nProject ID for testing: ${project.id}`)
  console.log(`Navigate to: http://localhost:5174/projects/${project.id}/claims`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
