import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Hash password function (same as in auth.ts)
const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-change-in-production'
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  console.log('Setting up URL security test data...')

  // Create Company A (different from main company)
  const companyA = await prisma.company.upsert({
    where: { id: 'company-a-id' },
    update: {},
    create: {
      id: 'company-a-id',
      name: 'Company A Construction',
      abn: '22222222222',
    },
  })
  console.log('Created Company A:', companyA.name)

  // Create Company B
  const companyB = await prisma.company.upsert({
    where: { id: 'company-b-id' },
    update: {},
    create: {
      id: 'company-b-id',
      name: 'Company B Construction',
      abn: '33333333333',
    },
  })
  console.log('Created Company B:', companyB.name)

  const passwordHash = hashPassword('password123')

  // Create User A in Company A
  const userA = await prisma.user.upsert({
    where: { email: 'usera@companya.com' },
    update: { companyId: companyA.id },
    create: {
      id: 'user-a-id',
      email: 'usera@companya.com',
      passwordHash,
      fullName: 'User A',
      companyId: companyA.id,
      roleInCompany: 'admin',
    },
  })
  console.log('Created User A:', userA.email)

  // Create User B in Company B
  const userB = await prisma.user.upsert({
    where: { email: 'userb@companyb.com' },
    update: { companyId: companyB.id },
    create: {
      id: 'user-b-id',
      email: 'userb@companyb.com',
      passwordHash,
      fullName: 'User B',
      companyId: companyB.id,
      roleInCompany: 'admin',
    },
  })
  console.log('Created User B:', userB.email)

  // Create Project A for Company A
  const projectA = await prisma.project.upsert({
    where: { id: 'project-a-id' },
    update: {},
    create: {
      id: 'project-a-id',
      companyId: companyA.id,
      projectNumber: 'PRJ-A-001',
      name: 'Company A Project',
      status: 'active',
      state: 'QLD',
      specificationSet: 'AUS-SPEC',
    },
  })
  console.log('Created Project A:', projectA.name)

  // Create Project B for Company B
  const projectB = await prisma.project.upsert({
    where: { id: 'project-b-id' },
    update: {},
    create: {
      id: 'project-b-id',
      companyId: companyB.id,
      projectNumber: 'PRJ-B-001',
      name: 'Company B Project',
      status: 'active',
      state: 'VIC',
      specificationSet: 'AUS-SPEC',
    },
  })
  console.log('Created Project B:', projectB.name)

  // Add User A to Project A
  await prisma.projectUser.upsert({
    where: {
      projectId_userId: {
        projectId: projectA.id,
        userId: userA.id,
      },
    },
    update: { status: 'active' },
    create: {
      projectId: projectA.id,
      userId: userA.id,
      role: 'admin',
      status: 'active',
    },
  })
  console.log('Added User A to Project A')

  // Add User B to Project B
  await prisma.projectUser.upsert({
    where: {
      projectId_userId: {
        projectId: projectB.id,
        userId: userB.id,
      },
    },
    update: { status: 'active' },
    create: {
      projectId: projectB.id,
      userId: userB.id,
      role: 'admin',
      status: 'active',
    },
  })
  console.log('Added User B to Project B')

  // Create a Lot in Project A (this is User A's lot)
  const lotA = await prisma.lot.upsert({
    where: { id: 'lot-secure-test-a' },
    update: {},
    create: {
      id: 'lot-secure-test-a',
      projectId: projectA.id,
      lotNumber: 'LOT-SECURE-A-001',
      lotType: 'chainage',
      description: 'This lot belongs to Company A - User B should NOT be able to access it',
      status: 'in_progress',
      activityType: 'earthworks',
    },
  })
  console.log('Created Lot A (should be inaccessible to User B):', lotA.lotNumber, '- ID:', lotA.id)

  // Create a Lot in Project B (this is User B's lot)
  const lotB = await prisma.lot.upsert({
    where: { id: 'lot-secure-test-b' },
    update: {},
    create: {
      id: 'lot-secure-test-b',
      projectId: projectB.id,
      lotNumber: 'LOT-SECURE-B-001',
      lotType: 'chainage',
      description: 'This lot belongs to Company B - User A should NOT be able to access it',
      status: 'pending',
      activityType: 'concreting',
    },
  })
  console.log('Created Lot B (should be inaccessible to User A):', lotB.lotNumber, '- ID:', lotB.id)

  console.log('\n=== URL SECURITY TEST SETUP COMPLETE ===')
  console.log('User A: usera@companya.com (password: password123)')
  console.log('User B: userb@companyb.com (password: password123)')
  console.log('')
  console.log('Lot A ID (owned by User A):', lotA.id)
  console.log('Lot B ID (owned by User B):', lotB.id)
  console.log('')
  console.log('Test scenario:')
  console.log('1. Login as User A, navigate to /lots/lot-secure-test-a - should WORK')
  console.log('2. Login as User B, navigate to /lots/lot-secure-test-a - should FAIL (403)')
  console.log('3. Login as User B, navigate to /lots/lot-secure-test-b - should WORK')
  console.log('4. Login as User A, navigate to /lots/lot-secure-test-b - should FAIL (403)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
