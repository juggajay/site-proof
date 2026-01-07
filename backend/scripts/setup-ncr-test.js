// Setup test data for NCR QM approval testing
// Run with: node scripts/setup-ncr-test.js

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  console.log('Setting up NCR test data...')

  // Create or find company
  let company = await prisma.company.findFirst({
    where: { name: 'NCR Test Company' }
  })

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'NCR Test Company',
        abn: '12345678901'
      }
    })
    console.log('Created company:', company.name)
  } else {
    console.log('Found existing company:', company.name)
  }

  // Create users
  const passwordHash = hashPassword('password123')

  // Site Engineer (cannot approve major NCRs)
  let siteEngineer = await prisma.user.findUnique({
    where: { email: 'engineer@test.com' }
  })
  if (!siteEngineer) {
    siteEngineer = await prisma.user.create({
      data: {
        email: 'engineer@test.com',
        passwordHash,
        fullName: 'Site Engineer',
        companyId: company.id,
        roleInCompany: 'member'
      }
    })
    console.log('Created site engineer:', siteEngineer.email)
  } else {
    console.log('Found existing site engineer:', siteEngineer.email)
  }

  // Quality Manager (can approve major NCRs)
  let qualityManager = await prisma.user.findUnique({
    where: { email: 'qm@test.com' }
  })
  if (!qualityManager) {
    qualityManager = await prisma.user.create({
      data: {
        email: 'qm@test.com',
        passwordHash,
        fullName: 'Quality Manager',
        companyId: company.id,
        roleInCompany: 'member'
      }
    })
    console.log('Created quality manager:', qualityManager.email)
  } else {
    console.log('Found existing quality manager:', qualityManager.email)
  }

  // Create or find project
  let project = await prisma.project.findFirst({
    where: {
      companyId: company.id,
      name: 'NCR Test Project'
    }
  })

  if (!project) {
    project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: 'NCR Test Project',
        projectNumber: 'NCR-TEST-001',
        state: 'QLD',
        specificationSet: 'TMR'
      }
    })
    console.log('Created project:', project.name)
  } else {
    console.log('Found existing project:', project.name)
  }

  // Add site engineer to project with site_engineer role
  const existingEngineerRole = await prisma.projectUser.findUnique({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: siteEngineer.id
      }
    }
  })

  if (!existingEngineerRole) {
    await prisma.projectUser.create({
      data: {
        projectId: project.id,
        userId: siteEngineer.id,
        role: 'site_engineer',
        status: 'active',
        acceptedAt: new Date()
      }
    })
    console.log('Added site engineer to project with role: site_engineer')
  } else {
    console.log('Site engineer already in project with role:', existingEngineerRole.role)
  }

  // Add quality manager to project with quality_manager role
  const existingQMRole = await prisma.projectUser.findUnique({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: qualityManager.id
      }
    }
  })

  if (!existingQMRole) {
    await prisma.projectUser.create({
      data: {
        projectId: project.id,
        userId: qualityManager.id,
        role: 'quality_manager',
        status: 'active',
        acceptedAt: new Date()
      }
    })
    console.log('Added quality manager to project with role: quality_manager')
  } else {
    console.log('Quality manager already in project with role:', existingQMRole.role)
  }

  console.log('')
  console.log('========================================')
  console.log('NCR Test Data Setup Complete!')
  console.log('========================================')
  console.log('')
  console.log('Test Users:')
  console.log('  Site Engineer: engineer@test.com / password123')
  console.log('    - Role: site_engineer (CANNOT approve major NCRs)')
  console.log('')
  console.log('  Quality Manager: qm@test.com / password123')
  console.log('    - Role: quality_manager (CAN approve major NCRs)')
  console.log('')
  console.log('Project ID:', project.id)
  console.log('Project Name:', project.name)
  console.log('')
  console.log('Test Steps:')
  console.log('  1. Login as engineer@test.com')
  console.log('  2. Navigate to Projects, select NCR Test Project')
  console.log('  3. Go to NCRs page')
  console.log('  4. Create a MAJOR NCR')
  console.log('  5. Submit rectification')
  console.log('  6. Try to close - should be blocked (requires QM approval)')
  console.log('  7. Logout and login as qm@test.com')
  console.log('  8. Approve the NCR (QM Approve button)')
  console.log('  9. Now the Close button should work')
  console.log('========================================')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
