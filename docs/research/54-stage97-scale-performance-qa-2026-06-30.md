# Stage 97 Scale And Performance QA

Date: 2026-06-30  
Branch: `qa/stage97-scale-performance`  
Fixture: local database only, `siteproof_e2e_stage97`

## Scope

This pass stress-tested the app with a large synthetic project and browser probes across admin, foreman mobile, and subbie mobile surfaces.

Seed shape:

- 600 lots
- 24 ITP checklist items per lot
- 14,400 ITP completions
- 2,400 hold points
- 180 dockets
- 1,200 documents
- 400 drawings
- 700 NCRs
- 8 claims with 480 claimed lot links

Browsed surfaces:

- Admin: dashboard, lots, heavy lot detail, claims, reports, costs, hold points, documents, drawings, dockets, NCR.
- Foreman mobile: home, lots, lot detail, ITP run, dockets, issues, photos, docs.
- Subbie mobile: home, work, ITPs, ITP run, dockets, quality, docs, NCRs.

## Findings Fixed

### 1. Hold-point register repeated the expensive backend read once per page

Before:

- `/projects/e2e-project/hold-points` made 24 calls to `/api/holdpoints/project/e2e-project?page=N&limit=100`.
- Each call rebuilt the same full project hold-point graph before slicing in memory.
- Large fixture timing: about 12.6 seconds for 2,400 hold points.

Fix:

- Backend now supports `all=true` on `GET /api/holdpoints/project/:projectId`, bounded to 5,000 items.
- Frontend full-register fetch now calls `/api/holdpoints/project/:projectId?all=true` once.
- Deep links and client-side filters still receive the full register.

After:

- One hold-point register API call.
- Large fixture timing: about 1.4 seconds.
- Slowest hold-point API resource: about 466 ms.

### 2. Subbie shell fetched broad unscoped data before company scope resolved

Before:

- Subbie mobile pages briefly had `projectId` but not `subcontractorCompanyId`.
- That caused duplicate broad calls before the scoped company call resolved.
- Affected `/p`, `/p/work`, `/p/itps`, `/p/dockets`, `/p/docs`, `/p/quality`.

Fix:

- `useSubbieShellData` now withholds project/subcontractor scope until the company scope is resolved, unless both IDs are already explicitly present.

After:

- Subbie pages only issue scoped calls in the large browser probe.
- Example after-state:
  - `/p/work`: 4 API calls
  - `/p/itps`: 4 API calls
  - `/p/dockets`: 4 API calls
  - `/p/docs`: 4 API calls

### 3. Subbie ITP run fetched unscoped lot/ITP data before company scope resolved

Before:

- `/p/lots/stage97-lot-001/itp?projectId=e2e-project` fetched unscoped lot and ITP instance data, then fetched again with the subbie company scope.

Fix:

- `useSubbieItpRun` now waits for complete explicit portal scope before fetching.

After:

- Subbie ITP run makes 5 API calls.
- The lot and ITP instance requests include both `projectId` and `subcontractorCompanyId`.

### 4. NCR pagination could duplicate rows across pages

Before:

- Large foreman issues probe logged React duplicate-key warnings for NCR IDs.
- Root cause was backend pagination sorting by non-unique fields such as `createdAt` without a unique tie-breaker.
- With many NCRs sharing timestamps, offset pages could overlap.

Fix:

- NCR list route now always adds `id` as a deterministic secondary sort key.
- Default sort remains `createdAt desc`.

After:

- Targeted `/m/issues?projectId=e2e-project` browser console check found 0 duplicate-key warnings.
- Full after-probe across all three roles had 0 console errors.

## Verification

Commands run:

- `frontend`: `npm run test:unit -- src/pages/holdpoints/holdPointsApi.test.ts src/pages/holdpoints/HoldPointsPage.test.tsx src/shell/subbie/screens/test/useSubbieItpRun.test.tsx`
- `backend`: `npm test -- src/routes/holdpoints.test.ts -t "GET /api/holdpoints/project"`
- `backend`: `npm test -- src/routes/ncrs.test.ts -t "GET /api/ncrs"`
- `frontend`: `npm run type-check`
- `backend`: `npm run type-check`
- `frontend`: `npm run lint`
- `backend`: `npm run lint`
- `frontend`: `npm run format:check`
- `backend`: `npm run format:check`
- repo: `git diff --check`
- repo advisory: `npm run fallow:audit`

Results:

- Focused frontend tests: 16 passed.
- Hold-point backend route tests: 51 passed.
- NCR backend route tests: 104 passed.
- Type-check: passed front and back.
- Lint: passed front and back, with the existing unrelated frontend warning in `src/lib/theme.tsx`.
- Format check: passed front and back.
- Browser probe after fixes: 0 API responses >= 400 across measured app API calls, 0 console errors.

Raw browser probe JSON is local-only under `.gstack/stage97/` and intentionally not committed.

## Remaining Optimizations

1. Foreman photos still fans out signed URLs aggressively.
   - `/m/photos` made 45 signed URL API calls and took about 2.4 seconds on the 1,200 document fixture.
   - Recommended follow-up: lazy signed URL fetching by viewport or switch to thumbnail metadata returned in the list.

2. Hold-point backend still hydrates the full project graph once for `all=true`.
   - The repeated-page multiplier is fixed.
   - If real projects can exceed about 5,000 hold points, the next step is a DB-side register query instead of loading lots, ITP instances, checklist items, completions, and hold points into memory.

3. Reports render a large page body on big projects.
   - `/projects/e2e-project/reports` showed about 44,000 visible characters locally.
   - It still loaded under 1 second in this fixture, but should be revisited during report/export QA.

4. Maintenance debt remains in NCR and ITP shell code.
   - `fallow` flagged `backend/src/routes/ncrs/ncrListRoute.ts` as a large, high-complexity function.
   - `fallow` also flagged duplication between foreman/classic/subbie ITP run logic.
   - These are refactor candidates, not blockers for this Stage 97 fix.

