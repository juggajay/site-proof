// Setup test data for Feature #502: Dashboard items requiring attention
// Creates overdue NCRs and stale hold points

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

// Simple password hashing compatible with existing system
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

const prisma = new PrismaClient()

async function main() {
  console.log('Setting up attention items test data...')

  // Find or create a test company
  let company = await prisma.company.findFirst({
    where: { name: 'Attention Test Company' }
  })

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Attention Test Company',
        abn: '11 222 333 444'
      }
    })
    console.log('Created company:', company.name)
  }

  // Find or create a test user
  let user = await prisma.user.findFirst({
    where: { email: 'attention-test@test.com' }
  })

  if (!user) {
    const hashedPassword = hashPassword('password123')
    user = await prisma.user.create({
      data: {
        email: 'attention-test@test.com',
        passwordHash: hashedPassword,
        fullName: 'Attention Test User',
        roleInCompany: 'admin',
        companyId: company.id
      }
    })
    console.log('Created user:', user.email)
  }

  // Find or create a test project
  let project = await prisma.project.findFirst({
    where: { name: 'Attention Test Project' }
  })

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'Attention Test Project',
        projectNumber: 'ATT-001',
        companyId: company.id,
        status: 'active',
        state: 'VIC',
        specificationSet: 'MRTS'
      }
    })
    console.log('Created project:', project.name)
  }

  // Add user to project if not already added
  const existingAccess = await prisma.projectUser.findFirst({
    where: { projectId: project.id, userId: user.id }
  })

  if (!existingAccess) {
    await prisma.projectUser.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: 'admin'
      }
    })
    console.log('Added user to project')
  }

  // Create a test lot
  let lot = await prisma.lot.findFirst({
    where: { lotNumber: 'ATT-LOT-001', projectId: project.id }
  })

  if (!lot) {
    lot = await prisma.lot.create({
      data: {
        lotNumber: 'ATT-LOT-001',
        projectId: project.id,
        status: 'in_progress',
        activityType: 'Earthworks',
        lotType: 'linear'
      }
    })
    console.log('Created lot:', lot.lotNumber)
  }

  // Create overdue NCRs (due date in the past, not closed)
  const pastDate1 = new Date()
  pastDate1.setDate(pastDate1.getDate() - 5) // 5 days ago

  const pastDate2 = new Date()
  pastDate2.setDate(pastDate2.getDate() - 10) // 10 days ago

  // Check if NCRs already exist
  const existingNcr1 = await prisma.nCR.findFirst({
    where: { ncrNumber: 'NCR-ATT-001', projectId: project.id }
  })

  if (!existingNcr1) {
    await prisma.nCR.create({
      data: {
        ncrNumber: 'NCR-ATT-001',
        projectId: project.id,
        description: 'Overdue NCR - Compaction test failed',
        status: 'open',
        category: 'major',
        raisedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        dueDate: pastDate1,
        raisedById: user.id,
        ncrLots: {
          create: { lotId: lot.id }
        }
      }
    })
    console.log('Created overdue NCR: NCR-ATT-001 (5 days overdue)')
  }

  const existingNcr2 = await prisma.nCR.findFirst({
    where: { ncrNumber: 'NCR-ATT-002', projectId: project.id }
  })

  if (!existingNcr2) {
    await prisma.nCR.create({
      data: {
        ncrNumber: 'NCR-ATT-002',
        projectId: project.id,
        description: 'Overdue NCR - Material specification non-conformance',
        status: 'investigating',
        category: 'minor',
        raisedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        dueDate: pastDate2,
        raisedById: user.id,
        ncrLots: {
          create: { lotId: lot.id }
        }
      }
    })
    console.log('Created overdue NCR: NCR-ATT-002 (10 days overdue)')
  }

  // Create an ITP template and checklist item first (hold points require these)
  let itpTemplate = await prisma.iTPTemplate.findFirst({
    where: { name: 'Attention Test Template', projectId: project.id }
  })

  if (!itpTemplate) {
    itpTemplate = await prisma.iTPTemplate.create({
      data: {
        name: 'Attention Test Template',
        projectId: project.id,
        activityType: 'Earthworks',
        version: 1,
        status: 'active'
      }
    })
    console.log('Created ITP template:', itpTemplate.name)
  }

  let itpChecklistItem = await prisma.iTPChecklistItem.findFirst({
    where: { templateId: itpTemplate.id }
  })

  if (!itpChecklistItem) {
    itpChecklistItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId: itpTemplate.id,
        sequenceNumber: 1,
        description: 'Test checklist item for hold points',
        pointType: 'hold',
        responsibleParty: 'contractor'
      }
    })
    console.log('Created ITP checklist item')
  }

  // Create stale hold points (created more than 7 days ago, still open)
  const staleDate1 = new Date()
  staleDate1.setDate(staleDate1.getDate() - 10) // 10 days ago

  const staleDate2 = new Date()
  staleDate2.setDate(staleDate2.getDate() - 14) // 14 days ago

  const existingHp1 = await prisma.holdPoint.findFirst({
    where: { description: 'Stale HP - Concrete pour inspection', lotId: lot.id }
  })

  if (!existingHp1) {
    await prisma.holdPoint.create({
      data: {
        lotId: lot.id,
        itpChecklistItemId: itpChecklistItem.id,
        pointType: 'hold',
        description: 'Stale HP - Concrete pour inspection',
        status: 'pending',
        createdAt: staleDate1
      }
    })
    console.log('Created stale hold point: Concrete pour inspection (10 days waiting)')
  }

  const existingHp2 = await prisma.holdPoint.findFirst({
    where: { description: 'Stale HP - Subgrade approval', lotId: lot.id }
  })

  if (!existingHp2) {
    // Create another checklist item for the second hold point
    const itpChecklistItem2 = await prisma.iTPChecklistItem.create({
      data: {
        templateId: itpTemplate.id,
        sequenceNumber: 2,
        description: 'Subgrade approval checklist item',
        pointType: 'hold',
        responsibleParty: 'client'
      }
    })

    await prisma.holdPoint.create({
      data: {
        lotId: lot.id,
        itpChecklistItemId: itpChecklistItem2.id,
        pointType: 'hold',
        description: 'Stale HP - Subgrade approval',
        status: 'scheduled',
        createdAt: staleDate2,
        scheduledDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // scheduled 7 days ago
      }
    })
    console.log('Created stale hold point: Subgrade approval (14 days waiting)')
  }

  console.log('\n=== Test data setup complete ===')
  console.log('Login credentials: attention-test@test.com / password123')
  console.log('Project: Attention Test Project (ATT-001)')
  console.log('Overdue NCRs: 2')
  console.log('Stale Hold Points: 2')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
