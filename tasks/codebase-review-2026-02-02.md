# SiteProof v3 Comprehensive Codebase Review

**Date:** 2026-02-02
**Version:** 1.0
**Reviewer:** Claude Opus 4.5 Automated Review

---

## Executive Summary

SiteProof v3 is a well-architected construction quality management platform with strong foundations. The codebase demonstrates good security practices with consistent authentication middleware usage, proper role-based access control, and encrypted storage patterns. However, there are significant opportunities for improvement in code quality (several files exceed 2000+ lines), test coverage expansion, and pattern standardization across the frontend.

### Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Backend Routes | 26 route files | Good coverage |
| Authentication Coverage | 100% of protected routes | Excellent |
| E2E Test Files | 6 spec files | Needs expansion |
| Files >500 lines | 4 critical files | Needs refactoring |
| TypeScript `any` usage | 42 files affected | Medium concern |
| Zod validation (backend) | 3/26 route files | Low - needs improvement |

---

## Critical Issues (Fix Immediately)

### 1. [CRITICAL] Limited Input Validation on Backend Routes
**Location:** Most files in `backend/src/routes/`
**Issue:** Only 3 out of 26 route files use Zod schema validation (`apiKeys.ts`, `consent.ts`, `diary.ts`). Most routes directly destructure `req.body` without validation.
**Risk:** SQL injection through Prisma is unlikely due to parameterized queries, but malformed data, type coercion issues, and business logic bypasses are possible.
**Fix:** Add Zod schemas for all route handlers that accept request bodies.

```typescript
// Example fix pattern for routes/claims.ts
import { z } from 'zod'

const createClaimSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  lotIds: z.array(z.string().uuid()),
  totalClaimedAmount: z.number().positive()
})

router.post('/:projectId/claims', async (req, res) => {
  const validation = createClaimSchema.safeParse(req.body)
  if (!validation.success) {
    return res.status(400).json({ error: validation.error.issues })
  }
  // ... use validation.data
})
```

### 2. [CRITICAL] dangerouslySetInnerHTML with User Content
**Location:** `frontend/src/pages/diary/DailyDiaryPage.tsx:1776`
**Issue:** User-provided `weatherForm.generalNotes` is rendered via `dangerouslySetInnerHTML` without sanitization.
**Risk:** XSS vulnerability if users can inject malicious scripts through the rich text editor.
**Fix:** Sanitize HTML before rendering using DOMPurify:

```typescript
import DOMPurify from 'dompurify'

// Safe rendering
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(weatherForm.generalNotes || '') }}
```

### 3. [CRITICAL] API Keys Route Missing Global Auth Middleware
**Location:** `backend/src/routes/apiKeys.ts`
**Issue:** The route file handles authentication inline instead of using `router.use(requireAuth)`. While the inline check works, it's inconsistent with other routes and could lead to missed protection on future endpoints.
**Fix:** Add `router.use(requireAuth)` at the top of the file like other route modules.

---

## High Priority (Fix This Sprint)

### 4. [HIGH] Massive File Sizes - Technical Debt
**Location:** Multiple frontend files
**Files requiring immediate refactoring:**

| File | Lines | Recommended Split |
|------|-------|-------------------|
| `frontend/src/pages/lots/LotDetailPage.tsx` | 4,516 | Extract tabs into separate components |
| `frontend/src/pages/lots/LotsPage.tsx` | 3,363 | Extract filters, table, modals |
| `frontend/src/lib/pdfGenerator.ts` | 2,915 | Split by PDF type (diary, lot, ncr) |
| `frontend/src/pages/diary/DailyDiaryPage.tsx` | 2,669 | Extract sections into components |

**Impact:** Code maintainability, review difficulty, cognitive load, bundle splitting inefficiency.

### 5. [HIGH] TanStack Query Underutilization
**Location:** `frontend/src/` - only 2 files use `useQuery`/`useMutation`
**Issue:** Most data fetching uses raw `fetch()` calls (67 files) instead of TanStack Query, missing benefits of:
- Automatic caching and deduplication
- Background refetching
- Optimistic updates
- Loading/error states

**Current state:**
- Files using TanStack Query: `LotDetailPage.tsx`, `AssignSubcontractorModal.tsx`
- Files using raw fetch: 67 files

**Fix:** Migrate data fetching to custom hooks using TanStack Query.

### 6. [HIGH] React Hook Form + Zod Only in Registration
**Location:** `frontend/src/pages/auth/RegisterPage.tsx`
**Issue:** Only the registration page uses the recommended React Hook Form + Zod pattern. All other forms use uncontrolled inputs or basic useState.
**Fix:** Standardize form handling across the application.

### 7. [HIGH] Missing Pagination on Several Endpoints
**Location:** `backend/src/routes/`
**Issue:** Only 10 route files implement `skip`/`take` pagination. Several endpoints return all records:

Endpoints lacking pagination:
- `GET /api/claims/:projectId/lots` - returns all lots
- `GET /api/lots` - returns all lots for project (with filters but no pagination)
- `GET /api/ncrs` - returns all NCRs
- `GET /api/dockets` - returns all dockets

**Fix:** Add cursor-based or offset pagination to all list endpoints.

### 8. [HIGH] Inconsistent Error Handling in Frontend
**Location:** `frontend/src/`
**Issue:** Error handling patterns vary significantly:
- 322 `catch` blocks across 82 files
- Only 6 files use `.catch()` promise pattern
- Many catch blocks only `console.error()` without user feedback

**Fix:** Create standardized error handling utilities:

```typescript
// lib/errorHandling.ts
export function handleApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) {
    toast.error(parseApiError(error))
  } else {
    toast.error(fallbackMessage)
    console.error(error)
  }
}
```

---

## Medium Priority (Plan for Next Sprint)

### 9. [MEDIUM] TypeScript `any` Usage
**Location:** 21 frontend files, 21 backend files
**Issue:** Extensive use of `any` type reduces TypeScript's effectiveness.

**Affected areas:**
- Frontend: `pdfGenerator.ts`, `LotDetailPage.tsx`, `LotsPage.tsx`, `DailyDiaryPage.tsx`
- Backend: `dashboard.ts`, `itp.ts`, `lots.ts`, `holdpoints.ts`

**Fix:** Replace `any` with proper types:
```typescript
// Instead of:
const whereClause: any = { projectId }

// Use:
const whereClause: Prisma.LotWhereInput = { projectId }
```

### 10. [MEDIUM] Missing Unit Tests for Backend Routes
**Location:** `backend/src/routes/`
**Issue:** Test files exist for some routes but coverage is incomplete:

**Routes WITH test files (13):**
- auth.test.ts, lots.test.ts, ncrs.test.ts, testResults.test.ts, dockets.test.ts
- subcontractors.test.ts, documents.test.ts, projects.test.ts, claims.test.ts
- diary.test.ts, itp.test.ts, holdpoints.test.ts, rbac.test.ts, integration.test.ts

**Routes WITHOUT test files (13):**
- company.ts, comments.ts, apiKeys.ts, consent.ts, drawings.ts
- auditLog.ts, webhooks.ts, notifications.ts, support.ts
- pushNotifications.ts, mfa.ts, oauth.ts, lotAssignments.ts, dashboard.ts, reports.ts

### 11. [MEDIUM] E2E Test Coverage Gaps
**Location:** `frontend/e2e/`
**Current coverage:** 6 spec files (auth, dashboard, lots, itp, diary, dockets)
**Missing coverage:**
- NCR workflow (critical business process)
- Hold points release workflow (critical compliance)
- Document upload/management
- Claims/payment workflow
- Subcontractor portal
- User management
- Settings pages

### 12. [MEDIUM] Prisma Query N+1 Potential
**Location:** `backend/src/routes/`
**Issue:** 151 `findMany/findFirst/findUnique` calls found. While most use `include:`, some patterns could be optimized:

Example from `dashboard.ts`:
```typescript
// Multiple sequential queries that could be combined
const lots = await prisma.lot.findMany({ where: { projectId } })
const ncrs = await prisma.ncr.findMany({ where: { projectId } })
const diaries = await prisma.dailyDiary.findMany({ where: { projectId } })
```

**Fix:** Combine into single query with includes or use `$transaction` for related data.

### 13. [MEDIUM] localStorage Sensitive Data Review
**Location:** `frontend/src/lib/auth.tsx`
**Files using localStorage:** 16 files
**Issue:** Auth token stored in localStorage (when "Remember Me" is checked). While common practice, tokens in localStorage are vulnerable to XSS attacks.

**Current implementation is reasonable** - tokens are also stored in sessionStorage for non-persistent sessions. Consider adding:
- Token rotation on sensitive operations
- Shorter expiration times
- HttpOnly cookie option for higher security environments

### 14. [MEDIUM] Missing Request Rate Limiting on Some Endpoints
**Location:** `backend/src/index.ts`
**Current:** Global rate limiter exists, `authRateLimiter` for auth routes.
**Issue:** Some high-risk endpoints should have specific rate limits:
- Password reset requests
- Magic link requests
- File uploads
- Report generation

---

## Low Priority (Technical Debt Backlog)

### 15. [LOW] Inconsistent API Response Formats
**Location:** Various route files
**Issue:** Response formats vary:
```typescript
// Some routes:
res.json({ lots: transformedLots })

// Others:
res.json(lots)

// Error responses vary too:
res.status(500).json({ error: 'Failed to fetch' })
res.status(500).json({ message: 'Error message' })
```

**Fix:** Standardize response wrapper:
```typescript
type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: { message: string; code: string }
}
```

### 16. [LOW] Duplicate Code Patterns
**Location:** Multiple frontend pages
**Issue:** Similar patterns repeated across pages:
- Loading states
- Error handling
- Data fetching setup
- Table rendering with filters

**Fix:** Create shared hooks and components.

### 17. [LOW] Missing API Documentation
**Location:** `backend/src/routes/`
**Issue:** No OpenAPI/Swagger documentation for the REST API.
**Fix:** Add swagger-jsdoc or similar for auto-generated API docs.

### 18. [LOW] Console Logging in Production Code
**Location:** Multiple files in `backend/src/routes/`
**Example:** `lots.ts` lines 52, 68, 69, 76, 77
**Issue:** Debug console.log statements left in production code.
**Fix:** Use structured logging (already have `logError` in errorHandler) and remove debug logs.

### 19. [LOW] Heavy Frontend Dependencies
**Location:** `frontend/package.json`
**Observations:**
- `jspdf` + `html2canvas` for PDF generation (large bundles)
- `recharts` for charts
- `react-pdf` for PDF viewing

**Recommendation:** Implement code-splitting and lazy loading for these heavy dependencies.

### 20. [LOW] Inconsistent Date Handling
**Location:** Various frontend and backend files
**Issue:** Mix of date handling approaches:
- `date-fns` (frontend)
- Native Date objects
- ISO string manipulation

**Fix:** Standardize on date-fns utilities and create shared formatters.

---

## Architecture Review Summary

### Strengths
1. **Clean separation of concerns** - Frontend/Backend split is clear
2. **Consistent auth middleware** - All protected routes use `requireAuth`
3. **Role-based access control** - Well-implemented with `requireRole` and `requireMinRole`
4. **Prisma ORM** - Prevents SQL injection, good schema design
5. **tRPC available** - Type-safe API option (though underutilized)
6. **Error logging** - Structured error handler with monitoring hooks

### Areas for Improvement
1. **Type sharing** - No shared types between frontend/backend
2. **API consistency** - Mix of REST and tRPC patterns
3. **State management** - Underutilizing Zustand and TanStack Query
4. **Component hierarchy** - Some pages are monolithic

---

## Testing Review Summary

### Current Coverage
- **Backend unit tests:** Present for 13/26 route files
- **E2E tests:** 6 spec files covering basic flows
- **Test quality:** Tests exist but are basic happy-path coverage

### Critical Test Gaps
1. **NCR workflow** - No E2E tests for non-conformance lifecycle
2. **Hold point release** - Critical compliance flow untested
3. **Claims/payments** - Financial workflow needs E2E coverage
4. **Error scenarios** - Few negative test cases
5. **Role-based access** - Limited RBAC testing

### Recommendations
1. Add integration tests for all route handlers
2. Expand E2E tests to cover critical business workflows
3. Add error scenario testing
4. Implement visual regression testing for UI components

---

## Pattern Consistency Review Summary

### Recommended Patterns (From CLAUDE.md)
| Pattern | Usage | Status |
|---------|-------|--------|
| `apiFetch` for API calls | 3 files | LOW - underutilized |
| React Hook Form + Zod | 1 file | LOW - only RegisterPage |
| TanStack Query | 2 files | LOW - underutilized |
| `useAuth` hook | Consistent | GOOD |
| `RoleProtectedRoute` | Consistent | GOOD |

### Anti-patterns Found
1. Raw `fetch()` instead of `apiFetch` (67 files)
2. Manual form state instead of React Hook Form
3. Inline data fetching instead of TanStack Query
4. Inconsistent error toast messages
5. Duplicated loading state patterns

---

## Prioritized Action Items

### Immediate (This Week)
1. Add DOMPurify sanitization to dangerouslySetInnerHTML usages
2. Add Zod validation to claims.ts route (highest traffic)
3. Add `router.use(requireAuth)` to apiKeys.ts for consistency

### Short-term (This Sprint)
4. Create pagination utilities for backend routes
5. Create shared data fetching hooks with TanStack Query
6. Start extracting components from LotDetailPage.tsx

### Medium-term (Next Sprint)
7. Add Zod validation to remaining route files
8. Replace `any` types in critical files
9. Add E2E tests for NCR and hold point workflows
10. Split pdfGenerator.ts into focused modules

### Long-term (Backlog)
11. Add OpenAPI documentation
12. Implement shared types package
13. Complete test coverage for all routes
14. Refactor remaining large files

---

## Appendix: File Line Counts

### Files Exceeding 500 Lines
```
frontend/src/pages/lots/LotDetailPage.tsx    ~4,516 lines
frontend/src/pages/lots/LotsPage.tsx         ~3,363 lines
frontend/src/lib/pdfGenerator.ts             ~2,915 lines
frontend/src/pages/diary/DailyDiaryPage.tsx  ~2,669 lines
```

### Backend Route Files by Complexity
```
routes/itp.ts          - ~1,900 lines (large, complex)
routes/diary.ts        - ~1,800 lines (large)
routes/claims.ts       - ~1,500 lines (large)
routes/ncrs.ts         - ~1,600 lines (large)
routes/holdpoints.ts   - ~1,300 lines (large)
routes/documents.ts    - ~1,100 lines (large)
routes/auth.ts         - ~1,400 lines (large)
```

---

**Report generated by Claude Opus 4.5**
**Review methodology:** Automated static analysis with grep, glob, and file reading tools.
