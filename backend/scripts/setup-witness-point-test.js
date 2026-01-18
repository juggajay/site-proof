import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  console.log('Setting up witness point test data...')

  // Get or create test user
  const user = await prisma.user.upsert({
    where: { email: 'witness-test@test.com' },
    update: {
      passwordHash: hashPassword('password123'),
    },
    create: {
      email: 'witness-test@test.com',
      passwordHash: hashPassword('password123'),
      fullName: 'Witness Test User',
      roleInCompany: 'site_engineer',
    },
  })
  console.log('Test user:', user.email)

  // Find or create the company
  let company = await prisma.company.findFirst()
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Test Company',
      }
    })
  }

  // Update user's company
  await prisma.user.update({
    where: { id: user.id },
    data: { companyId: company.id }
  })

  // Create project
  const project = await prisma.project.upsert({
    where: { companyId_projectNumber: { companyId: company.id, projectNumber: 'WPT-001' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Witness Point Test Project',
      projectNumber: 'WPT-001',
      state: 'QLD',
      specificationSet: 'MRTS',
      status: 'active'
    }
  })
  console.log('Project:', project.name, project.id)

  // Add user to project
  await prisma.projectUser.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    update: {},
    create: {
      projectId: project.id,
      userId: user.id,
      role: 'site_engineer',
      status: 'active'
    }
  })

  // Create ITP template with witness point
  const template = await prisma.iTPTemplate.upsert({
    where: { id: 'witness-test-template' },
    update: {},
    create: {
      id: 'witness-test-template',
      projectId: project.id,
      name: 'Earthworks with Witness Point',
      activityType: 'Earthworks',
      description: 'ITP template with standard, witness and hold points for testing',
      isActive: true,
      checklistItems: {
        create: [
          {
            description: 'Site cleared and prepared',
            sequenceNumber: 1,
            pointType: 'standard',
            responsibleParty: 'contractor',
            evidenceRequired: 'photo',
          },
          {
            description: 'Subgrade level check',
            sequenceNumber: 2,
            pointType: 'witness',
            responsibleParty: 'superintendent',
            evidenceRequired: 'document',
          },
          {
            description: 'Compaction test completed',
            sequenceNumber: 3,
            pointType: 'witness',
            responsibleParty: 'superintendent',
            evidenceRequired: 'test',
          },
          {
            description: 'Material placement approved',
            sequenceNumber: 4,
            pointType: 'hold_point',
            responsibleParty: 'superintendent',
            evidenceRequired: 'document',
          },
          {
            description: 'Final level survey',
            sequenceNumber: 5,
            pointType: 'standard',
            responsibleParty: 'contractor',
            evidenceRequired: 'document',
          },
        ]
      }
    },
    include: {
      checklistItems: true
    }
  })
  console.log('ITP Template:', template.name, 'with', template.checklistItems.length, 'items')

  // Create a lot
  const lot = await prisma.lot.upsert({
    where: { id: 'witness-test-lot' },
    update: {},
    create: {
      id: 'witness-test-lot',
      projectId: project.id,
      lotNumber: 'WPT-LOT-001',
      lotType: 'earthworks',
      activityType: 'Earthworks',
      description: 'Test lot for witness point feature',
      chainageStart: 0,
      chainageEnd: 100,
      status: 'in_progress',
      itpTemplateId: template.id,
      createdById: user.id,
    }
  })
  console.log('Lot:', lot.lotNumber)

  // Create ITP instance for the lot with snapshot
  const templateSnapshot = {
    id: template.id,
    name: template.name,
    description: template.description,
    activityType: template.activityType,
    checklistItems: template.checklistItems.map(item => ({
      id: item.id,
      description: item.description,
      sequenceNumber: item.sequenceNumber,
      pointType: item.pointType,
      responsibleParty: item.responsibleParty,
      evidenceRequired: item.evidenceRequired,
      acceptanceCriteria: item.acceptanceCriteria,
      testType: item.testType
    }))
  }

  const instance = await prisma.iTPInstance.upsert({
    where: { lotId: lot.id },
    update: {
      templateSnapshot: JSON.stringify(templateSnapshot)
    },
    create: {
      lotId: lot.id,
      templateId: template.id,
      templateSnapshot: JSON.stringify(templateSnapshot)
    }
  })
  console.log('ITP Instance created:', instance.id)

  console.log('\n=== Test Setup Complete ===')
  console.log('Login:', 'witness-test@test.com / password123')
  console.log('Project ID:', project.id)
  console.log('Lot:', lot.lotNumber, '(ID:', lot.id, ')')
  console.log('Lot URL: /projects/' + project.id + '/lots/' + lot.id)
  console.log('\nThe ITP has:')
  console.log('  - 2 standard points (S)')
  console.log('  - 2 witness points (W) - items #2 and #3')
  console.log('  - 1 hold point (H)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
