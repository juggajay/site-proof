# SiteProof v3 - Comprehensive Codebase Audit Report

**Date:** 2026-02-10
**Scope:** Full-stack security, performance, code quality, database, and DevOps analysis
**Last Updated:** 2026-02-11 (post-Phase 8 remediation)

> **AGENT INSTRUCTIONS — READ BEFORE WORKING ON AUDIT ITEMS**
>
> When you complete any item from this audit report:
> 1. Update the item's heading from `— DEFERRED` / `— PARTIAL` to `— RESOLVED (Phase N)` (use the next phase number or the current branch name)
> 2. Replace the `**Status:**` line with a `**Resolution:**` line describing what was done
> 3. In **Section 6 (Prioritized Action Plan)**: move the item from "Remaining — Deferred Items" to the appropriate "Completed" subsection with a strikethrough entry and `DONE` suffix
> 4. Update the **Executive Summary** counts at the top (RESOLVED / PARTIAL / DEFERRED)
> 5. Update the **Phases table** if a new phase was created
> 6. Update the **closing summary line** at the bottom with the new counts
> 7. If an item moves from DEFERRED to PARTIAL (not fully resolved), update the status text and keep it in the deferred list with a note about remaining work

---

## Executive Summary

SiteProof v3 is a well-structured construction management platform with solid fundamentals: Helmet security headers, HTTPS enforcement, structured error logging, auth middleware on all routes, parameterized SQL queries, and graceful shutdown handling. However, there are several areas that need attention across security, performance, and code quality.

**Total Issues Identified:** 92
- **Critical Issues:** 10
- **High Severity:** 33
- **Medium Severity:** 35
- **Low Severity:** 14

### Remediation Progress

| Status | Count | Description |
|--------|-------|-------------|
| RESOLVED | 49 | Fully addressed |
| PARTIAL | 5 | Partially addressed, remaining work noted |
| DEFERRED | 18 | Intentionally deferred (low value, high risk, or needs future planning) |

| Phase | Branch | Commit | Summary |
|-------|--------|--------|---------|
| Phase 1 | `fix/security-hotfixes` | `7b8e315` | Security fixes: XSS, auth, CORS, env cleanup |
| Phase 2 | `fix/performance-critical` | `854d7ee` | Pagination, query parallelization, body limits |
| Phase 3 | `fix/database-schema` | `695c80a` | onDelete strategies, indexes, constraints, migrations |
| Phase 4 | `refactor/code-quality` | `04ff631` | Type safety, error handling, dead code removal |
| Phase 5 | `chore/devops-setup` | `953bf78` | CI/CD, Dockerfile, env examples, dependency fixes |
| Phase 6 | `feat/architecture-improvements` | `9008142` | Component extraction, code splitting, checkProjectAccess |
| Safe Batch | `refactor/safe-batch` | `2019f5d` | apiFetch migration, as any removal, console.log cleanup, role guards |
| Phase 7 | `master` | `09cdf26` | Audit logging (D13), ESLint/Prettier (O10), tRPC removal (Q8), constant dedup (Q4) |
| Phase 8 | `master` | `e863bb7` | Component extraction (P2), virtualization (P3), memoization (P4) for 9 pages + 3 backend routes |
| Phase 9 | `master` | *pending* | Centralized error handler (Q2): AppError class, asyncHandler, errorHandler adoption across 35 routes + 29 tests + 22 frontend files |

---

## 1. SECURITY

### 1.1 Critical

#### [S1] XSS via RichTextEditor - No Sanitization — RESOLVED (Phase 1)
**File:** `frontend/src/components/ui/RichTextEditor.tsx:24-25`
**Severity:** CRITICAL

The RichTextEditor sets `innerHTML` directly from the `value` prop without any sanitization:
```tsx
editorRef.current.innerHTML = value
```
Unlike the QR code components and DailyDiaryPage which use `DOMPurify.sanitize()`, this component renders raw HTML. If any user-submitted rich text content is stored and displayed to other users, this is a stored XSS vulnerability.

**Fix:** Wrap all `innerHTML` assignments with `DOMPurify.sanitize(value)`.

**Resolution:** Added `DOMPurify.sanitize()` to all innerHTML assignments in RichTextEditor.

---

#### [S2] Unauthenticated Support Endpoint Allows User Enumeration — RESOLVED (Phase 1)
**File:** `backend/src/routes/support.ts:15-66`
**Severity:** CRITICAL

The `POST /api/support/request` endpoint has no authentication and accepts a `userEmail` parameter. It queries the database for that email and creates an audit log if found. While the response doesn't directly leak whether the user exists, the timing difference between a found vs. not-found user is exploitable for user enumeration.

**Fix:** Remove the user lookup from the unauthenticated endpoint, or require authentication.

**Resolution:** Removed user lookup from unauthenticated endpoint. Support requests now log without user linkage.

---

#### [S3] Metrics Endpoint Exposed Without Authentication — RESOLVED (Phase 1)
**File:** `backend/src/index.ts:180-183`
**Severity:** CRITICAL

```typescript
app.get('/api/metrics', (_req, res) => {
  const metrics = getPerformanceMetrics()
  res.json(metrics)
})
```

The `/api/metrics` endpoint exposes performance data (response times, endpoint usage patterns, error rates) to anyone without authentication. This is an information disclosure that aids attackers in identifying slow or problematic endpoints.

**Fix:** Add `requireAuth` and `requireRole(['owner', 'admin'])` middleware.

**Resolution:** Added `requireAuth` and `requireRole(['owner', 'admin'])` middleware to the metrics endpoint.

---

### 1.2 High

#### [S4] OAuth Mock Page Available in Production — RESOLVED (Phase 1)
**File:** `frontend/src/App.tsx:132`, `frontend/src/pages/auth/OAuthMockPage.tsx`
**Severity:** HIGH

The `/auth/oauth-mock` route is registered unconditionally in `App.tsx`. The `OAuthMockPage` calls `/api/auth/oauth/mock` which allows signing in with any email without real OAuth verification. If the backend endpoint is also not dev-gated, this is a full authentication bypass.

**Fix:** Wrap with `{import.meta.env.DEV && <Route path="/auth/oauth-mock" ... />}`.

**Resolution:** Wrapped OAuth mock route with `import.meta.env.DEV` guard in App.tsx.

---

#### [S5] Auth Tokens Stored in localStorage — DEFERRED
**File:** `frontend/src/lib/auth.tsx:200`
**Severity:** HIGH

JWT tokens are stored in `localStorage` (or `sessionStorage`), making them accessible to any JavaScript running on the page. If an XSS vulnerability exists (see S1), tokens can be exfiltrated.

**Fix:** Consider httpOnly cookies for token storage, or at minimum ensure all XSS vectors are eliminated.

**Status:** Deferred — requires significant architecture change (httpOnly cookies, CSRF protection, backend cookie handling). All known XSS vectors (S1, S9) have been resolved, reducing the risk.

---

#### [S6] Role Override Persists in localStorage — RESOLVED (Phase 1)
**File:** `frontend/src/lib/auth.tsx:18-23`, `frontend/src/components/dev/RoleSwitcher.tsx:22`
**Severity:** HIGH

The role override mechanism stores a role in `localStorage` under `siteproof_role_override`. While the code checks that only admin/owner users can use it, this check is client-side only. If this feature exists in production, a user could manually set this localStorage key. The backend should be the sole authority on roles.

**Fix:** Ensure RoleSwitcher is only included in development builds. Add `process.env.NODE_ENV !== 'production'` guard, or remove entirely.

**Resolution:** RoleSwitcher wrapped with `import.meta.env.DEV` guard. `getRoleOverride()` also gated to dev-only.

---

#### [S6] Consent Routes Use Manual Auth Check Instead of Middleware — RESOLVED (Phase 1)
**File:** `backend/src/routes/consent.ts:43-48`
**Severity:** HIGH

The consent router doesn't use `router.use(requireAuth)`. Instead, each route handler manually checks `(req as any).user?.id`. This pattern is error-prone - if a new route is added without this check, it will be unauthenticated.

**Fix:** Add `router.use(requireAuth)` at the top of the file like other route files.

**Resolution:** Added `router.use(requireAuth)` to consent routes. Replaced manual auth checks with `req.user!.id`.

---

#### [S7] Webhook In-Memory Storage Not Isolated by Company — PARTIAL (Phase 1)
**File:** `backend/src/routes/webhooks.ts:33-34`
**Severity:** HIGH

Webhook configurations are stored in a global `Map` without company isolation checks in all endpoints. A user from Company A could potentially view/modify webhooks from Company B if they guess the webhook ID.

**Fix:** Add company-scoped authorization checks to all webhook CRUD operations. Move to database storage.

**Resolution:** Added company-scoped authorization checks and sensitive header stripping. Max delivery log size capped at 100 entries. Database migration (P7) deferred.

---

#### [S8] CORS Allows 30+ localhost Origins — RESOLVED (Phase 1)
**File:** `backend/src/index.ts:80-120`
**Severity:** HIGH (Production Hygiene)

The CORS configuration includes ~30 localhost variants (ports 5173-5200). While not directly exploitable in production, this increases attack surface unnecessarily and suggests the CORS list should be environment-dependent.

**Fix:** Use environment-based CORS:
```typescript
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', ...devOrigins]
```

**Resolution:** Replaced hardcoded origins with environment-based CORS configuration.

---

### 1.3 Medium

#### [S9] Comment Link Parser - XSS via `javascript:` URLs — RESOLVED (Phase 1)
**File:** `frontend/src/components/comments/CommentsSection.tsx:502-504`
**Severity:** MEDIUM

The markdown link parser renders `<a href={url}>` where `url` is user-controlled from `[text](url)` patterns. A user could craft `[click me](javascript:alert(document.cookie))` to execute JavaScript.

**Fix:** Validate URLs before rendering - only allow `http:`, `https:`, and `mailto:` protocols.

**Resolution:** Added URL protocol validation allowing only `http:`, `https:`, and `mailto:` protocols.

---

#### [S10] Orphaned Auth Tokens Persist After Logout — RESOLVED (Phase 1)
**File:** `frontend/src/pages/auth/OAuthCallbackPage.tsx:24`, `frontend/src/pages/auth/MagicLinkPage.tsx:36-38`
**Severity:** MEDIUM

OAuth and Magic Link flows store tokens under `auth_token` (and `refresh_token`) in localStorage, but the main auth system uses `siteproof_auth`. The `clearAuthFromAllStorages()` logout function only clears `siteproof_auth`, leaving the duplicate tokens behind.

**Fix:** Remove standalone `localStorage.setItem('auth_token', ...)` calls (the `setToken()` method already handles it). Add cleanup of legacy keys to `clearAuthFromAllStorages()`.

**Resolution:** Removed standalone token storage. Added cleanup of `auth_token` and `refresh_token` keys to `clearAuthFromAllStorages()`.

---

#### [S11] No Token Refresh Mechanism — DEFERRED
**File:** `frontend/src/lib/auth.tsx`
**Severity:** MEDIUM

No JWT refresh token rotation exists. The `MagicLinkPage` stores a `refresh_token` but nothing ever uses it. If tokens are long-lived and stolen, they remain valid until expiry.

**Fix:** Implement token refresh flow: when `apiFetch` receives 401, attempt refresh before failing.

**Status:** Deferred — requires coordinated backend/frontend changes including refresh endpoint, token rotation, and apiFetch interceptor.

---

#### [S12] Password Reset Has Weaker Validation Than Registration — RESOLVED (Phase 1)
**File:** `frontend/src/pages/auth/ResetPasswordPage.tsx:58-60`
**Severity:** MEDIUM

Reset password requires only 8 characters with no complexity. Registration requires 12 characters + uppercase + lowercase + number. Users can downgrade password strength during reset.

**Fix:** Apply the same Zod schema from `RegisterPage.tsx` to `ResetPasswordPage.tsx`.

**Resolution:** Extracted shared password schema to `frontend/src/lib/validation.ts` and applied to both RegisterPage and ResetPasswordPage.

---

#### [S13] Many Protected Pages Lack Role Guards — RESOLVED (Safe Batch)
**Severity:** MEDIUM

Pages like lots, diary, ITP, hold-points, tests, NCR, documents, drawings, and reports are wrapped in `<ProtectedRoute>` (checks auth) but NOT `<RoleProtectedRoute>` (checks authorization). Any authenticated user including viewers and subcontractors can access via direct URL. Navigation menu hides links by role, but URL access isn't blocked.

**Fix:** Add `<RoleProtectedRoute>` wrappers to pages that shouldn't be accessible to all roles.

**Resolution:** Added `INTERNAL_ROLES` constant and wrapped lot edit route with `MANAGEMENT_ROLES` guard, foreman mobile route with `INTERNAL_ROLES` guard. Other core routes intentionally left open to all authenticated project members (backend enforces project-level access).

---

#### [S14] Only 1 Form Uses React Hook Form + Zod — DEFERRED
**Severity:** MEDIUM

Despite having `react-hook-form`, `@hookform/resolvers`, and `zod` as dependencies, only `RegisterPage.tsx` uses the `useForm` + `zodResolver` pattern. All other forms (login, reset, lot creation, NCR, dockets, diary, etc.) use manual `useState` with ad-hoc or no validation.

**Fix:** Progressively migrate forms, prioritizing: login, password reset, subcontractor invite, financial data entry.

**Status:** Deferred — large scope migration with risk of UI regressions. Each form needs individual attention and testing.

---

#### [S15] No CSRF Protection — DEFERRED
**Severity:** MEDIUM

JWT Bearer tokens provide natural CSRF resistance (browsers don't auto-attach custom headers). However, if auth migrates to cookies (recommended for XSS protection), CSRF protection becomes critical.

**Status:** Deferred — only becomes necessary if/when auth migrates to cookies (S5).

---

#### [S16] Missing Input Validation on Route Parameters — RESOLVED (Phase 4)
**Severity:** MEDIUM

Route parameters (`:projectId`, `:lotId`, `:diaryId`) are UUIDs but never validated before Prisma queries. Malformed IDs cause unnecessary database errors.

**Fix:** Add UUID validation middleware or Zod schema for route params.

**Resolution:** Added UUID validation middleware. Returns 400 for malformed IDs.

---

#### [S17] Webhook Test Receiver Stores All Headers — RESOLVED (Phase 1)
**File:** `backend/src/routes/webhooks.ts:62-70`
**Severity:** MEDIUM

The test receiver stores all request headers in memory, including potentially sensitive `Authorization` headers. Data lives in process memory indefinitely.

**Resolution:** Authorization headers now stripped from stored webhook delivery headers. Delivery log capped at 100 entries.

---

---

## 2. PERFORMANCE

### 2.1 Critical

#### [P1] Diary Endpoint Returns ALL Records - No Pagination — RESOLVED (Phase 2)
**File:** `backend/src/routes/diary.ts:120-132`
**Severity:** CRITICAL

The diary list endpoint loads **ALL diary entries** for a project with **7 related includes** (personnel, plant, activities, delays, deliveries, events, visitors), each with sub-includes. A 6-month project would have ~180 diary entries, each with dozens of related records. This could return megabytes in a single response. The search feature (line 135-170) also loads ALL records into memory first, then filters in JavaScript.

**Fix:** Add pagination using the existing `parsePagination` utility. Move search filtering to Prisma `where` clauses.

**Resolution:** Added pagination using `parsePagination` utility. Search filtering moved to Prisma `where` clauses.

---

### 2.2 High

#### [P2] Giant Component Files (14 files over 1,000 lines) — RESOLVED (Phase 8)
**Severity:** HIGH

All 9 monolithic frontend pages decomposed into orchestration shells with extracted components, hooks, types, and constants. 3 backend route files split into modular sub-files.

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `LotsPage.tsx` | 3,247 | 406 | 87% |
| `DailyDiaryPage.tsx` | 2,498 | 210 | 92% |
| `TestResultsPage.tsx` | 2,404 | 418 | 83% |
| `NCRPage.tsx` | 2,383 | 257 | 89% |
| `ReportsPage.tsx` | 1,583 | 331 | 79% |
| `ClaimsPage.tsx` | 1,557 | 235 | 85% |
| `ProjectSettingsPage.tsx` | 1,545 | 191 | 88% |
| `HoldPointsPage.tsx` | 1,519 | 384 | 75% |
| `SubcontractorsPage.tsx` | 1,416 | 241 | 83% |
| `diary.ts` (backend) | 1,868 | ~50 index | Split into 5 modules |
| `itp.ts` (backend) | 2,088 | ~50 index | Split into 5 modules |
| `ncrs.ts` (backend) | 1,782 | ~50 index | Split into 5 modules |

~80 new files created. All pages under 500 lines. Remaining oversized files: `LotDetailPage.tsx` (already refactored in Phase 6), `pdfGenerator.ts` (2,915 lines, deferred).

**Resolution:** Extracted sub-components, custom hooks (`useNCRData`, `useNCRActions`, `useNCRModals`, `useLotsData`, `useLotsActions`, `useDiaryData`, `useDiaryMobileHandlers`), types, and constants. Backend routes split into functional modules (core CRUD, workflow, evidence, analytics, reporting, submissions). Commit `e863bb7`.

---

#### [P3] No List Virtualization on Main Data Pages — RESOLVED (Phase 8)
**Severity:** HIGH

Added `@tanstack/react-virtual` (`useVirtualizer`) to 7 table/list components:
- `LotTable.tsx` — desktop table with expanded row support
- `LotMobileList.tsx` — mobile card grid
- `NCRTable.tsx` — NCR register table
- `NCRMobileList.tsx` — NCR mobile cards
- `TestResultsTable.tsx` — test results register
- `HoldPointsTable.tsx` — hold points table
- `SubcontractorList.tsx` — subcontractor cards with expandable sections

All use dynamic measurement (`measureElement`), appropriate `estimateSize` values, and `overscan` for smooth scrolling. Commit `e863bb7`.

---

#### [P4] Minimal React.memo / useMemo / useCallback Usage — RESOLVED (Phase 8)
**Severity:** HIGH

Applied memoization throughout all extracted components as part of the P2 extraction:
- `React.memo` on all table, list, modal, and tab components (~50+ components)
- `useMemo` on filtered/sorted data computations in all orchestration shells
- `useCallback` on all event handlers passed as props to child components
- Custom hooks encapsulate state and memoize return values

**Resolution:** Integrated into P2 component extraction. Every extracted component uses appropriate memoization. Commit `e863bb7`.

---

#### [P5] Documents, Hold Points, Test Results - No Pagination — RESOLVED (Phase 2 + Safe Batch)
**Severity:** HIGH

- `backend/src/routes/documents.ts:398` - `findMany` with no `skip`/`take`
- `backend/src/routes/holdpoints.ts:190` - Returns ALL lots with deep ITP includes
- `backend/src/routes/testResults.ts:356` - All test results fetched at once

Projects with hundreds/thousands of records will return unbounded response sizes.

**Fix:** Add pagination to all list endpoints.

**Resolution:** Pagination added to documents and test results in Phase 2. Hold points pagination added in Safe Batch (post-sort pagination via slice since hold points are built in-memory from lot/ITP relationships).

---

#### [P6] Rate Limiter In-Memory Store Won't Scale — PARTIAL (Phase 2)
**File:** `backend/src/middleware/rateLimiter.ts`
**Severity:** HIGH

The rate limiter uses an in-memory `Map`. Rate limits reset on every deploy, multiple instances don't share limits, and memory grows with unique IPs.

**Fix:** Use Redis-backed rate limiting (e.g., `rate-limiter-flexible` with Redis adapter).

**Resolution:** Added max Map size limit and periodic cleanup to prevent memory growth. Redis migration deferred — only needed when scaling to multiple instances.

---

#### [P7] Webhook Storage In-Memory Will Leak Memory — DEFERRED
**File:** `backend/src/routes/webhooks.ts:33-34`
**Severity:** HIGH

Webhook configs and delivery logs are in `Map` and `Array` in memory. The `webhookDeliveries` array has no size limit and will grow indefinitely, eventually causing OOM.

**Fix:** Move to database storage. Add max delivery log retention.

**Status:** Deferred — delivery log capped at 100 entries (S7 fix), reducing OOM risk. Full database migration deferred as webhooks feature has low usage currently.

---

### 2.3 Medium

#### [P8] Dashboard Endpoints - Sequential Query Waterfalls — RESOLVED (Phase 2)
**File:** `backend/src/routes/dashboard.ts`
**Severity:** MEDIUM

- Quality Manager dashboard (lines 931-1199): **~15 sequential** database queries
- Project Manager dashboard (lines 1203-1487): **~18+ sequential** queries
- The `/portfolio-risks` endpoint (line 454) correctly uses `Promise.all`, so the pattern exists but isn't consistently applied

**Fix:** Group independent queries into `Promise.all` batches.

**Resolution:** Grouped independent queries into `Promise.all` batches across all dashboard endpoints.

---

#### [P9] Missing Database Indexes (14+ missing) — RESOLVED (Phase 3)
**File:** `backend/prisma/schema.prisma`
**Severity:** MEDIUM

| Model | Missing Index | Why Needed |
|-------|--------------|------------|
| `Notification` | `[userId, isRead]` | Unread notification count |
| `Notification` | `[userId, createdAt]` | Sorted notification list |
| `AuditLog` | `[projectId, createdAt]` | Audit log listing |
| `AuditLog` | `[entityType, entityId]` | Entity audit trail |
| `Document` | `[projectId, documentType]` | Filtered queries |
| `Document` | `[projectId, lotId]` | Lot document lookup |
| `DailyDocket` | `[projectId, date]` | Docket date queries |
| `DailyDocket` | `[projectId, status]` | Pending docket queries |
| `ProjectUser` | `[userId]` | All projects for user (dashboard) |
| `SubcontractorUser` | `[userId]` | Sub company lookup |
| `ITPCompletion` | `[itpInstanceId, checklistItemId]` | Completion lookup |
| `TestResult` | `[projectId, status]` | Status filtering |
| `LotSubcontractorAssignment` | `[lotId, status]` | Active assignments |
| `ITPChecklistItem` | `[templateId]` | Template item lookup |

**Resolution:** All 14 indexes added in Phase 3 database migration.

---

#### [P10] No Caching Layer — DEFERRED
**Severity:** MEDIUM

No Redis, no in-memory cache, no memoization. Every API call hits the database directly. Hot paths needing cache:
- Dashboard stats (called every page load)
- Notification counts (polled regularly)
- Project access checks (called every request via `checkProjectAccess`)
- Static reference data

**Fix:** Add lightweight cache (e.g., `node-cache` with TTL) for project access checks (1 min), dashboard stats (30 sec), notification counts (15 sec).

**Status:** Deferred — checkProjectAccess optimized (P11), dashboard queries parallelized (P8). Caching layer adds complexity; best justified by profiling under production load.

---

#### [P11] checkProjectAccess Makes 2+ Queries Per Request — RESOLVED (Phase 6)
**File:** `backend/src/routes/diary.ts:86-101`
**Severity:** MEDIUM

Called on every diary route (20+ routes), makes 1-2 sequential queries per call.

**Fix:** Single query with join, or cache result per user/project for the request duration.

**Resolution:** Consolidated to shared utility with single optimized query. Result cached on `req` object for request duration.

---

#### [P12] Heavy Dependencies Not Code-Split — PARTIAL (Phase 6)
**Severity:** MEDIUM

- `framer-motion` (~130KB) - Only used on landing page, not in manual chunks
- `html2canvas` (~70KB) - Not in manual chunks
- `recharts`, `jspdf`, `react-pdf`, `supabase`, `date-fns`, `offline` are properly chunked (good)

**Fix:** Add to `manualChunks` in `vite.config.ts` or use dynamic imports.

**Resolution:** `framer-motion` added to manual chunks. `html2canvas` replaced with `html-to-image` (O16). Remaining bundle optimizations deferred.

---

#### [P13] Most Data Fetching Bypasses TanStack Query — DEFERRED
**Severity:** MEDIUM

Most pages use raw `apiFetch` + `useEffect` + `useState` instead of `useQuery` hooks, losing TanStack Query benefits: caching, deduplication, background refresh, prefetching. No `gcTime` configured (defaults to 5 min).

**Status:** Deferred — large-scale migration. Best done incrementally when touching individual pages. Now that apiFetch is universally adopted (Q3), migration to useQuery hooks is simpler.

---

#### [P14] 10MB JSON Body Limit — RESOLVED (Phase 2)
**File:** `backend/src/index.ts:136`
**Severity:** MEDIUM

A 10MB JSON body limit is excessive for API endpoints. File uploads use multipart separately.

**Fix:** Reduce to `1mb` for general API.

**Resolution:** Reduced to `1mb` for general API. File upload routes retain larger limits where needed.

---

#### [P15] Prisma Connection Pool Not Configured — RESOLVED (Phase 2)
**File:** `backend/src/lib/prisma.ts`
**Severity:** LOW

Default pool is `num_cpus * 2 + 1`. On a small Railway instance, could be as few as 3 connections.

**Fix:** Set `?connection_limit=10&pool_timeout=30` in DATABASE_URL.

**Resolution:** Configuration guidance added to `.env.example` and documented.

---

---

## 3. CODE QUALITY

### 3.1 High

#### [Q1] 91+ `as any` Casts + 75 Unnecessary `(req as any)` Casts — RESOLVED (Phase 4 + Safe Batch)
**Severity:** HIGH

| Pattern | Count |
|---------|-------|
| `as any` in backend routes | 91 |
| `(req as any).user` casts | 75 across 11 files |
| `const whereClause: any` | 8 files |
| `as any` in frontend | 15 |

The `(req as any).user` casts are **completely unnecessary** - `authMiddleware.ts` already extends Express `Request` with the `user` property via `declare global`. The `diary.ts` file alone has 37 `as any` casts.

**Fix:** Remove all `(req as any)` - use `req.user` directly. Replace `whereClause: any` with `Prisma.XxxWhereInput` types.

**Resolution:** Phase 4 removed all `(req as any).user` casts (75 occurrences) across 11 files. Safe Batch addressed remaining casts: added `apiKey` to Express.Request type, fixed consent.ts typed `where` clause, removed unnecessary casts in diary.ts, itp.ts, reports.ts, subcontractors.ts. TypeScript compiles clean.

---

#### [Q2] Centralized Error Handler NEVER Used (326 Inline Error Responses) — RESOLVED
**Severity:** HIGH

The well-designed `errorHandler.ts` middleware exists but **zero routes** use `next(error)`. Instead, **326 occurrences** of `res.status(500).json(...)` are scattered across route files. Error response formats are inconsistent:
- Some use `{ error: 'message' }`
- Some use `{ error: 'title', message: 'detail' }`
- Some use `{ error: 'title', details: [...] }`
- `apiResponse.ts` defines another format nobody uses

The `errorHandler` in `index.ts:228` only catches unhandled exceptions.

**Fix:** Adopt `next(error)` pattern. Use the existing `apiResponse.ts` utility for consistent responses.

**Resolution:** Full centralized error handling migration completed. Created `AppError` class (`backend/src/lib/AppError.ts`) with factory methods and `asyncHandler` wrapper (`backend/src/lib/asyncHandler.ts`). Updated `errorHandler.ts` to handle AppError, ZodError, and Prisma errors with consistent `{ error: { message, code, details? } }` response format. Migrated all 35 route files (357 asyncHandler usages), updated all 29 test files, updated auth/validateParams/rateLimiter middleware to throw AppError. Deleted unused `apiResponse.ts`. Frontend: enhanced `ApiError` with pre-parsed `data` field, added `extractErrorDetails()`/`extractErrorCode()` helpers, adopted `extractErrorMessage`/`handleApiError` across ~25 frontend files. Only 2 intentional inline responses remain in `auth.ts` (`{ valid: false }` token validation — success responses, not errors). All 840 tests pass, zero type errors.

---

#### [Q3] 40+ Frontend Files Use Raw `fetch()` Instead of `apiFetch` — RESOLVED (Safe Batch)
**Severity:** HIGH

Despite having `apiFetch` utility in `@/lib/api`, only **4 files** use it. **40+ files** repeat this boilerplate:
```tsx
const token = getAuthToken()
const response = await fetch(apiUrl('/api/...'), {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
})
```

This skips error handling, doesn't use `ApiError`, and duplicates auth logic everywhere.

**Fix:** Migrate all raw fetch calls to `apiFetch`. This alone would eliminate hundreds of lines.

**Resolution:** Migrated 315 raw `fetch()` calls across ~55 files to `apiFetch`. 33 remaining fetch calls are legitimate: `api.ts` (apiFetch implementation itself), `auth.tsx` (auth module), `useOfflineStatus.ts` (offline sync), `pushNotifications.ts` (push API), `OAuthMockPage.tsx` (dev-only), 7 files with FormData uploads (must use raw fetch as apiFetch sets Content-Type: application/json), and 1 blob download. Net result: 1,827 insertions, 5,036 deletions.

---

#### [Q4] Duplicated Constants Across Files — RESOLVED (Phase 4 + Phase 7)
**Severity:** HIGH

| Duplicated Item | Locations |
|-----------------|-----------|
| `TIER_PROJECT_LIMITS` / `TIER_USER_LIMITS` | `company.ts` lines 11-24, `projects.ts` lines 684-689 |
| `roles.ts` (role constants) | `backend/src/lib/roles.ts` (unused!), `frontend/src/lib/roles.ts` |
| `ROLE_HIERARCHY` | `backend/src/lib/roles.ts`, `backend/src/middleware/authMiddleware.ts:103`, `frontend/src/lib/roles.ts` |
| `checkProjectAccess` | Reimplemented in `diary.ts:86-101`, likely in other routes too |

The frontend `roles.ts` comment says "MUST be kept in sync with backend" - a recipe for drift.

**Fix:** Extract shared constants to single sources. The backend `roles.ts` and `roleFilters.ts` exist but are unused - adopt or remove them.

**Resolution:** `checkProjectAccess` consolidated to shared utility (P11). Tier limits centralized to `backend/src/lib/tierLimits.ts` and imported by `company.ts` and `projects.ts`. Role group arrays (COMMERCIAL_ROLES, MANAGEMENT_ROLES, FIELD_ROLES) centralized in `roles.ts` with ROLE_GROUPS and hasRoleInGroup helpers. Minor remaining: ROLE_HIERARCHY still duplicated in `authMiddleware.ts` vs `roles.ts`.

---

#### [Q5] 10+ Unused Utility Modules — RESOLVED (Safe Batch)
**Severity:** HIGH

Well-designed utilities that are never imported:

| File | Description | Status |
|------|-------------|--------|
| `backend/src/lib/apiResponse.ts` | Standardized response helpers - **0 imports** | Kept (useful for Q2) |
| `backend/src/lib/roleFilters.ts` | Role-based filtering - **0 imports** | Kept (useful utility) |
| `backend/src/lib/featureFlags.ts` | Feature flag system - **0 imports** | **Deleted** |
| `backend/src/lib/roles.ts` | Role constants - **0 imports** from routes | Kept (used by middleware) |
| `backend/src/lib/pagination.ts` | Pagination - **only 3 of 27** routes use it | Adopted (now used by 6+ routes) |
| `frontend/src/lib/colors.ts` | Color palette (115 lines) - **0 imports** | **Deleted** |
| `frontend/src/lib/storage.ts` | localStorage wrapper (102 lines) - **0 imports** | **Deleted** |
| `frontend/src/lib/foremanFeatures.ts` | Feature visibility (107 lines) - **0 imports** | **Deleted** |
| `frontend/src/lib/pushNotifications.ts` | Push utils - **0 imports** | Kept (imported by PushNotificationSettings.tsx) |
| `frontend/src/hooks/useAsync.ts` | Async hooks - **0 imports** | **Deleted** |

**Resolution:** 5 unused files deleted. `pagination.ts` adopted in multiple routes (P1, P5). `apiResponse.ts` and `roleFilters.ts` retained for future adoption.

---

#### [Q6] No Service Layer - All Business Logic in Route Handlers — DEFERRED
**Severity:** HIGH

**12 backend route files exceed 1,500 lines.** Zod schemas, DB queries, authorization, business logic, and response formatting are all interleaved. Top offenders:

| Route File | Lines |
|------------|-------|
| `testResults.ts` | 2,590 |
| `itp.ts` | 2,050 |
| `holdpoints.ts` | 1,977 |
| `lots.ts` | 1,937 |
| `notifications.ts` | 1,913 |
| `diary.ts` | 1,885 |
| `dockets.ts` | 1,796 |
| `ncrs.ts` | 1,782 |

**Fix:** Extract business logic into `services/` modules. Routes become thin HTTP adapters.

**Status:** Deferred — largest architectural change in the codebase. High value but also highest risk. Should be done file-by-file with comprehensive test coverage per route.

---

### 3.2 Medium

#### [Q7] 200+ console.log in Production Code — RESOLVED (Safe Batch)
**Severity:** MEDIUM

| Area | Count | Worst Offender |
|------|-------|----------------|
| Backend `src/` | 163 across 10 files | `email.ts`: **143** (logs entire email bodies) |
| Frontend `src/` | 41 across 18 files | `toaster.tsx`: logs every toast shown |

**Fix:** Remove debug logs. Gate remaining logs behind `NODE_ENV` or `import.meta.env.DEV`.

**Resolution:** All 143 console.logs in `email.ts` wrapped in `process.env.NODE_ENV !== 'production'` guards (dev email preview blocks, operational logs). Server startup/shutdown logs in `index.ts` kept (standard practice). Security log in `rateLimiter.ts` kept. Frontend had 0 console.logs (previously cleaned in Phase 4).

---

#### [Q8] tRPC Router is Dead Code — RESOLVED (Phase 7)
**File:** `backend/src/trpc/router.ts` (deleted)
**Severity:** MEDIUM

The entire tRPC infrastructure (router, context, imports in `index.ts`) contains only TODO stubs returning empty arrays. All real API work uses Express REST routes.

**Fix:** Remove tRPC entirely, or commit to implementing it.

**Resolution:** Deleted entire `backend/src/trpc/` directory (context.ts, router.ts). Removed `@trpc/server` dependency. Removed tRPC middleware mount from `index.ts` and `/trpc` proxy from frontend `vite.config.ts`. 122 lines deleted across 6 files.

---

#### [Q9] TanStack Query + Zustand Barely Used — PARTIAL (Phase 7)
**Severity:** MEDIUM

Despite CLAUDE.md stating "TanStack Query (server), Zustand (client)":
- `useQuery`/`useMutation`: Only **11 occurrences in 3 files**
- **Zustand: 0 imports found anywhere** (at time of audit)
- Actual pattern: `useState` + `useEffect` + raw `fetch` on every page

This means no request deduplication, no caching, no background refetch, no optimistic updates.

**Fix:** Migrating to TanStack Query hooks would reduce page component code by ~30-40% while improving UX.

**Resolution (partial):** Zustand now implemented with 2 active stores (`uiStore.ts`, `foremanMobileStore.ts`) consumed by 10+ components. TanStack Query adoption still minimal (3 files). TanStack Query migration (P13) best done page-by-page.

---

#### [Q10] CLAUDE.md Inaccuracies — RESOLVED (Phase 4)
**Severity:** MEDIUM

- References `authenticateToken` but actual middleware is `requireAuth`
- Says frontend runs on `:5173` but Vite config is `:5174`
- Says state management is "TanStack Query + Zustand" but Zustand isn't used
- API example shows `apiFetch` but 40+ files use raw `fetch`

**Resolution:** Fixed all inaccuracies: `authenticateToken` → `requireAuth`, port → 5174 (now 5173 after standardization), removed Zustand reference, updated API examples.

---

#### [Q11] Deprecated `document.execCommand` Usage — DEFERRED
**File:** `frontend/src/components/ui/RichTextEditor.tsx:30`
**Severity:** MEDIUM

`document.execCommand` is deprecated. Consider TipTap, Lexical, or Slate.

**Status:** Deferred — functional for current needs. Replacement with TipTap or Lexical is a significant effort best planned as a dedicated feature.

---

#### [Q12] Only 6 E2E Specs, 0 Frontend Unit Tests — DEFERRED
**Severity:** MEDIUM

Missing E2E coverage for: NCRs, Claims, Documents, Drawings, Subcontractors, Reports, Hold Points, Test Results, Project Settings, Company Settings. No component or hook unit tests at all.

**Status:** Deferred — backend has 841 unit tests providing good coverage. Frontend testing expansion is valuable but is an ongoing effort rather than a single task.

---

---

## 4. DATABASE SCHEMA

### 4.1 Critical

#### [D1] User->Company and Project->Company Relations Missing onDelete — RESOLVED (Phase 3)
**Severity:** CRITICAL

- `User.company` relation (line 58) has no `onDelete` - deleting a company leaves orphaned users with invalid `companyId`
- `Project.company` relation (line 156) has no `onDelete` - projects cascade to lots/NCRs/diaries, making this a major chain-delete concern

PostgreSQL's default Prisma behavior is to throw FK violations, meaning companies cannot be deleted while users/projects exist - with no explicit handling.

**Fix:** Add `onDelete: SetNull` on User->Company (companyId is nullable). Add `onDelete: Cascade` or `onDelete: Restrict` on Project->Company with explicit intent.

**Resolution:** Added `onDelete: SetNull` on User->Company. Added `onDelete: Restrict` on Project->Company (prevents accidental company deletion).

---

#### [D2] 30+ FK Relations Missing onDelete Strategy — RESOLVED (Phase 3)
**Severity:** CRITICAL

The following are the most dangerous missing `onDelete` definitions:

| Child Model | FK Field | Parent | Risk |
|-------------|----------|--------|------|
| `Lot` | `createdById`, `conformedById` | `User` | Can't delete any user who created/conformed a lot |
| `NCR` | 8 user FK fields | `User` | Can't delete any user who touched an NCR |
| `DailyDiary` | `submittedById` | `User` | Can't delete diary submitter |
| `TestResult` | `enteredById`, `verifiedById`, `rejectedById` | `User` | Can't delete users |
| `Document` | `uploadedById` | `User` | Can't delete uploader |
| `AuditLog` | `userId` | `User` | Deleting user breaks audit trail |
| `Lot` | `itpTemplateId` | `ITPTemplate` | Can't archive/delete templates |
| `ITPInstance` | `templateId` | `ITPTemplate` | Can't delete template |
| `Drawing` | `documentId` | `Document` | Can't delete source document |
| `Comment` | `parentId` | `Comment` | Deleting parent orphans replies |

This means **user deletion is effectively impossible** once they've touched any data. In practice, this likely causes 500 errors when attempting user cleanup.

**Fix:** Add `onDelete: SetNull` for user references in audit/history fields. Add `onDelete: Cascade` for structural parent-child relationships.

**Resolution:** Added `onDelete: SetNull` for all user reference fields (createdById, submittedById, etc.). Added `onDelete: Cascade` for structural parent-child relationships. Added `onDelete: Restrict` for Project->Company.

---

### 4.2 High

#### [D3] String Fields That Should Be Enums (20+ fields) — DEFERRED
**Severity:** HIGH

No Prisma `enum` is defined anywhere in the schema. 20+ fields use free-form `String` for status/type fields with well-defined value sets, meaning invalid values can be written to the database:

| Model | Field | Expected Values |
|-------|-------|-----------|
| `User` | `roleInCompany` | owner, admin, project_manager, site_manager, foreman, subcontractor, etc. |
| `Lot` | `status` | not_started, in_progress, hold, conformed, rejected |
| `NCR` | `status` | open, responded, under_review, rectification, verified, closed |
| `NCR` | `severity` | minor, major |
| `DailyDiary` | `status` | draft, submitted, locked |
| `DailyDocket` | `status` | draft, submitted, approved, rejected |
| `HoldPoint` | `status`, `pointType` | pending/released, hold/witness |
| `ProgressClaim` | `status` | draft, submitted, certified, paid, disputed |
| `TestResult` | `status`, `passFail` | requested/completed/verified, pending/pass/fail |
| `Document` | `documentType` | photo, report, certificate, drawing, etc. |
| `Company` | `subscriptionTier` | basic, professional, enterprise |

**Fix:** Define Prisma enums for each. Example: `enum LotStatus { not_started in_progress hold conformed rejected }`

**Status:** Deferred — high risk of breaking existing data. Requires auditing all existing values in production database before migration. Any unexpected values would cause migration failures. Application code also uses string comparisons throughout.

---

#### [D4] No Soft Delete on Compliance-Critical Records — DEFERRED
**Severity:** HIGH

Only `Comment` has soft delete (`deletedAt`). For a construction compliance platform with regulatory requirements, hard-deleting these records has legal implications:
- **NCR** - Non-conformance reports are compliance records
- **Lot** - Lots with test results, hold point history, ITP completions
- **DailyDiary** - Legal/regulatory daily site records
- **DailyDocket** - Financial records of subcontractor work
- **ProgressClaim** - Financial claims for payment
- **TestResult** - Laboratory test records
- **Document** - Evidence documents
- **HoldPoint** - Regulatory hold point records
- **User** - Should be deactivated, not deleted, to preserve audit trails

**Fix:** Add `deletedAt DateTime? @map("deleted_at")` to these models. Add Prisma client extension to auto-filter.

**Status:** Deferred — requires Prisma client extension/middleware for auto-filtering, plus updating every query across all routes. High complexity with risk of data visibility bugs. The onDelete strategies (D1, D2) already prevent accidental cascade deletion.

---

#### [D5] SubcontractorUser Missing Unique Constraint — RESOLVED (Phase 3)
**Severity:** HIGH

No `@@unique([subcontractorCompanyId, userId])` - the same user can be added to the same subcontractor company multiple times, creating duplicate records.

**Fix:** Add `@@unique([subcontractorCompanyId, userId])`.

**Resolution:** Added `@@unique([subcontractorCompanyId, userId])` to SubcontractorUser model.

---

#### [D6] ScheduledReport is an Orphaned Model (No FK Relations) — RESOLVED (Phase 3)
**Severity:** HIGH

`ScheduledReport` has `projectId` and `createdById` fields but NO Prisma relations. This means: no referential integrity (can reference deleted projects/users), no cascading deletes, no Prisma include/join support.

**Fix:** Add proper relations with `onDelete: Cascade` for project and `onDelete: SetNull` for user.

**Resolution:** Added proper FK relations with `onDelete: Cascade` for project and `onDelete: SetNull` for createdBy user.

---

#### [D7] No Schema-Level Multi-Tenancy Enforcement — DEFERRED
**Severity:** HIGH

Company isolation relies entirely on application-level checks. No RLS policies, no constraints ensuring User's company matches Project's company. A single query bug leaks data cross-company.

**Fix:** Add Supabase RLS policies. Consider Prisma Client Extensions to auto-inject `companyId` filters. Consider denormalizing `companyId` onto key tables (Lot, NCR, Document) for direct tenant filtering.

**Status:** Deferred — requires Supabase RLS policy design, testing with existing queries, and careful migration. Application-level checks (checkProjectAccess) are now consolidated and optimized (P11).

---

### 4.3 Medium

#### [D8] Missing Unique Constraints — RESOLVED (Phase 3)
**Severity:** MEDIUM

- `GlobalSubcontractor`: No `@@unique([organizationId, companyName])` - same sub can be created twice
- `ClaimedLot`: No `@@unique([claimId, lotId])` - lot can be claimed multiple times in same claim

**Resolution:** Added both unique constraints.

---

#### [D9] JSON Stored as String Fields (7 fields) — DEFERRED
**Severity:** MEDIUM

These fields store JSON as `String` with "for SQLite" comments, despite using PostgreSQL:
`Project.settings`, `AuditLog.changes`, `SyncQueue.payload`, `TestResult.aiConfidence`, `Document.tags`, `ITPInstance.templateSnapshot`, `HoldPoint.escalatedTo`

Note: `SubcontractorCompany.portalAccess` correctly uses `Json?`.

**Fix:** Change from `String?` to `Json?` for native JSONB support.

**Status:** Deferred — requires data migration and updating all code that reads/writes these fields. Low runtime impact since JSON.parse/stringify already works.

---

#### [D10] Comma-Separated Values in String Fields — DEFERRED
**Severity:** MEDIUM

- `ApiKey.scopes`: `"read,write,admin"` - should be `String[]` or separate model
- `Project.workingDays`: `"1,2,3,4,5"` - should be `Int[]`
- `ScheduledReport.recipients`: comma-separated emails - should be `String[]`

**Status:** Deferred — requires data migration and updating all split/join logic. Low runtime impact.

---

#### [D11] Missing `updatedAt` / Timestamps on Many Models — DEFERRED
**Severity:** MEDIUM

**9 models have no timestamps at all:** `ITPChecklistItem`, `DiaryVisitor`, `DocketLabour`, `DocketLabourLot`, `DocketPlant`, `DocketPlantLot`, `ClaimedLot`, `NCRLot`, `ITPCompletionAttachment`

**12 models have `createdAt` but no `updatedAt`:** `DiaryPersonnel`, `DiaryPlant`, `DiaryActivity`, `DiaryDelay`, `EmployeeRoster`, `PlantRegister`, `SubcontractorUser`, `ApiKey`, `Notification`, `ConsentRecord`, `ProjectArea`, `HoldPointReleaseToken`

**Status:** Deferred — adding timestamps to existing tables requires data migration (new columns need defaults). Low impact on current functionality.

---

#### [D12] No Migration Files in Version Control — RESOLVED (Phase 3 + Phase 5)
**Severity:** MEDIUM

No migration SQL files found in `prisma/migrations/`. Schema may be applied via `prisma db push` which is not reproducible or reviewable.

**Fix:** Switch to `prisma migrate deploy` for production. Check migration files into git.

**Resolution:** Removed `backend/prisma/migrations/` from `.gitignore`. Migration files generated and committed for all Phase 3 schema changes. CI pipeline runs `prisma migrate deploy`.

---

#### [D13] Audit Logging Gaps and Silent Failures — RESOLVED (Phase 3 + Phase 7)
**Severity:** MEDIUM

- Audit log writes are in try/catch that silently swallows errors (`console.error` only)
- Missing audit entries for: ITP completions, hold point releases, document deletions, test result modifications, progress claim submissions, subcontractor approvals, role changes
- `AuditLog.userId` has no `onDelete` - deleting a user breaks audit trail

**Fix:** Make audit writes non-optional for sensitive ops. Add `onDelete: SetNull` to preserve audit records. Expand `AuditAction` constants.

**Resolution:** Phase 3: Added `onDelete: SetNull` to `AuditLog.userId` relation. Phase 7: Added 26 new `AuditAction` constants and `createAuditLog()` calls to 25 route handlers across 6 files: ITP completions (3 routes), hold point releases (6 routes), document deletions (1 route), test result modifications (6 routes), claim submissions (4 routes), subcontractor approvals (5 routes). Commit `09cdf26`.

---

---

## 5. DEVOPS & DEPENDENCIES

### 5.1 Critical

#### [O1] No CI/CD Pipeline — RESOLVED (Phase 5)
**Severity:** CRITICAL

No `.github/workflows/`, no CI configuration of any kind. The 252 backend unit tests and E2E tests are only run manually. No type-checking, linting, or build verification on PRs.

**Fix:** Create `.github/workflows/ci.yml` with: `pnpm install`, `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build` for both projects.

**Resolution:** Created `.github/workflows/ci.yml` with full pipeline: checkout, pnpm setup, install, type-check, test, build for both frontend and backend.

---

#### [O2] No Dockerfile or Container Configuration — RESOLVED (Phase 5)
**Severity:** CRITICAL

No `Dockerfile`, `docker-compose.yml`, or `nixpacks.toml`. Railway auto-detects the build, but this means no reproducible builds, no local production parity, and devDependencies likely ship to production.

**Fix:** Create multi-stage `Dockerfile` for backend. Consider `docker-compose.yml` for local dev with PostgreSQL.

**Resolution:** Created multi-stage `Dockerfile` for backend (install → build → production runtime). Created `docker-compose.yml` for local dev with PostgreSQL.

---

#### [O3] `.env.production` Committed to Git — RESOLVED (Phase 1)
**File:** `frontend/.env.production`
**Severity:** CRITICAL

The `.env.production` file is committed to git with the Supabase anon key. While anon keys are designed to be public, this normalizes committing env files and could lead to service keys being accidentally committed. The `.gitignore` patterns (`*.env`, `.env.local`) do NOT match `.env.production`.

**Fix:** Add `.env.production` to `.gitignore`. Use Vercel/Railway environment variable management instead.

**Resolution:** Added `.env.production` to `.gitignore`. Removed from git tracking.

---

### 5.2 High

#### [O4] Prisma Migrations Gitignored — RESOLVED (Phase 3)
**File:** `.gitignore:40`
**Severity:** HIGH

`backend/prisma/migrations/` is in `.gitignore`. Migrations represent the authoritative history of schema changes. Without them: new devs can't set up a DB, no migration consistency verification, production can't run `prisma migrate deploy`.

**Fix:** Remove from `.gitignore`. Commit migration history. Use `prisma migrate deploy` in production.

**Resolution:** Removed from `.gitignore`. Migration files committed.

---

#### [O5] `.gitignore` Missing Key Entries — RESOLVED (Phase 1)
**Severity:** HIGH

Missing entries that appear as untracked in git status:
- `backend/uploads/` - user-uploaded files
- `.playwright-mcp/` - debug screenshots (many visible in git status)
- `nul` - Windows artifact
- `playwright-report/` and `test-results/`

**Resolution:** All entries added to `.gitignore`.

---

#### [O6] `@types/*` Packages in Production Dependencies — RESOLVED (Phase 5)
**File:** `backend/package.json`
**Severity:** HIGH

Three `@types/*` packages (`@types/bcryptjs`, `@types/qrcode`, `@types/web-push`) are in `dependencies` instead of `devDependencies`. Ships unnecessary bytes to production.

**Resolution:** Moved to `devDependencies`. Removed `@types/bcryptjs` entirely (v3 bundles types).

---

#### [O7] `@types/bcryptjs` v2 Types with bcryptjs v3 — RESOLVED (Phase 5)
**File:** `backend/package.json`
**Severity:** HIGH

Project uses `bcryptjs@^3.0.3` (v3) but `@types/bcryptjs@^2.4.6` (types for v2). bcryptjs v3 had API changes and ships its own types.

**Fix:** Remove `@types/bcryptjs` - v3 bundles its own TypeScript types.

**Resolution:** Removed `@types/bcryptjs`.

---

#### [O8] TanStack React Query v4 (End of Life) — DEFERRED
**File:** `frontend/package.json`
**Severity:** HIGH

`@tanstack/react-query@^4.36.1` is end-of-life. v5 has been stable since late 2023 with smaller bundle, better TS inference. No security patches on v4.

**Fix:** Upgrade to v5 following the migration guide.

**Status:** Deferred — v5 migration has breaking API changes. Best done alongside P13 (TanStack Query adoption) to avoid migrating twice.

---

#### [O9] Port Mismatch Across Configs (5173 vs 5174) — RESOLVED (Phase 1)
**Severity:** HIGH (DX confusion)

- `vite.config.ts`: port **5174**
- `CLAUDE.md`: says "runs on :5173"
- `playwright.config.ts`: uses 5174
- Backend CORS: includes both ports

**Fix:** Pick one port. Update CLAUDE.md to match reality.

**Resolution:** Standardized port across all configurations. Updated CLAUDE.md to match.

---

#### [O10] No ESLint Config Files + Deprecated Versions — RESOLVED (Phase 7)
**Severity:** HIGH

ESLint v8 + typescript-eslint v6 (both deprecated). No `.eslintrc` files exist - lint scripts may silently do nothing. No `.prettierrc` either.

**Fix:** Create ESLint config. Upgrade to ESLint v9 + typescript-eslint v8. Add Prettier config.

**Resolution:** Upgraded to ESLint v9 flat config (`eslint.config.js`) with typescript-eslint v8. Added Prettier v3 config (`.prettierrc`). Both backend and frontend have working lint/format scripts.

---

### 5.3 Medium

#### [O11] No `.env.example` Files — RESOLVED (Phase 5)
**Severity:** MEDIUM

No `.env.example` in either project. New developers have no way to know required environment variables without reading source code.

**Resolution:** Created `backend/.env.example` and `frontend/.env.example` with all required variables documented.

---

#### [O12] No Frontend Unit Tests — DEFERRED
**Severity:** MEDIUM

Frontend only has E2E tests (Playwright). No Vitest component tests. For this project size, unit tests would catch bugs faster.

**Status:** Deferred — ongoing effort. Backend has 841 unit tests. Frontend testing best added incrementally.

---

#### [O13] Playwright Config Uses `npm` Instead of `pnpm` — RESOLVED (Phase 5)
**File:** `frontend/playwright.config.ts:22`
**Severity:** MEDIUM

`command: 'npm run dev'` should be `pnpm run dev` to match the project's package manager.

**Resolution:** Changed `npm` to `pnpm` in Playwright config.

---

#### [O14] Tests Connect to Real Database — DEFERRED
**File:** `backend/src/test/setup.ts`
**Severity:** MEDIUM

Test setup uses the real Prisma client with whatever `DATABASE_URL` is set. No test isolation. Running tests could modify production data.

**Fix:** Use separate `DATABASE_URL` via `.env.test`. Consider transaction rollback per test.

**Status:** Deferred — tests currently mock Prisma client (841 tests pass without database). Real database test isolation is a future improvement.

---

### 5.4 Low

#### [O15] PWA Manifest Says "SiteProof v2" — RESOLVED (Phase 1)
**File:** `frontend/vite.config.ts:15`
**Severity:** LOW

PWA manifest `name: 'SiteProof v2'` but project is v3. Users who install PWA see wrong version.

**Resolution:** Changed to `'SiteProof v3'`.

---

#### [O16] `html2canvas` (~500KB) Used in Single File — RESOLVED (Phase 6)
**Severity:** LOW

Only used in `LinearMapView.tsx`. `html-to-image` is ~10KB and could replace it.

**Resolution:** Replaced `html2canvas` with `html-to-image` (~50x smaller bundle for identical functionality).

---

---

## 6. PRIORITIZED ACTION PLAN

### Completed — Security Hotfixes (Phase 1)
1. ~~**[S1]** Sanitize RichTextEditor innerHTML with DOMPurify~~ DONE
2. ~~**[S3]** Add auth to `/api/metrics` endpoint~~ DONE
3. ~~**[S2]** Fix support endpoint user enumeration~~ DONE
4. ~~**[S6]** Guard RoleSwitcher to dev-only builds~~ DONE
5. ~~**[S4]** Guard OAuth Mock page to dev-only builds~~ DONE
6. ~~**[S10]** Fix orphaned auth tokens persisting after logout~~ DONE
7. ~~**[O3]** Remove `.env.production` from git, add to `.gitignore`~~ DONE
8. ~~**[O5]** Fix `.gitignore` (add `backend/uploads/`, `.playwright-mcp/`, `nul`)~~ DONE
9. ~~**[O9]** Fix port mismatch and update CLAUDE.md~~ DONE
10. ~~**[O15]** Fix PWA manifest "SiteProof v2" -> "SiteProof v3"~~ DONE

### Completed — Performance & Infrastructure (Phases 2-3)
11. ~~**[P1]** Add pagination to diary list endpoint~~ DONE
12. ~~**[S6b]** Add `router.use(requireAuth)` to consent routes~~ DONE
13. ~~**[S9]** Add URL protocol validation to comment link parser~~ DONE
14. ~~**[S12]** Align ResetPasswordPage password validation with RegisterPage~~ DONE
15. ~~**[S8]** Environment-based CORS configuration~~ DONE
16. ~~**[P5]** Add pagination to documents, hold points, and test results~~ DONE
17. ~~**[P8]** Parallelize dashboard queries with `Promise.all`~~ DONE
18. ~~**[O1]** Add CI/CD pipeline~~ DONE
19. ~~**[O4]** Un-gitignore Prisma migrations~~ DONE
20. ~~**[O6]** Move `@types/*` to devDependencies~~ DONE
21. ~~**[Q10]** Update CLAUDE.md to match actual patterns~~ DONE
22. ~~**[P14]** Reduce JSON body limit to 1MB~~ DONE
23. ~~**[D1, D2]** Add onDelete strategies to 30+ FK relations~~ DONE
24. ~~**[D5, D8]** Add missing unique constraints~~ DONE
25. ~~**[D6]** Fix ScheduledReport orphaned model~~ DONE
26. ~~**[D12]** Commit migration files to git~~ DONE
27. ~~**[P9]** Add 14+ missing database indexes~~ DONE

### Completed — Code Quality & DevOps (Phases 4-6 + Safe Batch)
28. ~~**[Q1]** Eliminate `as any` casts with proper typing~~ DONE
29. ~~**[Q3]** Migrate 315 raw fetch calls to apiFetch~~ DONE
30. ~~**[Q5]** Remove unused utility modules~~ DONE
31. ~~**[Q7]** Remove/gate 200+ console.log statements~~ DONE
32. ~~**[S13]** Add role guards to sensitive routes~~ DONE
33. ~~**[S16]** Add UUID validation on route parameters~~ DONE
34. ~~**[S17]** Strip sensitive headers from webhook storage~~ DONE
35. ~~**[O2]** Create Dockerfile with multi-stage build~~ DONE
36. ~~**[O7]** Remove `@types/bcryptjs` (v3 bundles types)~~ DONE
37. ~~**[O11]** Create `.env.example` files~~ DONE
38. ~~**[O13]** Fix Playwright npm -> pnpm~~ DONE
39. ~~**[O16]** Replace html2canvas with html-to-image~~ DONE
40. ~~**[P11]** Consolidate and optimize checkProjectAccess~~ DONE
41. ~~**[P15]** Document Prisma connection pool config~~ DONE

### Completed — Phase 7 (Audit Logging, Cleanup, Tooling)
42. ~~**[D13]** Add audit logging to 25+ critical route handlers~~ DONE
43. ~~**[Q4]** Deduplicate role arrays and tier limits into centralized modules~~ DONE
44. ~~**[Q8]** Remove tRPC dead code (router, context, middleware, dependencies)~~ DONE
45. ~~**[O10]** Create ESLint v9 flat config + Prettier v3 config~~ DONE

### Completed — Phase 8 (Component Extraction, Virtualization, Memoization)
46. ~~**[P2]** Extract 9 monolithic frontend pages into components + hooks (18,152 → 2,673 lines)~~ DONE
47. ~~**[P3]** Add @tanstack/react-virtual virtualization to 7 table/list components~~ DONE
48. ~~**[P4]** Apply React.memo, useMemo, useCallback throughout all extracted components~~ DONE

### Completed — Phase 9 (Centralized Error Handler)
49. ~~**[Q2]** Adopt centralized error handler — AppError class, asyncHandler, errorHandler for all 35 routes + 29 tests + 22 frontend files~~ DONE

### Remaining — Deferred Items (sorted by value/risk)

**Worth Doing Eventually (safe, good value):**
- **[S14]** Migrate priority forms to React Hook Form + Zod
- ~~**[Q2]** Adopt centralized error handler (`next(error)` pattern)~~ DONE
- **[P13]** Migrate data fetching to TanStack Query hooks
- **[O8]** Upgrade TanStack React Query v4 -> v5

**Larger Efforts (plan carefully):**
- **[S5, S11]** httpOnly cookie auth + token refresh
- **[Q6]** Service layer extraction
- **[D7]** Supabase RLS policies for multi-tenancy

**Low Priority / Skip:**
- **[D3]** String-to-enum migration (high risk, low runtime impact)
- **[D4]** Soft deletes (complex, onDelete strategies already prevent cascade issues)
- **[D9, D10]** JSON/array field type changes (cosmetic improvement)
- **[D11]** Missing timestamps (additive schema change, low impact)
- **[Q9]** Zustand removal (partially done — Zustand implemented but old state patterns remain)
- **[Q11]** Rich text editor replacement (functional as-is)
- **[Q12, O12]** Test expansion (ongoing effort, not a discrete task)
- **[O14]** Test database isolation (tests already mock Prisma)
- **[S15]** CSRF protection (only needed if moving to cookies)
- **[P7]** Webhook database migration (low usage feature)
- **[P10]** Caching layer (optimize after profiling under load)

---

## 7. WHAT'S DONE WELL

Credit where due - these are solid patterns already in the codebase:

- **Auth on all routes** - Every route file uses `router.use(requireAuth)` or per-route `requireAuth`
- **Parameterized SQL** - All raw queries use tagged template literals, no string concatenation
- **Helmet + HSTS** - Security headers properly configured with 1-year HSTS
- **HTTPS enforcement** - Production redirect with `x-forwarded-proto` support
- **Auth rate limiting** - Separate stricter limits with account lockout after 5 failed attempts
- **Graceful shutdown** - Proper SIGTERM/SIGINT handling with 30s timeout
- **Structured error logging** - JSON error logs with context (user, path, method)
- **DOMPurify** in most places - QR components and diary page sanitize properly
- **Vite manual chunks** - recharts, jspdf, react-pdf, supabase, date-fns, offline all properly separated
- **Some lazy loading** - Route-level code splitting exists for many pages
- **TypeScript strict mode** - Both frontend and backend have `strict: true` with extra checks
- **Lock files committed** - pnpm-lock.yaml tracked in git for reproducible installs
- **Cascading deletes** - Most relations have `onDelete: Cascade`
- **Good index coverage on core models** - Lots, NCRs, HoldPoints, TestResults have composite indexes
- **Unique constraints** - Proper uniqueness on `[projectId, lotNumber]`, `[projectId, ncrNumber]`, etc.
- **API key hashing** - API keys store hash + prefix only, never the plain key
- **Timing-safe comparison** - Webhook signature verification uses `crypto.timingSafeEqual`

---

*Report generated by multi-agent codebase analysis. 6 parallel analysis agents examined security, performance, database schema, code quality, frontend security, and DevOps configuration across 56 route files, 1,269 lines of schema, and hundreds of frontend components.*

*Remediation completed across 10 phases (Phases 1-9 + Safe Batch), addressing 49 of 92 issues with 5 partially resolved and 18 intentionally deferred.*
