import { beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '../lib/prisma.js'

beforeAll(async () => {
  // Ensure test database is clean
  console.log('Setting up test environment...')
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  // Reset database state between tests if needed
})

// Test utilities
export async function createTestUser(overrides = {}) {
  return prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      passwordHash: '$2a$12$test',
      fullName: 'Test User',
      roleInCompany: 'admin',
      emailVerified: true,
      ...overrides,
    },
  })
}

export async function createTestCompany(overrides = {}) {
  return prisma.company.create({
    data: {
      name: `Test Company ${Date.now()}`,
      ...overrides,
    },
  })
}

export async function createTestProject(companyId: string, overrides = {}) {
  return prisma.project.create({
    data: {
      name: `Test Project ${Date.now()}`,
      projectNumber: `TP-${Date.now()}`,
      companyId,
      status: 'active',
      ...overrides,
    },
  })
}

export async function createTestLot(projectId: string, overrides = {}) {
  return prisma.lot.create({
    data: {
      projectId,
      lotNumber: `LOT-${Date.now()}`,
      description: 'Test Lot',
      status: 'not_started',
      activityType: 'Earthworks',
      ...overrides,
    },
  })
}

export async function cleanupTestData(userId?: string, projectId?: string, companyId?: string) {
  if (projectId) {
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
  }
  if (userId) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }
  if (companyId) {
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  }
}
