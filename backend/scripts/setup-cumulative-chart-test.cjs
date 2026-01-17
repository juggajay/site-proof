/**
 * Test data setup for Feature #649: Claim cumulative chart
 * Creates multiple claims across several months for a project
 * to verify cumulative chart functionality
 */

// Set the DATABASE_URL for the script - using absolute path
const path = require('path')
process.env.DATABASE_URL = 'file:' + path.join(__dirname, '..', 'prisma', 'dev.db')

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Setting up cumulative chart test data...\n')

  // Use pre-hashed password for 'password123'
  const passwordHash = '$2a$10$rKN3E89U1P5Q6dqL5rKH6.dAJQXhJ8.4XYM7EM1c3HjL1ZL6qR3E.'

  let company = await prisma.company.findFirst({
    where: { name: 'Cumulative Chart Test Company' }
  })

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Cumulative Chart Test Company',
        abn: '99 123 456 789',
        address: '123 Test Street, Sydney NSW 2000'
      }
    })
    console.log('Created company:', company.name)
  }

  let user = await prisma.user.findUnique({
    where: { email: 'cumulative-test@test.com' }
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'cumulative-test@test.com',
        passwordHash,
        fullName: 'Cumulative Tester',
        roleInCompany: 'admin',
        companyId: company.id
      }
    })
    console.log('Created user:', user.email)
  }

  // Create test project
  let project = await prisma.project.findFirst({
    where: { projectNumber: 'CUMUL-TEST-001' }
  })

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'Cumulative Chart Test Project',
        projectNumber: 'CUMUL-TEST-001',
        clientName: 'Test Client',
        status: 'active',
        startDate: new Date('2025-08-01'),
        targetCompletion: new Date('2026-06-30'),
        contractValue: 2500000,
        companyId: company.id,
        state: 'NSW',
        specificationSet: 'Roads and Maritime Services QA'
      }
    })
    console.log('Created project:', project.name)

    // Add user to project
    await prisma.projectUser.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: 'project_manager',
        status: 'active'
      }
    })
  }

  // Create multiple claims across months
  const claimsData = [
    {
      claimNumber: 1,
      claimPeriodStart: new Date('2025-08-01'),
      claimPeriodEnd: new Date('2025-08-31'),
      status: 'paid',
      totalClaimedAmount: 75000,
      certifiedAmount: 72000,
      paidAmount: 72000,
      submittedAt: new Date('2025-09-05'),
      certifiedAt: new Date('2025-09-10'),
      paidAt: new Date('2025-09-20')
    },
    {
      claimNumber: 2,
      claimPeriodStart: new Date('2025-09-01'),
      claimPeriodEnd: new Date('2025-09-30'),
      status: 'paid',
      totalClaimedAmount: 125000,
      certifiedAmount: 120000,
      paidAmount: 120000,
      submittedAt: new Date('2025-10-05'),
      certifiedAt: new Date('2025-10-10'),
      paidAt: new Date('2025-10-22')
    },
    {
      claimNumber: 3,
      claimPeriodStart: new Date('2025-10-01'),
      claimPeriodEnd: new Date('2025-10-31'),
      status: 'paid',
      totalClaimedAmount: 185000,
      certifiedAmount: 180000,
      paidAmount: 180000,
      submittedAt: new Date('2025-11-05'),
      certifiedAt: new Date('2025-11-10'),
      paidAt: new Date('2025-11-21')
    },
    {
      claimNumber: 4,
      claimPeriodStart: new Date('2025-11-01'),
      claimPeriodEnd: new Date('2025-11-30'),
      status: 'paid',
      totalClaimedAmount: 220000,
      certifiedAmount: 215000,
      paidAmount: 215000,
      submittedAt: new Date('2025-12-05'),
      certifiedAt: new Date('2025-12-10'),
      paidAt: new Date('2025-12-20')
    },
    {
      claimNumber: 5,
      claimPeriodStart: new Date('2025-12-01'),
      claimPeriodEnd: new Date('2025-12-31'),
      status: 'certified',
      totalClaimedAmount: 275000,
      certifiedAmount: 268000,
      paidAmount: null,
      submittedAt: new Date('2026-01-05'),
      certifiedAt: new Date('2026-01-12'),
      paidAt: null
    },
    {
      claimNumber: 6,
      claimPeriodStart: new Date('2026-01-01'),
      claimPeriodEnd: new Date('2026-01-31'),
      status: 'submitted',
      totalClaimedAmount: 195000,
      certifiedAmount: null,
      paidAmount: null,
      submittedAt: new Date('2026-01-15'),
      certifiedAt: null,
      paidAt: null
    }
  ]

  // Delete existing claims for this project first
  await prisma.progressClaim.deleteMany({
    where: { projectId: project.id }
  })
  console.log('Cleared existing claims for project')

  // Create the claims
  for (const claimData of claimsData) {
    const claim = await prisma.progressClaim.create({
      data: {
        projectId: project.id,
        claimNumber: claimData.claimNumber,
        claimPeriodStart: claimData.claimPeriodStart,
        claimPeriodEnd: claimData.claimPeriodEnd,
        status: claimData.status,
        totalClaimedAmount: claimData.totalClaimedAmount,
        certifiedAmount: claimData.certifiedAmount,
        paidAmount: claimData.paidAmount,
        submittedAt: claimData.submittedAt,
        certifiedAt: claimData.certifiedAt,
        paidAt: claimData.paidAt,
        preparedById: user.id
      }
    })
    console.log(`Created Claim #${claim.claimNumber} - ${claimData.status} - $${claimData.totalClaimedAmount.toLocaleString()}`)
  }

  console.log('\n========================================')
  console.log('Test data setup complete!')
  console.log('========================================')
  console.log('\nLogin credentials:')
  console.log('Email: cumulative-test@test.com')
  console.log('Password: password123')
  console.log('\nProject: Cumulative Chart Test Project')
  console.log('Project ID:', project.id)
  console.log('\nExpected cumulative totals:')
  console.log('Aug 25: $75,000 claimed, $72,000 certified, $72,000 paid')
  console.log('Sep 25: $200,000 claimed, $192,000 certified, $192,000 paid')
  console.log('Oct 25: $385,000 claimed, $372,000 certified, $372,000 paid')
  console.log('Nov 25: $605,000 claimed, $587,000 certified, $587,000 paid')
  console.log('Dec 25: $880,000 claimed, $855,000 certified, $587,000 paid')
  console.log('Jan 26: $1,075,000 claimed, $855,000 certified, $587,000 paid')
  console.log('\nTotal claims: 6')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
