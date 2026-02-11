# SiteProof v3 Codebase Remediation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. This plan uses a PROTECTOR AGENT pattern - always run the protector in parallel with implementation agents.

**Goal:** Fix all 20 issues identified in the codebase review, starting with critical security issues, using parallel subagents with a protector agent watching for breaking changes.

**Architecture:** Orchestrator dispatches implementation agents in parallel with a continuously-running protector agent. The protector monitors for: test failures, TypeScript errors, breaking API changes, and logic alterations. Implementation proceeds in phases (Critical → High → Medium → Low).

**Tech Stack:** TypeScript, React, Express, Prisma, Zod, DOMPurify, Vitest, Playwright

---

## Execution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR AGENT                          │
│  - Manages phases and task dispatch                              │
│  - Collects results from all agents                              │
│  - STOPS if protector raises HALT signal                         │
└─────────────────────────────────────────────────────────────────┘
        │                                           │
        │ (parallel)                                │ (parallel)
        ▼                                           ▼
┌───────────────────┐                    ┌────────────────────────┐
│ IMPLEMENTATION    │                    │   PROTECTOR AGENT      │
│ AGENTS (1-N)      │                    │   (runs continuously)  │
│                   │                    │                        │
│ - Make changes    │                    │ - Runs after EVERY     │
│ - Run unit tests  │                    │   implementation step  │
│ - Commit work     │                    │ - Checks:              │
└───────────────────┘                    │   ✓ pnpm tsc --noEmit  │
                                         │   ✓ pnpm test          │
                                         │   ✓ git diff analysis  │
                                         │   ✓ No logic changes   │
                                         │ - HALTS on failure     │
                                         └────────────────────────┘
```

## Protector Agent Protocol

**The Protector Agent MUST be invoked after EVERY implementation task completes.**

### Protector Agent Prompt Template

```
You are the PROTECTOR AGENT for SiteProof v3 codebase remediation.

Your job is to VERIFY the last change did not break anything.

RUN THESE CHECKS IN ORDER:

1. **TypeScript Check (Backend)**
   cd backend && pnpm tsc --noEmit
   HALT if: Any type errors

2. **TypeScript Check (Frontend)**
   cd frontend && pnpm tsc --noEmit
   HALT if: Any type errors

3. **Backend Tests**
   cd backend && pnpm test --run
   HALT if: Any test failures

4. **Git Diff Analysis**
   git diff HEAD~1 --stat
   Review changes for:
   - Unexpected file modifications
   - Logic changes beyond the task scope
   - Removed functionality
   HALT if: Suspicious changes detected

5. **Verify No Breaking Changes**
   - Check that API signatures unchanged (unless task requires it)
   - Check that component props unchanged (unless task requires it)
   - Check that database schema unchanged

RESPONSE FORMAT:
- If ALL checks pass: "✅ PROTECTOR: All checks passed. Safe to continue."
- If ANY check fails: "🛑 HALT: [Specific failure]. DO NOT PROCEED. Rollback with: git checkout HEAD~1"

CRITICAL: You have VETO POWER. If you say HALT, the orchestrator MUST stop.
```

---

## Phase 1: Critical Security Fixes

### Task 1.1: Install DOMPurify

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install DOMPurify**
```bash
cd frontend && pnpm add dompurify && pnpm add -D @types/dompurify
```

**Step 2: Verify installation**
```bash
cd frontend && pnpm list dompurify
```
Expected: `dompurify@X.X.X` in output

**Step 3: Run Protector Agent**

---

### Task 1.2: Fix XSS Vulnerability in DailyDiaryPage

**Files:**
- Modify: `frontend/src/pages/diary/DailyDiaryPage.tsx:1776`

**Step 1: Add DOMPurify import at top of file**

Find the imports section and add:
```typescript
import DOMPurify from 'dompurify'
```

**Step 2: Sanitize the dangerouslySetInnerHTML usage**

Find line ~1776 with:
```typescript
dangerouslySetInnerHTML={{ __html: weatherForm.generalNotes || '<span class="text-muted-foreground">No notes</span>' }}
```

Replace with:
```typescript
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(weatherForm.generalNotes || '<span class="text-muted-foreground">No notes</span>') }}
```

**Step 3: Search for other dangerouslySetInnerHTML usages**
```bash
cd frontend && grep -rn "dangerouslySetInnerHTML" src/
```
If found, sanitize all instances.

**Step 4: Run Protector Agent**

**Step 5: Commit**
```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/pages/diary/DailyDiaryPage.tsx
git commit -m "fix(security): sanitize HTML with DOMPurify to prevent XSS

- Add DOMPurify dependency
- Sanitize dangerouslySetInnerHTML in DailyDiaryPage

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.3: Add Global Auth Middleware to apiKeys.ts

**Files:**
- Modify: `backend/src/routes/apiKeys.ts`

**Step 1: Read current file structure**
```bash
head -50 backend/src/routes/apiKeys.ts
```

**Step 2: Add router.use(authenticateToken) after router creation**

Find where router is created:
```typescript
const router = Router()
```

Add immediately after:
```typescript
const router = Router()

// Require authentication for all API key routes
router.use(authenticateToken)
```

**Step 3: Ensure authenticateToken is imported**

Verify import exists:
```typescript
import { authenticateToken } from '../middleware/authMiddleware.js'
```

**Step 4: Remove redundant inline auth checks**

The file has manual checks like:
```typescript
const userId = req.user?.id
if (!userId) {
  return res.status(401).json({ error: 'Unauthorized' })
}
```

Keep the `userId` extraction but remove the manual 401 check since middleware handles it:
```typescript
const userId = req.user!.id  // Safe: middleware guarantees user exists
```

**Step 5: Run Protector Agent**

**Step 6: Commit**
```bash
git add backend/src/routes/apiKeys.ts
git commit -m "fix(security): add global auth middleware to apiKeys route

- Add router.use(authenticateToken) for consistent auth pattern
- Remove redundant inline auth checks
- Matches pattern used in other route files

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.4: Add Zod Validation to claims.ts (Highest Traffic Route)

**Files:**
- Modify: `backend/src/routes/claims.ts`

**Step 1: Read current claims.ts structure**
```bash
head -150 backend/src/routes/claims.ts
```

**Step 2: Add Zod schemas at top of file (after imports)**

```typescript
import { z } from 'zod'

// Validation schemas
const createClaimSchema = z.object({
  periodStart: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  periodEnd: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  lotIds: z.array(z.string().uuid()).optional(),
  totalClaimedAmount: z.number().nonnegative().optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'paid']).optional()
})

const updateClaimSchema = z.object({
  periodStart: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  periodEnd: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  lotIds: z.array(z.string().uuid()).optional(),
  totalClaimedAmount: z.number().nonnegative().optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'paid']).optional()
})

const certifyClaimSchema = z.object({
  certifiedAmount: z.number().nonnegative(),
  certificationNotes: z.string().optional()
})
```

**Step 3: Add validation to POST create claim endpoint**

Find the POST handler and add validation:
```typescript
router.post('/:projectId/claims', async (req, res) => {
  const validation = createClaimSchema.safeParse(req.body)
  if (!validation.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.error.issues
    })
  }

  const { periodStart, periodEnd, lotIds, totalClaimedAmount, description, status } = validation.data
  // ... rest of handler using validated data
})
```

**Step 4: Add validation to PUT update claim endpoint**

```typescript
router.put('/:projectId/claims/:claimId', async (req, res) => {
  const validation = updateClaimSchema.safeParse(req.body)
  if (!validation.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.error.issues
    })
  }

  const data = validation.data
  // ... rest of handler
})
```

**Step 5: Add validation to POST certify endpoint**

```typescript
router.post('/:projectId/claims/:claimId/certify', async (req, res) => {
  const validation = certifyClaimSchema.safeParse(req.body)
  if (!validation.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.error.issues
    })
  }

  const { certifiedAmount, certificationNotes } = validation.data
  // ... rest of handler
})
```

**Step 6: Run existing claims tests**
```bash
cd backend && pnpm test --run src/routes/claims.test.ts
```

**Step 7: Run Protector Agent**

**Step 8: Commit**
```bash
git add backend/src/routes/claims.ts
git commit -m "fix(security): add Zod validation to claims routes

- Add createClaimSchema, updateClaimSchema, certifyClaimSchema
- Validate all request bodies before processing
- Return 400 with validation details on failure

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: High Priority Fixes

### Task 2.1: Add Zod Validation to Remaining High-Traffic Routes

**Files to modify (in order of traffic/importance):**
1. `backend/src/routes/lots.ts`
2. `backend/src/routes/ncrs.ts`
3. `backend/src/routes/dockets.ts`
4. `backend/src/routes/holdpoints.ts`
5. `backend/src/routes/itp.ts`

**For EACH file, follow this pattern:**

**Step 1: Identify all POST/PUT/PATCH endpoints**
```bash
grep -n "router\.\(post\|put\|patch\)" backend/src/routes/[filename].ts
```

**Step 2: Read the endpoint handlers to understand expected body structure**

**Step 3: Create Zod schemas matching the expected structure**

**Step 4: Add validation at start of each handler**

**Step 5: Run tests for that route file**
```bash
cd backend && pnpm test --run src/routes/[filename].test.ts
```

**Step 6: Run Protector Agent**

**Step 7: Commit each file separately**

---

### Task 2.2: Add Pagination to List Endpoints

**Files:**
- Modify: `backend/src/routes/claims.ts` (GET lots endpoint)
- Modify: `backend/src/routes/lots.ts` (GET all lots)
- Modify: `backend/src/routes/ncrs.ts` (GET all NCRs)
- Modify: `backend/src/routes/dockets.ts` (GET all dockets)

**Step 1: Create shared pagination utility**

Create file: `backend/src/lib/pagination.ts`
```typescript
import { z } from 'zod'

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export type PaginationParams = z.infer<typeof paginationSchema>

export function getPaginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1
  }
}

export function getPrismaSkipTake(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit
  }
}
```

**Step 2: Update each list endpoint to use pagination**

Example for lots.ts:
```typescript
import { paginationSchema, getPaginationMeta, getPrismaSkipTake } from '../lib/pagination.js'

router.get('/:projectId/lots', async (req, res) => {
  const pagination = paginationSchema.safeParse(req.query)
  if (!pagination.success) {
    return res.status(400).json({ error: 'Invalid pagination params' })
  }

  const { page, limit, sortBy, sortOrder } = pagination.data
  const { skip, take } = getPrismaSkipTake(page, limit)

  const [lots, total] = await Promise.all([
    prisma.lot.findMany({
      where: { projectId },
      skip,
      take,
      orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' }
    }),
    prisma.lot.count({ where: { projectId } })
  ])

  res.json({
    data: lots,
    pagination: getPaginationMeta(total, page, limit)
  })
})
```

**Step 3: Update frontend to handle paginated responses**

This is a BREAKING CHANGE - frontend must be updated to expect `{ data, pagination }` format.

**Step 4: Run Protector Agent**

**Step 5: Commit**

---

### Task 2.3: Create Standardized Error Handling Utility (Frontend)

**Files:**
- Create: `frontend/src/lib/errorHandling.ts`
- Modify: High-usage components to use new utility

**Step 1: Create error handling utility**

```typescript
// frontend/src/lib/errorHandling.ts
import { toast } from 'sonner' // or whatever toast library is used
import { ApiError } from './api'

export function handleApiError(error: unknown, fallbackMessage = 'An error occurred') {
  console.error('API Error:', error)

  if (error instanceof ApiError) {
    try {
      const body = JSON.parse(error.body)
      const message = body.error?.message || body.message || body.error || fallbackMessage
      toast.error(message)
      return message
    } catch {
      toast.error(error.body || fallbackMessage)
      return error.body || fallbackMessage
    }
  }

  if (error instanceof Error) {
    toast.error(error.message || fallbackMessage)
    return error.message || fallbackMessage
  }

  toast.error(fallbackMessage)
  return fallbackMessage
}

export function withErrorHandling<T>(
  promise: Promise<T>,
  fallbackMessage = 'An error occurred'
): Promise<T | null> {
  return promise.catch((error) => {
    handleApiError(error, fallbackMessage)
    return null
  })
}
```

**Step 2: Run Protector Agent**

**Step 3: Commit**

---

### Task 2.4: Begin LotDetailPage.tsx Refactoring (Largest File)

**Files:**
- Modify: `frontend/src/pages/lots/LotDetailPage.tsx` (4,516 lines)
- Create: `frontend/src/pages/lots/components/` directory
- Create: Multiple extracted components

**CRITICAL: This is a HIGH-RISK refactoring task. Extract ONE component at a time, run protector after each extraction.**

**Step 1: Analyze file structure**
```bash
grep -n "function\|const.*=.*=>" frontend/src/pages/lots/LotDetailPage.tsx | head -50
```

**Step 2: Identify self-contained sections (likely tab contents)**

Look for patterns like:
- `{activeTab === 'itp' && (...)}`
- Large JSX blocks that can be isolated

**Step 3: Extract first component (e.g., ITP tab content)**

Create: `frontend/src/pages/lots/components/LotItpTab.tsx`

Move the ITP-related JSX and logic to this new component.

**Step 4: Import and use extracted component in LotDetailPage**

Replace the inline JSX with:
```typescript
import { LotItpTab } from './components/LotItpTab'

// In JSX:
{activeTab === 'itp' && <LotItpTab lot={lot} /* pass required props */ />}
```

**Step 5: Run Protector Agent**

**Step 6: Commit**
```bash
git add frontend/src/pages/lots/
git commit -m "refactor(lots): extract LotItpTab component from LotDetailPage

- Reduce LotDetailPage.tsx size
- Improve maintainability
- No logic changes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

**Step 7: Repeat for other tabs**
- LotTestResultsTab
- LotHoldPointsTab
- LotDocumentsTab
- LotNcrTab
- etc.

---

## Phase 3: Medium Priority Fixes

### Task 3.1: Replace TypeScript `any` with Proper Types

**Files:** 42 files identified in review

**Approach:** Fix one file at a time, starting with most critical (backend routes)

**Step 1: For each file, search for `any` usage**
```bash
grep -n ": any" backend/src/routes/lots.ts
```

**Step 2: Replace with proper Prisma types**
```typescript
// Before:
const whereClause: any = { projectId }

// After:
import { Prisma } from '@prisma/client'
const whereClause: Prisma.LotWhereInput = { projectId }
```

**Step 3: Run Protector Agent after each file**

**Step 4: Commit each file**

---

### Task 3.2: Add Missing Unit Tests

**Files without tests:**
- `backend/src/routes/company.ts`
- `backend/src/routes/comments.ts`
- `backend/src/routes/apiKeys.ts`
- `backend/src/routes/consent.ts`
- `backend/src/routes/drawings.ts`
- `backend/src/routes/auditLog.ts`
- `backend/src/routes/webhooks.ts`
- `backend/src/routes/notifications.ts`
- `backend/src/routes/support.ts`
- `backend/src/routes/pushNotifications.ts`
- `backend/src/routes/mfa.ts`
- `backend/src/routes/oauth.ts`
- `backend/src/routes/lotAssignments.ts`
- `backend/src/routes/dashboard.ts`
- `backend/src/routes/reports.ts`

**For EACH route file:**

**Step 1: Read the route file to understand endpoints**

**Step 2: Create test file following existing patterns**

Look at `backend/src/routes/auth.test.ts` for test patterns.

**Step 3: Write tests for happy path and error cases**

**Step 4: Run tests**
```bash
cd backend && pnpm test --run src/routes/[filename].test.ts
```

**Step 5: Run Protector Agent**

**Step 6: Commit**

---

### Task 3.3: Add E2E Tests for Critical Workflows

**Files:**
- Create: `frontend/e2e/ncr.spec.ts`
- Create: `frontend/e2e/holdpoints.spec.ts`
- Create: `frontend/e2e/claims.spec.ts`

**For EACH workflow:**

**Step 1: Identify the critical user journey**

**Step 2: Write Playwright test**

```typescript
// frontend/e2e/ncr.spec.ts
import { test, expect } from '@playwright/test'

test.describe('NCR Workflow', () => {
  test('can create NCR', async ({ page }) => {
    // Login
    // Navigate to NCRs
    // Create new NCR
    // Verify created
  })

  test('can update NCR status', async ({ page }) => {
    // ...
  })
})
```

**Step 3: Run E2E tests**
```bash
cd frontend && pnpm test:e2e --grep "NCR"
```

**Step 4: Commit**

---

## Phase 4: Low Priority Fixes

### Task 4.1: Standardize API Response Format

**Create:** `backend/src/lib/apiResponse.ts`

```typescript
export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    details?: unknown
  }
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export function successResponse<T>(data: T, pagination?: ApiResponse<T>['pagination']): ApiResponse<T> {
  return { success: true, data, pagination }
}

export function errorResponse(message: string, code: string, details?: unknown): ApiResponse<never> {
  return { success: false, error: { message, code, details } }
}
```

**Gradually migrate routes to use this format.**

---

### Task 4.2: Remove Console.log from Production Code

**Step 1: Find all console.log in backend routes**
```bash
grep -rn "console\.log" backend/src/routes/
```

**Step 2: Remove or replace with structured logging**

**Step 3: Run Protector Agent**

**Step 4: Commit**

---

### Task 4.3: Add Lazy Loading for Heavy Dependencies

**Files:**
- Modify: Routes that use jspdf, html2canvas, recharts, react-pdf

**Use React.lazy and Suspense:**
```typescript
const PDFViewer = React.lazy(() => import('./components/PDFViewer'))

// In JSX:
<Suspense fallback={<Loading />}>
  <PDFViewer />
</Suspense>
```

---

## Orchestrator Execution Protocol

### Starting the Remediation

```
You are the ORCHESTRATOR for SiteProof v3 codebase remediation.

CRITICAL RULES:
1. Run PROTECTOR AGENT after EVERY implementation task
2. If protector says HALT, STOP immediately and report
3. Execute tasks in PHASE ORDER (1 → 2 → 3 → 4)
4. Within each phase, tasks can run in parallel where safe
5. COMMIT after each successful task

PHASE 1 (Critical - Sequential):
1.1 → 1.2 → 1.3 → 1.4

PHASE 2 (High - Can parallelize validation tasks):
2.1 (validation) can run parallel agents for different route files
2.2 (pagination) is sequential - affects API contracts
2.3 (error handling) is independent
2.4 (refactoring) is HIGH RISK - sequential, one component at a time

PHASE 3 (Medium - Can parallelize):
3.1 (types) - parallel agents per file
3.2 (tests) - parallel agents per route
3.3 (e2e) - parallel agents per workflow

PHASE 4 (Low - Sequential):
4.1 → 4.2 → 4.3

For each task, dispatch:
1. Implementation Agent (does the work)
2. Protector Agent (verifies no breakage)

If ALL tasks complete successfully, create summary report.
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] DOMPurify installed and all dangerouslySetInnerHTML sanitized
- [ ] apiKeys.ts uses global auth middleware
- [ ] claims.ts has Zod validation on all endpoints
- [ ] All backend tests pass
- [ ] No TypeScript errors

### Phase 2 Complete When:
- [ ] All high-traffic routes have Zod validation
- [ ] All list endpoints support pagination
- [ ] Frontend error handling utility created
- [ ] LotDetailPage.tsx reduced by at least 50%
- [ ] All tests pass

### Phase 3 Complete When:
- [ ] TypeScript `any` usage reduced by 80%
- [ ] All routes have test files
- [ ] E2E tests cover NCR, hold points, claims workflows

### Phase 4 Complete When:
- [ ] API response format standardized
- [ ] Console.log removed from production
- [ ] Heavy dependencies lazy loaded

---

## Rollback Procedures

If protector detects failure:

```bash
# Rollback last commit
git reset --soft HEAD~1
git checkout -- .

# Or rollback to specific commit
git log --oneline -10  # Find safe commit
git reset --hard <commit-hash>
```

If multiple commits need rollback:
```bash
git reflog  # Find state before remediation started
git reset --hard <reflog-hash>
```

---

## Verification Commands

Run these at any point to verify codebase health:

```bash
# Backend
cd backend && pnpm tsc --noEmit && pnpm test --run

# Frontend
cd frontend && pnpm tsc --noEmit

# E2E (requires running servers)
cd frontend && pnpm test:e2e
```
