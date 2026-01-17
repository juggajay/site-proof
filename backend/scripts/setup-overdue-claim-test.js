// Setup test data for Feature #647: Claim certification overdue highlight
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Setting up overdue claim test data...')

  // Find a project with a user we can use
  const project = await prisma.project.findFirst({
    where: {
      projectUsers: {
        some: {}
      }
    },
    include: {
      company: true,
      projectUsers: {
        include: {
          user: true
        }
      }
    }
  })

  if (!project) {
    console.error('No project found. Please create a project first.')
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
  const lotNumber = `LOT-OVERDUE-TEST-${Date.now()}`
  const lot = await prisma.lot.create({
    data: {
      projectId: project.id,
      lotNumber,
      lotType: 'construction',
      description: 'Test lot for overdue claim feature',
      status: 'conformed',
      activityType: 'Earthworks',
      budgetAmount: 50000,
      chainageStart: 0,
      chainageEnd: 100,
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

  // Create a claim that was submitted 20 business days ago (well past 10-day SOPA timeframe)
  // This should show as overdue by approximately 10+ days
  const twentyBusinessDaysAgo = new Date()
  let businessDays = 20
  while (businessDays > 0) {
    twentyBusinessDaysAgo.setDate(twentyBusinessDaysAgo.getDate() - 1)
    const dayOfWeek = twentyBusinessDaysAgo.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays--
    }
  }

  const claim = await prisma.progressClaim.create({
    data: {
      projectId: project.id,
      claimNumber,
      claimPeriodStart: new Date('2025-12-01'),
      claimPeriodEnd: new Date('2025-12-31'),
      status: 'submitted',
      preparedById: user.id,
      preparedAt: twentyBusinessDaysAgo,
      submittedAt: twentyBusinessDaysAgo, // This makes it overdue!
      totalClaimedAmount: 50000,
      claimedLots: {
        create: {
          lotId: lot.id,
          quantity: 1,
          unit: 'ea',
          rate: 50000,
          amountClaimed: 50000,
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

  console.log(`\nCreated overdue claim: Claim ${claimNumber}`)
  console.log(`  Claim ID: ${claim.id}`)
  console.log(`  Submitted at: ${twentyBusinessDaysAgo.toISOString()}`)
  console.log(`  Status: ${claim.status}`)
  console.log(`  Total Amount: $${claim.totalClaimedAmount}`)
  console.log(`\nThis claim should show as certification OVERDUE (submitted 20 business days ago, SOPA allows 10 days)`)
  console.log(`\nProject ID for testing: ${project.id}`)
  console.log(`Navigate to: http://localhost:5174/projects/${project.id}/claims`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
