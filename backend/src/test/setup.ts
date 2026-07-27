import { beforeAll, afterAll, beforeEach } from 'vitest';
import dotenv from 'dotenv';
import { assertSafeTestDatabaseUrl } from './databaseSafety.js';
import { WORKER_DATABASES_OFF, workerDatabaseUrl } from './workerDatabase.js';

dotenv.config();

// Point this worker at its own clone of the test database BEFORE the Prisma
// singleton is constructed (it reads DATABASE_URL at module load). See
// `workerDatabase.ts` — sharing one database between parallel workers produced
// spurious 409 DECISION_CONFLICTs from PostgreSQL predicate-lock escalation.
// `vitest.globalSetup.ts` provisions the clones and sets
// SITEPROOF_TEST_WORKER_DATABASES=off if it could not (or was told not to), in
// which case every worker stays on the shared database.
if (
  process.env.DATABASE_URL &&
  process.env.SITEPROOF_TEST_WORKER_DATABASES !== WORKER_DATABASES_OFF
) {
  process.env.DATABASE_URL = workerDatabaseUrl(
    process.env.DATABASE_URL,
    process.env.VITEST_POOL_ID,
  );
}

assertSafeTestDatabaseUrl();

const { prisma } = await import('../lib/prisma.js');

beforeAll(async () => {
  // Ensure test database is clean
  console.log('Setting up test environment...');
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Reset database state between tests if needed
});

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
  });
}

export async function createTestCompany(overrides = {}) {
  return prisma.company.create({
    data: {
      name: `Test Company ${Date.now()}`,
      ...overrides,
    },
  });
}

export async function createTestProject(companyId: string, overrides = {}) {
  return prisma.project.create({
    data: {
      name: `Test Project ${Date.now()}`,
      projectNumber: `TP-${Date.now()}`,
      companyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
      ...overrides,
    },
  });
}

export async function createTestLot(projectId: string, overrides = {}) {
  return prisma.lot.create({
    data: {
      projectId,
      lotNumber: `LOT-${Date.now()}`,
      lotType: 'roadworks',
      description: 'Test Lot',
      status: 'not_started',
      activityType: 'Earthworks',
      ...overrides,
    },
  });
}

export async function cleanupTestData(userId?: string, projectId?: string, companyId?: string) {
  if (projectId) {
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  }
  if (userId) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
  if (companyId) {
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  }
}
