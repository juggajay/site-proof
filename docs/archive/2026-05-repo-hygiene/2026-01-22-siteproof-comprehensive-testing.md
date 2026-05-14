# SiteProof Comprehensive Testing Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete end-to-end testing of all SiteProof features, API endpoints, user roles, and workflows to ensure production readiness.

**Architecture:** Full-stack testing using Playwright for E2E UI tests, backend API tests with supertest/vitest, and integration tests covering all user role permissions and business workflows.

**Tech Stack:** Playwright (E2E), Vitest (unit/integration), supertest (API), PostgreSQL test database, TypeScript

---

## Phase 1: Test Infrastructure Setup

### Task 1.1: Create Test Configuration Files

**Files:**
- Create: `backend/vitest.config.ts`
- Create: `backend/src/test/setup.ts`
- Create: `frontend/playwright.config.ts`

**Step 1: Write backend vitest config**

```typescript
// backend/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/routes/**/*.ts', 'src/lib/**/*.ts'],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
```

**Step 2: Write test setup file**

```typescript
// backend/src/test/setup.ts
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

export async function cleanupTestData(userId?: string, projectId?: string) {
  if (projectId) {
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
  }
  if (userId) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }
}
```

**Step 3: Write Playwright config**

```typescript
// frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
  },
})
```

**Step 4: Install test dependencies**

Run: `cd backend && npm install -D vitest @vitest/coverage-v8 supertest @types/supertest`

**Step 5: Install Playwright**

Run: `cd frontend && npm install -D @playwright/test && npx playwright install`

**Step 6: Commit**

```bash
git add backend/vitest.config.ts backend/src/test/setup.ts frontend/playwright.config.ts
git commit -m "chore: add test infrastructure configuration"
```

---

## Phase 2: Authentication API Tests

### Task 2.1: Registration Tests

**Files:**
- Create: `backend/src/routes/auth.test.ts`

**Step 1: Write registration test suite**

```typescript
// backend/src/routes/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)

describe('POST /api/auth/register', () => {
  const testEmail = `test-reg-${Date.now()}@example.com`

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } })
  })

  it('should register a new user with valid data', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Test User',
        tosAccepted: true,
      })

    expect(res.status).toBe(201)
    expect(res.body.user).toBeDefined()
    expect(res.body.user.email).toBe(testEmail)
    expect(res.body.token).toBeDefined()
    expect(res.body.verificationRequired).toBe(true)
  })

  it('should reject registration without email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        password: 'SecureP@ssword123!',
        tosAccepted: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('required')
  })

  it('should reject weak passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `weak-${Date.now()}@example.com`,
        password: 'weak',
        tosAccepted: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.errors).toBeDefined()
    expect(res.body.errors.length).toBeGreaterThan(0)
  })

  it('should reject registration without ToS acceptance', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `no-tos-${Date.now()}@example.com`,
        password: 'SecureP@ssword123!',
        tosAccepted: false,
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Terms of Service')
  })

  it('should reject duplicate email registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Duplicate User',
        tosAccepted: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('already in use')
  })
})
```

**Step 2: Run test to verify it works**

Run: `cd backend && npx vitest run src/routes/auth.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/src/routes/auth.test.ts
git commit -m "test: add registration API tests"
```

### Task 2.2: Login Tests

**Files:**
- Modify: `backend/src/routes/auth.test.ts`

**Step 1: Add login test suite**

```typescript
// Add to backend/src/routes/auth.test.ts

describe('POST /api/auth/login', () => {
  const loginEmail = `test-login-${Date.now()}@example.com`
  const loginPassword = 'SecureP@ssword123!'

  beforeAll(async () => {
    // Create test user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: loginEmail,
        password: loginPassword,
        fullName: 'Login Test User',
        tosAccepted: true,
      })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: loginEmail } })
  })

  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: loginEmail,
        password: loginPassword,
      })

    expect(res.status).toBe(200)
    expect(res.body.user).toBeDefined()
    expect(res.body.token).toBeDefined()
  })

  it('should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: loginPassword,
      })

    expect(res.status).toBe(401)
    expect(res.body.message).toContain('Invalid')
  })

  it('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: loginEmail,
        password: 'WrongPassword123!',
      })

    expect(res.status).toBe(401)
    expect(res.body.message).toContain('Invalid')
  })

  it('should reject login without email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        password: loginPassword,
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('required')
  })
})
```

**Step 2: Run tests**

Run: `cd backend && npx vitest run src/routes/auth.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/src/routes/auth.test.ts
git commit -m "test: add login API tests"
```

### Task 2.3: Password Reset Tests

**Files:**
- Modify: `backend/src/routes/auth.test.ts`

**Step 1: Add password reset test suite**

```typescript
// Add to backend/src/routes/auth.test.ts

describe('Password Reset Flow', () => {
  const resetEmail = `test-reset-${Date.now()}@example.com`

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        email: resetEmail,
        password: 'OldPassword123!',
        fullName: 'Reset Test User',
        tosAccepted: true,
      })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: resetEmail } })
  })

  it('should send reset email for existing user (always returns success)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: resetEmail })

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('If an account exists')
  })

  it('should not reveal if email exists', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('If an account exists')
  })

  it('should reject reset with invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'invalid-token',
        password: 'NewPassword123!',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Invalid')
  })
})
```

**Step 2: Run tests**

Run: `cd backend && npx vitest run src/routes/auth.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/src/routes/auth.test.ts
git commit -m "test: add password reset API tests"
```

### Task 2.4: Magic Link Tests

**Files:**
- Modify: `backend/src/routes/auth.test.ts`

**Step 1: Add magic link test suite**

```typescript
// Add to backend/src/routes/auth.test.ts

describe('Magic Link Authentication', () => {
  const magicEmail = `test-magic-${Date.now()}@example.com`

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        email: magicEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Magic Link User',
        tosAccepted: true,
      })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: magicEmail } })
    await prisma.passwordResetToken.deleteMany({
      where: { token: { startsWith: 'magic_' } }
    })
  })

  it('should request magic link for existing user', async () => {
    const res = await request(app)
      .post('/api/auth/magic-link/request')
      .send({ email: magicEmail })

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('If an account exists')
  })

  it('should not reveal non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/magic-link/request')
      .send({ email: 'nonexistent@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('If an account exists')
  })

  it('should reject invalid magic link token format', async () => {
    const res = await request(app)
      .post('/api/auth/magic-link/verify')
      .send({ token: 'invalid-format' })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Invalid token format')
  })

  it('should reject non-existent magic link token', async () => {
    const res = await request(app)
      .post('/api/auth/magic-link/verify')
      .send({ token: 'magic_nonexistent123' })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Invalid or expired')
  })
})
```

**Step 2: Run tests**

Run: `cd backend && npx vitest run src/routes/auth.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/src/routes/auth.test.ts
git commit -m "test: add magic link authentication tests"
```

---

## Phase 3: Lots API Tests

### Task 3.1: Lot CRUD Tests

**Files:**
- Create: `backend/src/routes/lots.test.ts`

**Step 1: Write lot CRUD test suite**

```typescript
// backend/src/routes/lots.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { lotsRouter } from './lots.js'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/lots', lotsRouter)

describe('Lots API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let lotId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create test user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `lots-test-${Date.now()}@example.com`,
        password: 'SecureP@ssword123!',
        fullName: 'Lots Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    // Update user with company and role
    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        projectNumber: `TP-${Date.now()}`,
        companyId,
        status: 'active',
      }
    })
    projectId = project.id

    // Add user to project
    await prisma.projectUser.create({
      data: {
        projectId,
        userId,
        role: 'admin',
        status: 'active',
      }
    })
  })

  afterAll(async () => {
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('POST /api/lots', () => {
    it('should create a new lot', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-001',
          description: 'Test lot description',
          activityType: 'Earthworks',
        })

      expect(res.status).toBe(201)
      expect(res.body.lot).toBeDefined()
      expect(res.body.lot.lotNumber).toBe('LOT-001')
      lotId = res.body.lot.id
    })

    it('should reject lot without projectId', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lotNumber: 'LOT-002',
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('required')
    })

    it('should reject duplicate lot number in same project', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-001', // Already exists
        })

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('DUPLICATE_LOT_NUMBER')
    })

    it('should require area zone for area lot type', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-AREA-001',
          lotType: 'area',
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('AREA_ZONE_REQUIRED')
    })
  })

  describe('GET /api/lots', () => {
    it('should list lots for a project', async () => {
      const res = await request(app)
        .get(`/api/lots?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.lots).toBeDefined()
      expect(Array.isArray(res.body.lots)).toBe(true)
      expect(res.body.lots.length).toBeGreaterThan(0)
    })

    it('should require projectId query param', async () => {
      const res = await request(app)
        .get('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('required')
    })
  })

  describe('GET /api/lots/:id', () => {
    it('should get a single lot', async () => {
      const res = await request(app)
        .get(`/api/lots/${lotId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.lot).toBeDefined()
      expect(res.body.lot.lotNumber).toBe('LOT-001')
    })

    it('should return 404 for non-existent lot', async () => {
      const res = await request(app)
        .get('/api/lots/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/lots/:id', () => {
    it('should update a lot', async () => {
      const res = await request(app)
        .patch(`/api/lots/${lotId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated description',
          status: 'in_progress',
        })

      expect(res.status).toBe(200)
      expect(res.body.lot.description).toBe('Updated description')
      expect(res.body.lot.status).toBe('in_progress')
    })

    it('should detect concurrent edits', async () => {
      // First get the lot to get updatedAt
      const getRes = await request(app)
        .get(`/api/lots/${lotId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // Use an old timestamp
      const res = await request(app)
        .patch(`/api/lots/${lotId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Concurrent update',
          expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
        })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('Conflict')
    })
  })

  describe('DELETE /api/lots/:id', () => {
    let deletableLotId: string

    beforeAll(async () => {
      const createRes = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-DELETE-001',
          description: 'Lot to delete',
        })
      deletableLotId = createRes.body.lot.id
    })

    it('should delete a lot', async () => {
      const res = await request(app)
        .delete(`/api/lots/${deletableLotId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('deleted')
    })

    it('should return 404 for non-existent lot', async () => {
      const res = await request(app)
        .delete('/api/lots/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })
})
```

**Step 2: Run tests**

Run: `cd backend && npx vitest run src/routes/lots.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/src/routes/lots.test.ts
git commit -m "test: add lot CRUD API tests"
```

### Task 3.2: Lot Status Workflow Tests

**Files:**
- Modify: `backend/src/routes/lots.test.ts`

**Step 1: Add lot status workflow tests**

```typescript
// Add to backend/src/routes/lots.test.ts

describe('Lot Status Workflows', () => {
  let workflowLotId: string

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/lots')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        lotNumber: `LOT-WORKFLOW-${Date.now()}`,
        description: 'Workflow test lot',
      })
    workflowLotId = res.body.lot.id
  })

  it('should transition from not_started to in_progress', async () => {
    const res = await request(app)
      .patch(`/api/lots/${workflowLotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'in_progress' })

    expect(res.status).toBe(200)
    expect(res.body.lot.status).toBe('in_progress')
  })

  it('should transition to awaiting_test', async () => {
    const res = await request(app)
      .patch(`/api/lots/${workflowLotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'awaiting_test' })

    expect(res.status).toBe(200)
    expect(res.body.lot.status).toBe('awaiting_test')
  })

  it('should transition to completed', async () => {
    const res = await request(app)
      .patch(`/api/lots/${workflowLotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'completed' })

    expect(res.status).toBe(200)
    expect(res.body.lot.status).toBe('completed')
  })

  it('should conform lot with proper role', async () => {
    const res = await request(app)
      .post(`/api/lots/${workflowLotId}/conform`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ force: true }) // Skip prerequisites for test

    expect(res.status).toBe(200)
    expect(res.body.lot.status).toBe('conformed')
  })

  it('should not allow editing conformed lot', async () => {
    const res = await request(app)
      .patch(`/api/lots/${workflowLotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ description: 'Try to edit conformed' })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('conformed')
  })

  it('should not allow deleting conformed lot', async () => {
    const res = await request(app)
      .delete(`/api/lots/${workflowLotId}`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('LOT_CONFORMED')
  })
})
```

**Step 2: Run tests**

Run: `cd backend && npx vitest run src/routes/lots.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/src/routes/lots.test.ts
git commit -m "test: add lot status workflow tests"
```

### Task 3.3: Lot Bulk Operations Tests

**Files:**
- Modify: `backend/src/routes/lots.test.ts`

**Step 1: Add bulk operations tests**

```typescript
// Add to backend/src/routes/lots.test.ts

describe('Lot Bulk Operations', () => {
  let bulkLotIds: string[] = []

  beforeAll(async () => {
    // Create multiple lots for bulk testing
    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: `BULK-LOT-${Date.now()}-${i}`,
          description: `Bulk test lot ${i}`,
        })
      bulkLotIds.push(res.body.lot.id)
    }
  })

  it('should bulk create lots', async () => {
    const res = await request(app)
      .post('/api/lots/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        lots: [
          { lotNumber: `BULK-NEW-${Date.now()}-1`, description: 'New bulk 1' },
          { lotNumber: `BULK-NEW-${Date.now()}-2`, description: 'New bulk 2' },
        ],
      })

    expect(res.status).toBe(201)
    expect(res.body.lots.length).toBe(2)
    expect(res.body.count).toBe(2)

    // Clean up
    for (const lot of res.body.lots) {
      await prisma.lot.delete({ where: { id: lot.id } }).catch(() => {})
    }
  })

  it('should bulk update status', async () => {
    const res = await request(app)
      .post('/api/lots/bulk-update-status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        lotIds: bulkLotIds,
        status: 'in_progress',
      })

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(3)
  })

  it('should reject invalid bulk status', async () => {
    const res = await request(app)
      .post('/api/lots/bulk-update-status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        lotIds: bulkLotIds,
        status: 'invalid_status',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('must be one of')
  })

  it('should bulk delete lots', async () => {
    // Create deletable lots
    const deleteLotIds: string[] = []
    for (let i = 1; i <= 2; i++) {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: `DELETE-${Date.now()}-${i}`,
        })
      deleteLotIds.push(res.body.lot.id)
    }

    const res = await request(app)
      .post('/api/lots/bulk-delete')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ lotIds: deleteLotIds })

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(2)
  })
})
```

**Step 2: Run tests**

Run: `cd backend && npx vitest run src/routes/lots.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/src/routes/lots.test.ts
git commit -m "test: add lot bulk operations tests"
```

---

## Phase 4: NCR API Tests

### Task 4.1: NCR CRUD Tests

**Files:**
- Create: `backend/src/routes/ncrs.test.ts`

**Step 1: Write NCR CRUD test suite**

```typescript
// backend/src/routes/ncrs.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { ncrsRouter } from './ncrs.js'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/ncrs', ncrsRouter)

describe('NCR API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let lotId: string
  let ncrId: string

  beforeAll(async () => {
    // Setup test data (company, user, project, lot)
    const company = await prisma.company.create({
      data: { name: `NCR Test Company ${Date.now()}` }
    })
    companyId = company.id

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `ncr-test-${Date.now()}@example.com`,
        password: 'SecureP@ssword123!',
        fullName: 'NCR Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    const project = await prisma.project.create({
      data: {
        name: `NCR Test Project ${Date.now()}`,
        projectNumber: `NTP-${Date.now()}`,
        companyId,
        status: 'active',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: {
        projectId,
        userId,
        role: 'quality_manager',
        status: 'active',
      }
    })

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `NCR-LOT-${Date.now()}`,
        status: 'in_progress',
      }
    })
    lotId = lot.id
  })

  afterAll(async () => {
    await prisma.nCR.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('POST /api/ncrs', () => {
    it('should create a minor NCR', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Test non-conformance',
          category: 'Workmanship',
          severity: 'minor',
          lotIds: [lotId],
        })

      expect(res.status).toBe(201)
      expect(res.body.ncr).toBeDefined()
      expect(res.body.ncr.ncrNumber).toMatch(/^NCR-\d{4}$/)
      expect(res.body.ncr.severity).toBe('minor')
      ncrId = res.body.ncr.id
    })

    it('should create a major NCR with QM approval required', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Major defect found',
          category: 'Material',
          severity: 'major',
          lotIds: [lotId],
        })

      expect(res.status).toBe(201)
      expect(res.body.ncr.severity).toBe('major')
      // Major NCRs require QM approval (checked in NCR model)
    })

    it('should reject NCR without required fields', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          // Missing description and category
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('required')
    })
  })

  describe('GET /api/ncrs', () => {
    it('should list NCRs for accessible projects', async () => {
      const res = await request(app)
        .get('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.ncrs).toBeDefined()
      expect(Array.isArray(res.body.ncrs)).toBe(true)
    })

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/ncrs?status=open')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      for (const ncr of res.body.ncrs) {
        expect(ncr.status).toBe('open')
      }
    })

    it('should filter by severity', async () => {
      const res = await request(app)
        .get('/api/ncrs?severity=minor')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      for (const ncr of res.body.ncrs) {
        expect(ncr.severity).toBe('minor')
      }
    })
  })

  describe('GET /api/ncrs/:id', () => {
    it('should get a single NCR', async () => {
      const res = await request(app)
        .get(`/api/ncrs/${ncrId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.ncr).toBeDefined()
      expect(res.body.ncr.id).toBe(ncrId)
    })

    it('should return 404 for non-existent NCR', async () => {
      const res = await request(app)
        .get('/api/ncrs/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })
})
```

**Step 2: Run tests**

Run: `cd backend && npx vitest run src/routes/ncrs.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/src/routes/ncrs.test.ts
git commit -m "test: add NCR CRUD API tests"
```

### Task 4.2: NCR Workflow Tests

**Files:**
- Modify: `backend/src/routes/ncrs.test.ts`

**Step 1: Add NCR workflow tests**

```typescript
// Add to backend/src/routes/ncrs.test.ts

describe('NCR Workflow', () => {
  let workflowNcrId: string

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Workflow test NCR',
        category: 'Workmanship',
        severity: 'minor',
        responsibleUserId: userId,
      })
    workflowNcrId = res.body.ncr.id
  })

  it('should submit response to NCR', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Incorrect procedure followed',
        proposedCorrectiveAction: 'Retrain workers on correct method',
      })

    expect(res.status).toBe(200)
    expect(res.body.ncr.status).toBe('investigating')
  })

  it('should accept response via QM review', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'accept',
        comments: 'Response is acceptable',
      })

    expect(res.status).toBe(200)
    expect(res.body.ncr.status).toBe('rectification')
  })

  it('should submit rectification', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/rectify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rectificationNotes: 'Work has been rectified',
      })

    expect(res.status).toBe(200)
    expect(res.body.ncr.status).toBe('verification')
  })

  it('should close NCR', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        verificationNotes: 'Verified complete',
        lessonsLearned: 'Document procedure changes',
      })

    expect(res.status).toBe(200)
    expect(res.body.ncr.status).toBe('closed')
  })

  it('should reopen closed NCR', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/reopen`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        reason: 'Issue recurred',
      })

    expect(res.status).toBe(200)
    expect(res.body.ncr.status).toBe('rectification')
  })
})

describe('NCR QM Review - Request Revision', () => {
  let revisionNcrId: string

  beforeAll(async () => {
    const createRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Revision test NCR',
        category: 'Workmanship',
        severity: 'minor',
      })
    revisionNcrId = createRes.body.ncr.id

    // Submit response
    await request(app)
      .post(`/api/ncrs/${revisionNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Test',
        proposedCorrectiveAction: 'Test',
      })
  })

  it('should request revision of response', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${revisionNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'request_revision',
        comments: 'Root cause analysis is insufficient',
      })

    expect(res.status).toBe(200)
    expect(res.body.ncr.status).toBe('open')
    expect(res.body.ncr.revisionRequested).toBe(true)
  })
})
```

**Step 2: Run tests**

Run: `cd backend && npx vitest run src/routes/ncrs.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/src/routes/ncrs.test.ts
git commit -m "test: add NCR workflow tests"
```

### Task 4.3: NCR Analytics Tests

**Files:**
- Modify: `backend/src/routes/ncrs.test.ts`

**Step 1: Add NCR analytics tests**

```typescript
// Add to backend/src/routes/ncrs.test.ts

describe('NCR Analytics', () => {
  it('should return analytics summary', async () => {
    const res = await request(app)
      .get(`/api/ncrs/analytics/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    expect(res.body.summary).toBeDefined()
    expect(res.body.summary.total).toBeGreaterThanOrEqual(0)
    expect(res.body.summary.open).toBeDefined()
    expect(res.body.summary.closed).toBeDefined()
    expect(res.body.charts).toBeDefined()
  })

  it('should include chart data', async () => {
    const res = await request(app)
      .get(`/api/ncrs/analytics/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.body.charts.rootCause).toBeDefined()
    expect(res.body.charts.category).toBeDefined()
    expect(res.body.charts.severity).toBeDefined()
    expect(res.body.charts.status).toBeDefined()
  })

  it('should filter by date range', async () => {
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = new Date().toISOString()

    const res = await request(app)
      .get(`/api/ncrs/analytics/${projectId}?startDate=${startDate}&endDate=${endDate}`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    expect(res.body.summary).toBeDefined()
  })

  it('should identify repeat issues', async () => {
    const res = await request(app)
      .get(`/api/ncrs/analytics/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.body.repeatIssues).toBeDefined()
    expect(res.body.repeatOffenders).toBeDefined()
  })
})
```

**Step 2: Run tests**

Run: `cd backend && npx vitest run src/routes/ncrs.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/src/routes/ncrs.test.ts
git commit -m "test: add NCR analytics tests"
```

---

## Phase 5: User Roles & Permissions Tests

### Task 5.1: Role-Based Access Tests

**Files:**
- Create: `backend/src/routes/permissions.test.ts`

**Step 1: Write role-based access tests**

```typescript
// backend/src/routes/permissions.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { lotsRouter } from './lots.js'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/lots', lotsRouter)

describe('Role-Based Access Control', () => {
  let companyId: string
  let projectId: string
  let lotId: string

  // Tokens for different roles
  let ownerToken: string
  let adminToken: string
  let projectManagerToken: string
  let qualityManagerToken: string
  let foremanToken: string
  let viewerToken: string
  let subcontractorToken: string

  beforeAll(async () => {
    // Create company
    const company = await prisma.company.create({
      data: { name: `RBAC Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `RBAC Test Project ${Date.now()}`,
        projectNumber: `RBAC-${Date.now()}`,
        companyId,
        status: 'active',
      }
    })
    projectId = project.id

    // Create lot
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `RBAC-LOT-${Date.now()}`,
        status: 'not_started',
      }
    })
    lotId = lot.id

    // Create users with different roles
    const roles = [
      { role: 'owner', tokenRef: 'ownerToken' },
      { role: 'admin', tokenRef: 'adminToken' },
      { role: 'project_manager', tokenRef: 'projectManagerToken' },
      { role: 'quality_manager', tokenRef: 'qualityManagerToken' },
      { role: 'foreman', tokenRef: 'foremanToken' },
      { role: 'viewer', tokenRef: 'viewerToken' },
    ]

    for (const { role, tokenRef } of roles) {
      const email = `rbac-${role}-${Date.now()}@example.com`
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'SecureP@ssword123!',
          fullName: `${role} User`,
          tosAccepted: true,
        })

      const userId = regRes.body.user.id

      await prisma.user.update({
        where: { id: userId },
        data: { companyId, roleInCompany: role }
      })

      await prisma.projectUser.create({
        data: {
          projectId,
          userId,
          role,
          status: 'active',
        }
      })

      // Store token
      switch (tokenRef) {
        case 'ownerToken': ownerToken = regRes.body.token; break
        case 'adminToken': adminToken = regRes.body.token; break
        case 'projectManagerToken': projectManagerToken = regRes.body.token; break
        case 'qualityManagerToken': qualityManagerToken = regRes.body.token; break
        case 'foremanToken': foremanToken = regRes.body.token; break
        case 'viewerToken': viewerToken = regRes.body.token; break
      }
    }
  })

  afterAll(async () => {
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('Lot Creation Permissions', () => {
    it('owner can create lots', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          projectId,
          lotNumber: `OWNER-LOT-${Date.now()}`,
        })
      expect(res.status).toBe(201)
    })

    it('admin can create lots', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId,
          lotNumber: `ADMIN-LOT-${Date.now()}`,
        })
      expect(res.status).toBe(201)
    })

    it('project manager can create lots', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${projectManagerToken}`)
        .send({
          projectId,
          lotNumber: `PM-LOT-${Date.now()}`,
        })
      expect(res.status).toBe(201)
    })

    it('foreman can create lots', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${foremanToken}`)
        .send({
          projectId,
          lotNumber: `FOREMAN-LOT-${Date.now()}`,
        })
      expect(res.status).toBe(201)
    })

    it('viewer cannot create lots', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          projectId,
          lotNumber: `VIEWER-LOT-${Date.now()}`,
        })
      expect(res.status).toBe(403)
    })
  })

  describe('Lot Deletion Permissions', () => {
    let deletableLotId: string

    beforeAll(async () => {
      const lot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `DELETE-TEST-${Date.now()}`,
          status: 'not_started',
        }
      })
      deletableLotId = lot.id
    })

    it('project manager can delete lots', async () => {
      const newLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `PM-DELETE-${Date.now()}`,
          status: 'not_started',
        }
      })

      const res = await request(app)
        .delete(`/api/lots/${newLot.id}`)
        .set('Authorization', `Bearer ${projectManagerToken}`)

      expect(res.status).toBe(200)
    })

    it('foreman cannot delete lots', async () => {
      const newLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `FOREMAN-DEL-${Date.now()}`,
          status: 'not_started',
        }
      })

      const res = await request(app)
        .delete(`/api/lots/${newLot.id}`)
        .set('Authorization', `Bearer ${foremanToken}`)

      expect(res.status).toBe(403)

      // Clean up
      await prisma.lot.delete({ where: { id: newLot.id } })
    })

    it('viewer cannot delete lots', async () => {
      const res = await request(app)
        .delete(`/api/lots/${deletableLotId}`)
        .set('Authorization', `Bearer ${viewerToken}`)

      expect(res.status).toBe(403)
    })
  })

  describe('Lot Conformance Permissions', () => {
    let conformTestLotId: string

    beforeAll(async () => {
      const lot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `CONFORM-TEST-${Date.now()}`,
          status: 'completed',
        }
      })
      conformTestLotId = lot.id
    })

    it('quality manager can conform lots', async () => {
      const res = await request(app)
        .post(`/api/lots/${conformTestLotId}/conform`)
        .set('Authorization', `Bearer ${qualityManagerToken}`)
        .send({ force: true })

      expect(res.status).toBe(200)
    })

    it('foreman cannot conform lots', async () => {
      const newLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `FOREMAN-CONF-${Date.now()}`,
          status: 'completed',
        }
      })

      const res = await request(app)
        .post(`/api/lots/${newLot.id}/conform`)
        .set('Authorization', `Bearer ${foremanToken}`)
        .send({ force: true })

      expect(res.status).toBe(403)

      await prisma.lot.delete({ where: { id: newLot.id } })
    })

    it('viewer cannot conform lots', async () => {
      const newLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `VIEWER-CONF-${Date.now()}`,
          status: 'completed',
        }
      })

      const res = await request(app)
        .post(`/api/lots/${newLot.id}/conform`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ force: true })

      expect(res.status).toBe(403)

      await prisma.lot.delete({ where: { id: newLot.id } })
    })
  })

  describe('Check Role Endpoint', () => {
    it('should return user role info', async () => {
      const res = await request(app)
        .get(`/api/lots/check-role/${projectId}`)
        .set('Authorization', `Bearer ${qualityManagerToken}`)

      expect(res.status).toBe(200)
      expect(res.body.role).toBe('quality_manager')
      expect(res.body.isQualityManager).toBe(true)
      expect(res.body.canConformLots).toBe(true)
    })
  })
})
```

**Step 2: Run tests**

Run: `cd backend && npx vitest run src/routes/permissions.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/src/routes/permissions.test.ts
git commit -m "test: add role-based access control tests"
```

---

## Phase 6: E2E UI Tests with Playwright

### Task 6.1: Authentication E2E Tests

**Files:**
- Create: `frontend/e2e/auth.spec.ts`

**Step 1: Write authentication E2E tests**

```typescript
// frontend/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByRole('heading', { name: /sign in|log in/i })).toBeVisible()
      await expect(page.getByPlaceholder(/email/i)).toBeVisible()
      await expect(page.getByPlaceholder(/password/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible()
    })

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/login')
      await page.getByRole('button', { name: /sign in|log in/i }).click()
      await expect(page.getByText(/required|enter/i)).toBeVisible()
    })

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login')
      await page.getByPlaceholder(/email/i).fill('invalid@example.com')
      await page.getByPlaceholder(/password/i).fill('wrongpassword')
      await page.getByRole('button', { name: /sign in|log in/i }).click()
      await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 10000 })
    })

    test('should have link to forgot password', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible()
    })

    test('should have link to register', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByRole('link', { name: /sign up|register|create account/i })).toBeVisible()
    })
  })

  test.describe('Registration Page', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register')
      await expect(page.getByRole('heading', { name: /sign up|register|create/i })).toBeVisible()
      await expect(page.getByPlaceholder(/email/i)).toBeVisible()
      await expect(page.getByPlaceholder(/password/i).first()).toBeVisible()
    })

    test('should validate password requirements', async ({ page }) => {
      await page.goto('/register')
      await page.getByPlaceholder(/email/i).fill('test@example.com')
      await page.getByPlaceholder(/password/i).first().fill('weak')
      await page.getByRole('button', { name: /sign up|register|create/i }).click()
      await expect(page.getByText(/12|characters|uppercase|lowercase|number|special/i)).toBeVisible()
    })

    test('should require ToS acceptance', async ({ page }) => {
      await page.goto('/register')
      await page.getByPlaceholder(/email/i).fill('test@example.com')
      await page.getByPlaceholder(/password/i).first().fill('SecureP@ssword123!')
      await page.getByRole('button', { name: /sign up|register|create/i }).click()
      await expect(page.getByText(/terms|agree|accept/i)).toBeVisible()
    })
  })

  test.describe('Forgot Password Page', () => {
    test('should display forgot password form', async ({ page }) => {
      await page.goto('/forgot-password')
      await expect(page.getByRole('heading', { name: /forgot|reset|password/i })).toBeVisible()
      await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    })

    test('should submit reset request', async ({ page }) => {
      await page.goto('/forgot-password')
      await page.getByPlaceholder(/email/i).fill('test@example.com')
      await page.getByRole('button', { name: /reset|send|submit/i }).click()
      await expect(page.getByText(/sent|check|email/i)).toBeVisible({ timeout: 10000 })
    })
  })
})
```

**Step 2: Run E2E tests**

Run: `cd frontend && npx playwright test e2e/auth.spec.ts`
Expected: Tests pass (may need running app)

**Step 3: Commit**

```bash
git add frontend/e2e/auth.spec.ts
git commit -m "test: add authentication E2E tests"
```

### Task 6.2: Dashboard E2E Tests

**Files:**
- Create: `frontend/e2e/dashboard.spec.ts`
- Create: `frontend/e2e/fixtures/auth.ts`

**Step 1: Create auth fixture for authenticated tests**

```typescript
// frontend/e2e/fixtures/auth.ts
import { test as base, Page } from '@playwright/test'

// Test user credentials (should match a seeded test user)
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@siteproof.app',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
}

export const test = base.extend<{
  authenticatedPage: Page
}>({
  authenticatedPage: async ({ page }, use) => {
    // Login
    await page.goto('/login')
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email)
    await page.getByPlaceholder(/password/i).fill(TEST_USER.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    // Wait for redirect to dashboard
    await page.waitForURL(/dashboard|projects/, { timeout: 15000 })

    await use(page)
  },
})

export { expect } from '@playwright/test'
```

**Step 2: Write dashboard E2E tests**

```typescript
// frontend/e2e/dashboard.spec.ts
import { test, expect } from './fixtures/auth'

test.describe('Dashboard', () => {
  test('should display dashboard after login', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.getByRole('heading', { name: /dashboard/i })).toBeVisible()
  })

  test('should show navigation sidebar', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.getByRole('navigation')).toBeVisible()
    await expect(authenticatedPage.getByRole('link', { name: /projects/i })).toBeVisible()
  })

  test('should show user menu', async ({ authenticatedPage }) => {
    // Look for user avatar or menu button
    const userMenu = authenticatedPage.locator('[data-testid="user-menu"]').or(
      authenticatedPage.getByRole('button', { name: /profile|account|user/i })
    )
    await expect(userMenu).toBeVisible()
  })

  test('should navigate to projects', async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole('link', { name: /projects/i }).click()
    await expect(authenticatedPage.getByRole('heading', { name: /projects/i })).toBeVisible()
  })

  test('should logout successfully', async ({ authenticatedPage }) => {
    // Open user menu
    const userMenu = authenticatedPage.locator('[data-testid="user-menu"]').or(
      authenticatedPage.getByRole('button', { name: /profile|account|user/i })
    )
    await userMenu.click()

    // Click logout
    await authenticatedPage.getByRole('menuitem', { name: /logout|sign out/i }).click()

    // Should redirect to login
    await expect(authenticatedPage).toHaveURL(/login/)
  })
})
```

**Step 3: Run E2E tests**

Run: `cd frontend && npx playwright test e2e/dashboard.spec.ts`
Expected: Tests pass

**Step 4: Commit**

```bash
git add frontend/e2e/dashboard.spec.ts frontend/e2e/fixtures/auth.ts
git commit -m "test: add dashboard E2E tests with auth fixture"
```

### Task 6.3: NCR Page E2E Tests

**Files:**
- Create: `frontend/e2e/ncr.spec.ts`

**Step 1: Write NCR page E2E tests**

```typescript
// frontend/e2e/ncr.spec.ts
import { test, expect } from './fixtures/auth'

test.describe('NCR Management', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to a project's NCR page
    await authenticatedPage.getByRole('link', { name: /projects/i }).click()
    // Click first project
    await authenticatedPage.locator('[data-testid="project-card"]').first().click()
    // Navigate to NCRs
    await authenticatedPage.getByRole('link', { name: /ncr/i }).click()
  })

  test('should display NCR list page', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.getByRole('heading', { name: /non-conformance|ncr/i })).toBeVisible()
  })

  test('should show NCR filters', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.getByLabel(/status/i)).toBeVisible()
    await expect(authenticatedPage.getByLabel(/category/i)).toBeVisible()
  })

  test('should show empty state when no NCRs', async ({ authenticatedPage }) => {
    // This assumes the test project has no NCRs
    const emptyState = authenticatedPage.getByText(/no ncr|no non-conformance/i)
    const ncrList = authenticatedPage.locator('[data-testid="ncr-list"]')

    // Either empty state or NCR list should be visible
    await expect(emptyState.or(ncrList)).toBeVisible()
  })

  test('should open create NCR dialog', async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole('button', { name: /create|new|raise/i }).click()
    await expect(authenticatedPage.getByRole('dialog')).toBeVisible()
    await expect(authenticatedPage.getByLabel(/description/i)).toBeVisible()
    await expect(authenticatedPage.getByLabel(/category/i)).toBeVisible()
    await expect(authenticatedPage.getByLabel(/severity/i)).toBeVisible()
  })

  test('should validate NCR form', async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole('button', { name: /create|new|raise/i }).click()
    await authenticatedPage.getByRole('button', { name: /save|create|submit/i }).click()
    await expect(authenticatedPage.getByText(/required/i)).toBeVisible()
  })
})
```

**Step 2: Run E2E tests**

Run: `cd frontend && npx playwright test e2e/ncr.spec.ts`
Expected: Tests pass

**Step 3: Commit**

```bash
git add frontend/e2e/ncr.spec.ts
git commit -m "test: add NCR page E2E tests"
```

---

## Phase 7: Integration Tests

### Task 7.1: Full Workflow Integration Tests

**Files:**
- Create: `backend/src/test/integration/full-workflow.test.ts`

**Step 1: Write full workflow integration test**

```typescript
// backend/src/test/integration/full-workflow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from '../../routes/auth.js'
import { lotsRouter } from '../../routes/lots.js'
import { ncrsRouter } from '../../routes/ncrs.js'
import { prisma } from '../../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/lots', lotsRouter)
app.use('/api/ncrs', ncrsRouter)

describe('Full Workflow Integration', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string

  beforeAll(async () => {
    // Create company
    const company = await prisma.company.create({
      data: { name: `Integration Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Register user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `integration-${Date.now()}@example.com`,
        password: 'SecureP@ssword123!',
        fullName: 'Integration Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    // Set up user with admin role
    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Integration Project ${Date.now()}`,
        projectNumber: `INT-${Date.now()}`,
        companyId,
        status: 'active',
      }
    })
    projectId = project.id

    // Add user to project
    await prisma.projectUser.create({
      data: {
        projectId,
        userId,
        role: 'quality_manager',
        status: 'active',
      }
    })
  })

  afterAll(async () => {
    // Clean up in reverse order of dependencies
    await prisma.nCREvidence.deleteMany({ where: { ncr: { projectId } } })
    await prisma.nCRLot.deleteMany({ where: { ncr: { projectId } } })
    await prisma.nCR.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should complete full lot lifecycle', async () => {
    // 1. Create lot
    const createRes = await request(app)
      .post('/api/lots')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        lotNumber: `LIFECYCLE-${Date.now()}`,
        description: 'Full lifecycle test lot',
        activityType: 'Concrete',
      })

    expect(createRes.status).toBe(201)
    const lotId = createRes.body.lot.id

    // 2. Update status to in_progress
    const progressRes = await request(app)
      .patch(`/api/lots/${lotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'in_progress' })

    expect(progressRes.status).toBe(200)
    expect(progressRes.body.lot.status).toBe('in_progress')

    // 3. Create NCR for this lot
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Test NCR for workflow',
        category: 'Workmanship',
        severity: 'minor',
        lotIds: [lotId],
        responsibleUserId: userId,
      })

    expect(ncrRes.status).toBe(201)
    const ncrId = ncrRes.body.ncr.id

    // 4. Respond to NCR
    const respondRes = await request(app)
      .post(`/api/ncrs/${ncrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Incorrect method used',
        proposedCorrectiveAction: 'Retrain and redo work',
      })

    expect(respondRes.status).toBe(200)
    expect(respondRes.body.ncr.status).toBe('investigating')

    // 5. QM accepts response
    const qmRes = await request(app)
      .post(`/api/ncrs/${ncrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'accept',
        comments: 'Acceptable response',
      })

    expect(qmRes.status).toBe(200)
    expect(qmRes.body.ncr.status).toBe('rectification')

    // 6. Submit rectification
    const rectifyRes = await request(app)
      .post(`/api/ncrs/${ncrId}/rectify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rectificationNotes: 'Work has been redone',
      })

    expect(rectifyRes.status).toBe(200)
    expect(rectifyRes.body.ncr.status).toBe('verification')

    // 7. Close NCR
    const closeRes = await request(app)
      .post(`/api/ncrs/${ncrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        verificationNotes: 'Verified complete',
        lessonsLearned: 'Update procedure documentation',
      })

    expect(closeRes.status).toBe(200)
    expect(closeRes.body.ncr.status).toBe('closed')

    // 8. Update lot status to completed
    const completeRes = await request(app)
      .patch(`/api/lots/${lotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'completed' })

    expect(completeRes.status).toBe(200)
    expect(completeRes.body.lot.status).toBe('completed')

    // 9. Conform lot
    const conformRes = await request(app)
      .post(`/api/lots/${lotId}/conform`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ force: true })

    expect(conformRes.status).toBe(200)
    expect(conformRes.body.lot.status).toBe('conformed')
  })

  it('should handle major NCR with QM approval', async () => {
    // 1. Create lot
    const lotRes = await request(app)
      .post('/api/lots')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        lotNumber: `MAJOR-NCR-${Date.now()}`,
      })

    const lotId = lotRes.body.lot.id

    // 2. Create major NCR
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Major defect requiring QM approval',
        category: 'Material',
        severity: 'major',
        lotIds: [lotId],
      })

    expect(ncrRes.status).toBe(201)
    const ncrId = ncrRes.body.ncr.id

    // 3. Go through workflow
    await request(app)
      .post(`/api/ncrs/${ncrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Material',
        rootCauseDescription: 'Defective material',
        proposedCorrectiveAction: 'Replace material',
      })

    await request(app)
      .post(`/api/ncrs/${ncrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'accept' })

    await request(app)
      .post(`/api/ncrs/${ncrId}/rectify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rectificationNotes: 'Material replaced' })

    // 4. Try to close without QM approval
    const closeWithoutApprovalRes = await request(app)
      .post(`/api/ncrs/${ncrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ verificationNotes: 'Done' })

    expect(closeWithoutApprovalRes.status).toBe(403)
    expect(closeWithoutApprovalRes.body.requiresQmApproval).toBe(true)

    // 5. QM approval
    const approvalRes = await request(app)
      .post(`/api/ncrs/${ncrId}/qm-approve`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(approvalRes.status).toBe(200)

    // 6. Now close successfully
    const closeRes = await request(app)
      .post(`/api/ncrs/${ncrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ verificationNotes: 'Verified' })

    expect(closeRes.status).toBe(200)
    expect(closeRes.body.ncr.status).toBe('closed')
  })
})
```

**Step 2: Run integration tests**

Run: `cd backend && npx vitest run src/test/integration/full-workflow.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/src/test/integration/full-workflow.test.ts
git commit -m "test: add full workflow integration tests"
```

---

## Phase 8: Test Coverage & CI Setup

### Task 8.1: Update Package Scripts

**Files:**
- Modify: `backend/package.json`
- Modify: `frontend/package.json`

**Step 1: Add test scripts to backend package.json**

Add to `backend/package.json` scripts section:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

**Step 2: Add test scripts to frontend package.json**

Add to `frontend/package.json` scripts section:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report"
  }
}
```

**Step 3: Commit**

```bash
git add backend/package.json frontend/package.json
git commit -m "chore: add test scripts to package.json"
```

### Task 8.2: Create CI Test Workflow

**Files:**
- Create: `.github/workflows/test.yml`

**Step 1: Write GitHub Actions workflow**

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: siteproof_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: cd backend && npm ci

      - name: Setup test database
        run: cd backend && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/siteproof_test

      - name: Run tests
        run: cd backend && npm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/siteproof_test
          JWT_SECRET: test-secret-key
          NODE_ENV: test

  frontend-e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Install Playwright browsers
        run: cd frontend && npx playwright install --with-deps

      - name: Run E2E tests
        run: cd frontend && npm run test:e2e
        env:
          CI: true

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 30
```

**Step 2: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add GitHub Actions test workflow"
```

---

## Phase 9: Projects API Tests

### Task 9.1: Project CRUD Tests

**Files:**
- Create: `backend/src/routes/projects.test.ts`

**Tests to implement:**
- POST /api/projects - Create project with valid data
- POST /api/projects - Reject without required fields (name, projectNumber)
- POST /api/projects - Reject duplicate project number
- GET /api/projects - List projects for user's company
- GET /api/projects/:id - Get single project
- GET /api/projects/:id - Return 404 for non-existent
- PATCH /api/projects/:id - Update project details
- PATCH /api/projects/:id - Update project status (active, paused, completed, archived)
- DELETE /api/projects/:id - Delete project (admin only)
- DELETE /api/projects/:id - Reject if has lots

### Task 9.2: Project Team Management Tests

**Tests to implement:**
- GET /api/projects/:id/users - List project team members
- POST /api/projects/:id/users - Add user to project with role
- POST /api/projects/:id/users - Reject duplicate user
- PATCH /api/projects/:id/users/:userId - Update user role
- DELETE /api/projects/:id/users/:userId - Remove user from project
- Role validation for team management (admin/PM only)

### Task 9.3: Project Areas Tests

**Tests to implement:**
- GET /api/projects/:id/areas - List project areas
- POST /api/projects/:id/areas - Create area with chainage
- PATCH /api/projects/:id/areas/:areaId - Update area
- DELETE /api/projects/:id/areas/:areaId - Delete area
- Validate chainage range (start < end)

---

## Phase 10: ITP API Tests

### Task 10.1: ITP Template CRUD Tests

**Files:**
- Create: `backend/src/routes/itps.test.ts`

**Tests to implement:**
- POST /api/itp-templates - Create template
- POST /api/itp-templates - With checklist items
- GET /api/itp-templates - List templates for project
- GET /api/itp-templates/:id - Get single template with items
- PATCH /api/itp-templates/:id - Update template
- DELETE /api/itp-templates/:id - Delete template
- POST /api/itp-templates/:id/clone - Clone template
- POST /api/itp-templates/:id/archive - Archive template
- POST /api/itp-templates/:id/restore - Restore archived

### Task 10.2: ITP Checklist Items Tests

**Tests to implement:**
- POST /api/itp-templates/:id/items - Add checklist item
- PATCH /api/itp-templates/:id/items/:itemId - Update item
- DELETE /api/itp-templates/:id/items/:itemId - Delete item
- PUT /api/itp-templates/:id/items/reorder - Reorder items
- Validate point types (hold, witness, verification)
- Validate evidence requirements

### Task 10.3: ITP Instance Tests

**Tests to implement:**
- POST /api/itp-instances - Create instance for lot
- GET /api/itp-instances - List instances for lot
- GET /api/itp-instances/:id - Get instance with completions
- POST /api/itp-instances/:id/complete/:itemId - Complete checklist item
- POST /api/itp-instances/:id/complete/:itemId - With GPS, signature, photo
- POST /api/itp-instances/:id/verify/:itemId - Verify completion
- POST /api/itp-instances/:id/reject/:itemId - Reject completion
- GET /api/itp-instances/pending-verification - List pending verifications

---

## Phase 11: Hold Points API Tests

### Task 11.1: Hold Point CRUD Tests

**Files:**
- Create: `backend/src/routes/holdpoints.test.ts`

**Tests to implement:**
- GET /api/hold-points - List hold points for project
- GET /api/hold-points/:id - Get single hold point
- GET /api/hold-points/pending - List pending hold points
- Filter by status, lot, ITP

### Task 11.2: Hold Point Release Tests

**Tests to implement:**
- POST /api/hold-points/:id/release - Release by internal user
- POST /api/hold-points/:id/release - With signature and notes
- POST /api/hold-points/:id/generate-token - Generate external release token
- GET /api/hold-points/public/:token - Get hold point by token (public)
- POST /api/hold-points/public/:token/release - External release
- Token expiration handling
- Working hours validation

### Task 11.3: Hold Point Escalation Tests

**Tests to implement:**
- POST /api/hold-points/:id/chase - Send chase reminder
- Chase count increment
- POST /api/hold-points/:id/escalate - Escalate hold point
- Escalation notification creation
- POST /api/hold-points/:id/resolve-escalation - Resolve escalation
- GET /api/hold-points/:id/evidence-package - Generate evidence package

---

## Phase 12: Test Results API Tests

### Task 12.1: Test Result CRUD Tests

**Files:**
- Create: `backend/src/routes/testresults.test.ts`

**Tests to implement:**
- POST /api/test-results - Create test result
- POST /api/test-results - With specification limits
- GET /api/test-results - List for project/lot
- GET /api/test-results/:id - Get single result
- PATCH /api/test-results/:id - Update result
- DELETE /api/test-results/:id - Delete result
- Pass/fail auto-calculation from spec limits

### Task 12.2: Test Result Verification Tests

**Tests to implement:**
- POST /api/test-results/:id/verify - Verify result (QM)
- POST /api/test-results/:id/reject - Reject with reason
- Role permission checks for verification
- Status workflow (requested → reported → verified → closed)

### Task 12.3: Test Result AI Extraction Tests

**Tests to implement:**
- POST /api/test-results/extract - AI extraction from certificate image
- Confidence score validation
- POST /api/test-results/batch-upload - Batch upload
- POST /api/test-results/batch-confirm - Confirm batch results

---

## Phase 13: Daily Diary API Tests

### Task 13.1: Diary CRUD Tests

**Files:**
- Create: `backend/src/routes/diary.test.ts`

**Tests to implement:**
- POST /api/diary - Create diary entry for date
- GET /api/diary - List diary entries for project
- GET /api/diary/:id - Get single diary with all sections
- PATCH /api/diary/:id - Update diary
- POST /api/diary/:id/submit - Submit diary
- POST /api/diary/:id/lock - Lock diary (admin)
- Prevent duplicate diary per project/date

### Task 13.2: Diary Personnel Tests

**Tests to implement:**
- POST /api/diary/:id/personnel - Add personnel entry
- PATCH /api/diary/:id/personnel/:entryId - Update entry
- DELETE /api/diary/:id/personnel/:entryId - Delete entry
- GET /api/diary/:id/recall-personnel - Recall previous day's personnel

### Task 13.3: Diary Plant Tests

**Tests to implement:**
- POST /api/diary/:id/plant - Add plant entry
- PATCH /api/diary/:id/plant/:entryId - Update entry
- DELETE /api/diary/:id/plant/:entryId - Delete entry
- GET /api/diary/:id/recent-plant - Get recent plant history

### Task 13.4: Diary Activities Tests

**Tests to implement:**
- POST /api/diary/:id/activities - Add activity entry
- Activity linked to lot
- Quantity and unit tracking
- GET /api/diary/:id/activity-suggestions - Get suggestions from lots

### Task 13.5: Diary Weather & Delays Tests

**Tests to implement:**
- PATCH /api/diary/:id/weather - Update weather data
- GET /api/diary/weather/:date - Fetch weather from API
- POST /api/diary/:id/delays - Add delay entry
- Delay type, duration, impact tracking
- POST /api/diary/:id/addendum - Add addendum to submitted diary

---

## Phase 14: Dockets API Tests

### Task 14.1: Docket CRUD Tests

**Files:**
- Create: `backend/src/routes/dockets.test.ts`

**Tests to implement:**
- POST /api/dockets - Create docket for subcontractor/date
- GET /api/dockets - List dockets for project
- GET /api/dockets/:id - Get docket with entries
- PATCH /api/dockets/:id - Update docket
- DELETE /api/dockets/:id - Delete draft docket
- Prevent duplicate docket per subcontractor/date

### Task 14.2: Docket Labour Tests

**Tests to implement:**
- POST /api/dockets/:id/labour - Add labour entry
- Labour with employee, start/end time, hours, rate
- POST /api/dockets/:id/labour/:entryId/allocate - Allocate to lots
- Hours per lot tracking
- PATCH /api/dockets/:id/labour/:entryId - Update entry
- DELETE /api/dockets/:id/labour/:entryId - Delete entry

### Task 14.3: Docket Plant Tests

**Tests to implement:**
- POST /api/dockets/:id/plant - Add plant entry
- Plant with equipment, hours, wet/dry rate
- POST /api/dockets/:id/plant/:entryId/allocate - Allocate to lots
- PATCH /api/dockets/:id/plant/:entryId - Update entry
- DELETE /api/dockets/:id/plant/:entryId - Delete entry

### Task 14.4: Docket Approval Workflow Tests

**Tests to implement:**
- POST /api/dockets/:id/submit - Submit docket
- POST /api/dockets/:id/approve - Approve docket
- Approved vs submitted amounts tracking
- POST /api/dockets/:id/reject - Reject with reason
- POST /api/dockets/:id/query - Approve with query
- POST /api/dockets/:id/respond-query - Respond to query
- Role permissions (site manager+ can approve)

---

## Phase 15: Subcontractors API Tests

### Task 15.1: Global Subcontractor Directory Tests

**Files:**
- Create: `backend/src/routes/subcontractors.test.ts`

**Tests to implement:**
- POST /api/subcontractors/global - Create global subcontractor
- GET /api/subcontractors/global - List company's subcontractors
- PATCH /api/subcontractors/global/:id - Update subcontractor
- DELETE /api/subcontractors/global/:id - Delete subcontractor
- ABN validation

### Task 15.2: Project Subcontractor Tests

**Tests to implement:**
- POST /api/subcontractors - Add subcontractor to project
- GET /api/subcontractors - List project subcontractors
- PATCH /api/subcontractors/:id - Update project subcontractor
- Status transitions (pending, approved, active, inactive)

### Task 15.3: Subcontractor Invitation Tests

**Tests to implement:**
- POST /api/subcontractors/:id/invite - Send invitation
- GET /api/subcontractors/invitations/:token - Get invitation details
- POST /api/subcontractors/invitations/:token/accept - Accept invitation
- Token expiration handling
- Email verification on accept

### Task 15.4: Employee Roster Tests

**Tests to implement:**
- POST /api/subcontractors/:id/employees - Add employee
- GET /api/subcontractors/:id/employees - List employees
- PATCH /api/subcontractors/:id/employees/:empId - Update employee
- DELETE /api/subcontractors/:id/employees/:empId - Delete employee
- POST /api/subcontractors/:id/employees/:empId/approve - Approve employee
- Hourly rate tracking

### Task 15.5: Plant Register Tests

**Tests to implement:**
- POST /api/subcontractors/:id/plant - Add plant item
- GET /api/subcontractors/:id/plant - List plant
- PATCH /api/subcontractors/:id/plant/:plantId - Update plant
- DELETE /api/subcontractors/:id/plant/:plantId - Delete plant
- POST /api/subcontractors/:id/plant/:plantId/approve - Approve plant
- Wet/dry rate tracking

### Task 15.6: Portal Access Tests

**Tests to implement:**
- PATCH /api/subcontractors/:id/portal-settings - Update portal access
- Feature flags (can submit dockets, view lots, etc.)
- Subcontractor user role assignment

---

## Phase 16: Documents API Tests

### Task 16.1: Document Upload Tests

**Files:**
- Create: `backend/src/routes/documents.test.ts`

**Tests to implement:**
- POST /api/documents - Upload document
- File type validation
- File size limits
- GET /api/documents - List documents for project
- GET /api/documents/:id - Get document details
- DELETE /api/documents/:id - Delete document

### Task 16.2: Document Management Tests

**Tests to implement:**
- PATCH /api/documents/:id - Update metadata
- POST /api/documents/:id/tag - Add tags
- DELETE /api/documents/:id/tag/:tag - Remove tag
- GET /api/documents/:id/signed-url - Get signed download URL
- Document versioning
- Parent/child relationships

### Task 16.3: Drawing Tests

**Tests to implement:**
- POST /api/drawings - Create drawing
- GET /api/drawings - List drawings for project
- GET /api/drawings/:id - Get drawing details
- PATCH /api/drawings/:id - Update drawing
- POST /api/drawings/:id/supersede - Supersede with new version
- GET /api/drawings/current - Get current drawing set

---

## Phase 17: Progress Claims API Tests

### Task 17.1: Claims CRUD Tests

**Files:**
- Create: `backend/src/routes/claims.test.ts`

**Tests to implement:**
- POST /api/claims - Create claim
- GET /api/claims - List claims for project
- GET /api/claims/:id - Get claim with lots
- PATCH /api/claims/:id - Update claim
- DELETE /api/claims/:id - Delete draft claim

### Task 17.2: Claim Lots Tests

**Tests to implement:**
- POST /api/claims/:id/lots - Add lot to claim
- Quantity, rate, amount tracking
- Percentage complete tracking
- DELETE /api/claims/:id/lots/:lotId - Remove lot from claim

### Task 17.3: Claim Workflow Tests

**Tests to implement:**
- POST /api/claims/:id/submit - Submit claim
- POST /api/claims/:id/certify - Certify claim
- Certified amount vs claimed
- POST /api/claims/:id/payment - Record payment
- Payment date, amount, reference
- GET /api/claims/:id/evidence-package - Generate evidence
- GET /api/claims/:id/completeness - Check completeness

---

## Phase 18: Additional E2E Tests

### Task 18.1: Lots Page E2E Tests

**Files:**
- Create: `frontend/e2e/lots.spec.ts`

**Tests to implement:**
- Display lots list with filters
- Create new lot dialog
- Edit lot inline/modal
- Status change workflow
- Bulk select and actions
- Lot conformance flow
- Quick view panel

### Task 18.2: ITP Page E2E Tests

**Files:**
- Create: `frontend/e2e/itp.spec.ts`

**Tests to implement:**
- Template list view
- Create template with checklist items
- Assign template to lot
- Complete checklist item with photo
- Verification workflow
- Hold point release

### Task 18.3: Daily Diary Page E2E Tests

**Files:**
- Create: `frontend/e2e/diary.spec.ts`

**Tests to implement:**
- Create diary for date
- Add personnel entries
- Add plant entries
- Add activity entries
- Weather section
- Submit diary
- View locked diary

### Task 18.4: Dockets Page E2E Tests

**Files:**
- Create: `frontend/e2e/dockets.spec.ts`

**Tests to implement:**
- Docket list with filters
- View docket details
- Approve/reject workflow
- Query and response flow
- Cost calculations display

### Task 18.5: Subcontractor Portal E2E Tests

**Files:**
- Create: `frontend/e2e/subcontractor-portal.spec.ts`

**Tests to implement:**
- Login as subcontractor user
- View assigned lots only
- Submit daily docket
- View docket status
- Limited navigation (portal restrictions)

### Task 18.6: Test Results Page E2E Tests

**Files:**
- Create: `frontend/e2e/test-results.spec.ts`

**Tests to implement:**
- Test results list
- Create test result
- Upload certificate
- AI extraction flow
- Verification workflow

### Task 18.7: Hold Points Page E2E Tests

**Files:**
- Create: `frontend/e2e/hold-points.spec.ts`

**Tests to implement:**
- Hold points list
- Release hold point
- Generate external link
- Chase reminder
- Escalation flow

### Task 18.8: Documents Page E2E Tests

**Files:**
- Create: `frontend/e2e/documents.spec.ts`

**Tests to implement:**
- Document list with filters
- Upload document
- Preview document
- Download document
- Tag management
- Drawing management

### Task 18.9: Progress Claims Page E2E Tests

**Files:**
- Create: `frontend/e2e/claims.spec.ts`

**Tests to implement:**
- Claims list
- Create claim
- Add lots to claim
- Submit claim
- Certification workflow
- Payment recording

### Task 18.10: Settings Pages E2E Tests

**Files:**
- Create: `frontend/e2e/settings.spec.ts`

**Tests to implement:**
- User profile settings
- Change password
- 2FA setup/disable
- Notification preferences
- Company settings (admin)
- Project settings

---

## Phase 19: Security Tests

### Task 19.1: Authentication Security Tests

**Files:**
- Create: `backend/src/test/security/auth-security.test.ts`

**Tests to implement:**
- Rate limiting on login endpoint
- Account lockout after failed attempts
- Password not returned in responses
- Token expiration enforcement
- Session invalidation on password change
- CSRF token validation

### Task 19.2: Authorization Security Tests

**Files:**
- Create: `backend/src/test/security/authz-security.test.ts`

**Tests to implement:**
- Cross-project data access prevention
- Cross-company data access prevention
- Role escalation prevention
- Direct object reference protection
- API endpoint authorization matrix

### Task 19.3: Input Validation Security Tests

**Files:**
- Create: `backend/src/test/security/input-security.test.ts`

**Tests to implement:**
- SQL injection prevention
- XSS prevention in text fields
- NoSQL injection prevention
- Path traversal prevention
- File upload validation
- Request size limits

### Task 19.4: API Security Tests

**Files:**
- Create: `backend/src/test/security/api-security.test.ts`

**Tests to implement:**
- CORS configuration
- Security headers (HSTS, X-Frame-Options, etc.)
- API key validation
- Webhook signature verification
- Signed URL expiration

---

## Phase 20: Performance Tests

### Task 20.1: API Response Time Tests

**Files:**
- Create: `backend/src/test/performance/response-time.test.ts`

**Tests to implement:**
- List endpoints < 500ms with pagination
- Single record fetch < 200ms
- Create operations < 1s
- Bulk operations < 5s
- File upload < 10s for 10MB

### Task 20.2: Load Tests

**Files:**
- Create: `backend/src/test/performance/load.test.ts`

**Tests to implement:**
- 50 concurrent users baseline
- 100 concurrent users stress
- Database connection pool limits
- Memory usage under load
- Graceful degradation

### Task 20.3: Database Query Tests

**Files:**
- Create: `backend/src/test/performance/queries.test.ts`

**Tests to implement:**
- Index usage verification
- N+1 query detection
- Large dataset pagination
- Report generation performance

---

## Phase 21: Notifications & Integrations Tests

### Task 21.1: Notification Tests

**Files:**
- Create: `backend/src/routes/notifications.test.ts`

**Tests to implement:**
- GET /api/notifications - List user notifications
- PATCH /api/notifications/:id/read - Mark as read
- POST /api/notifications/mark-all-read - Mark all read
- DELETE /api/notifications/:id - Delete notification
- Email notification triggering
- Push notification delivery
- Notification preferences respect

### Task 21.2: Webhook Tests

**Files:**
- Create: `backend/src/routes/webhooks.test.ts`

**Tests to implement:**
- POST /api/webhooks - Create webhook config
- GET /api/webhooks - List webhooks
- PATCH /api/webhooks/:id - Update webhook
- DELETE /api/webhooks/:id - Delete webhook
- POST /api/webhooks/:id/test - Test delivery
- GET /api/webhooks/:id/deliveries - Delivery history
- Signature generation

### Task 21.3: Audit Log Tests

**Files:**
- Create: `backend/src/routes/audit.test.ts`

**Tests to implement:**
- GET /api/audit-log - List audit entries
- Filter by action type
- Filter by entity type
- Filter by user
- Filter by date range
- Audit entry creation on mutations

---

## Summary

This comprehensive testing plan covers:

1. **Test Infrastructure** - Vitest config, Playwright config, test utilities
2. **Authentication Tests** - Registration, login, password reset, magic links, 2FA
3. **Lots API Tests** - CRUD, status workflows, bulk operations
4. **NCR API Tests** - CRUD, workflow transitions, analytics
5. **Role-Based Access Tests** - Permission checks for all user roles
6. **E2E UI Tests** - Authentication, dashboard, NCR management
7. **Integration Tests** - Full workflow scenarios
8. **CI/CD** - GitHub Actions for automated testing
9. **Projects API Tests** - CRUD, team management, areas
10. **ITP API Tests** - Templates, instances, completions, verification
11. **Hold Points API Tests** - Release, tokens, escalation
12. **Test Results API Tests** - CRUD, AI extraction, verification
13. **Daily Diary API Tests** - All sections, weather, delays
14. **Dockets API Tests** - Labour, plant, approval workflow
15. **Subcontractors API Tests** - Directory, invitations, roster, portal
16. **Documents API Tests** - Upload, versioning, drawings
17. **Progress Claims API Tests** - CRUD, lots, workflow
18. **Additional E2E Tests** - All major pages
19. **Security Tests** - Auth, authz, input validation, API security
20. **Performance Tests** - Response times, load, queries
21. **Notifications & Integrations Tests** - Notifications, webhooks, audit

**Total Test Coverage Target:** ~400+ test cases covering all 200+ API endpoints, all UI pages, security, and performance.

---

**Plan complete. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
