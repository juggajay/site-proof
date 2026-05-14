# Performance Audit Results - 2026-02-02

## Executive Summary

SiteProof v3 has **critical bundle size issues** and **N+1 query patterns** that will cause significant performance degradation at scale. The main JavaScript bundle is **3.46 MB** (799 KB gzipped) - approximately **35x larger** than the target of 100KB.

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Initial JS | **3,455 KB** | <100 KB | CRITICAL |
| Gzipped JS | **799 KB** | <50 KB | CRITICAL |
| LCP (estimated) | >4s | <2.5s | CRITICAL |
| Code Splitting | None | Route-level | CRITICAL |
| React Query Usage | 2 files | All data fetching | HIGH |
| N+1 Queries | Multiple | Zero | HIGH |
| Database Indexes | 5 | 15+ recommended | MEDIUM |

---

## CRITICAL Issues

### 1. Monolithic Bundle (3.46 MB)

**Problem:** All 84 pages are statically imported in `App.tsx` (lines 20-83). No code splitting exists.

**Build output:**
```
dist/assets/index-32r3QdKm.js   3,455.25 kB │ gzip: 799.33 kB
dist/assets/html2canvas.esm-CBrSDip1.js  201.42 kB │ gzip:  48.03 kB
dist/assets/index.es-CY1oqr8l.js  150.44 kB │ gzip:  51.42 kB
```

**Root causes:**
- `jspdf` (PDF generation) - bundled with app
- `recharts` (charting) - bundled with app
- `react-pdf` / `pdfjs-dist` (PDF viewing) - bundled with app
- `html2canvas` - already lazy loaded (good)
- All 84 pages loaded upfront

**File:** `frontend/src/App.tsx` lines 20-83

### 2. No Route-Level Code Splitting

**Current pattern (BAD):**
```tsx
// All imported statically
import { LotDetailPage } from '@/pages/lots/LotDetailPage'
import { LotsPage } from '@/pages/lots/LotsPage'
import { DailyDiaryPage } from '@/pages/diary/DailyDiaryPage'
// ... 80+ more imports
```

**Should be:**
```tsx
const LotDetailPage = lazy(() => import('@/pages/lots/LotDetailPage'))
const LotsPage = lazy(() => import('@/pages/lots/LotsPage'))
const DailyDiaryPage = lazy(() => import('@/pages/diary/DailyDiaryPage'))
```

### 3. N+1 Query Pattern in Portfolio Risks

**File:** `backend/src/routes/dashboard.ts` lines 434-528

**Problem:** For each project, 3 separate database queries run inside a loop:

```typescript
for (const project of projects) {
  // Query 1 per project
  const majorNCRCount = await prisma.nCR.count({ where: { projectId: project.id, ... }})

  // Query 2 per project
  const overdueNCRCount = await prisma.nCR.count({ where: { projectId: project.id, ... }})

  // Query 3 per project
  const staleHPCount = await prisma.holdPoint.count({ where: { lot: { projectId: project.id }, ... }})
}
```

**Impact:** User with 10 projects = 30+ sequential database queries. User with 50 projects = 150+ queries.

---

## HIGH Priority Issues

### 4. Minimal React Query Adoption

**Problem:** Only 2 files use `useQuery`/`useMutation` out of entire codebase.

**Files using React Query:**
- `frontend/src/components/lots/AssignSubcontractorModal.tsx` (5 uses)
- `frontend/src/pages/lots/LotDetailPage.tsx` (5 uses)

All other pages use manual `useState` + `useEffect` + `fetch` pattern, losing:
- Automatic caching
- Background refetching
- Deduplication
- Optimistic updates
- Pagination helpers

### 5. Unbounded Query Results in Reports

**File:** `backend/src/routes/reports.ts`

All report endpoints load ALL records without pagination:
- `GET /api/reports/lot-status` - ALL lots
- `GET /api/reports/ncr` - ALL NCRs
- `GET /api/reports/test` - ALL test results
- `GET /api/reports/diary` - ALL diaries

**Risk:** Projects with 10,000+ lots will timeout or OOM.

### 6. Large Component Files

| File | Lines | Recommendation |
|------|-------|----------------|
| `LotDetailPage.tsx` | 4,324 | Split into 5-6 focused components |
| `LotsPage.tsx` | 3,403 | Extract filters, table, modals |
| `pdfGenerator.ts` | 2,915 | Lazy load, move to web worker |
| `DailyDiaryPage.tsx` | 2,669 | Extract form sections |
| `TestResultsPage.tsx` | 2,529 | Extract table and modals |
| `NCRPage.tsx` | 2,493 | Extract list and detail views |

---

## MEDIUM Priority Issues

### 7. Missing Database Indexes

**Current indexes (only 5):**
```prisma
@@index([userId, consentType])  // consent_records
@@index([projectId])             // daily_dockets
@@index([subcontractorCompanyId]) // daily_dockets
@@index([entityType, entityId])  // comments
@@index([commentId])             // comment_attachments
```

**Missing recommended indexes:**
```prisma
// NCR table - frequently filtered
model NCR {
  @@index([projectId])
  @@index([projectId, status])
  @@index([projectId, dueDate])
  @@index([projectId, category])
}

// HoldPoint - filtered via lot join
model HoldPoint {
  @@index([lotId])
  @@index([status, createdAt])
}

// Lot - primary work table
model Lot {
  @@index([projectId])
  @@index([projectId, status])
  @@index([projectId, conformedAt])
}

// TestResult
model TestResult {
  @@index([projectId])
  @@index([lotId])
  @@index([projectId, sampleDate])
}

// DailyDiary
model DailyDiary {
  @@index([projectId, date])
}
```

### 8. Heavy Dependencies in Main Bundle

| Package | Size | Should Lazy Load |
|---------|------|------------------|
| `jspdf` | ~500KB | Yes - only used for PDF export |
| `recharts` | ~400KB | Yes - only on Claims/Dashboard |
| `react-pdf/pdfjs-dist` | ~300KB | Yes - only for document viewing |

### 9. No HTTP Cache Headers

Backend returns no cache headers. Static reference data (ITP templates, subcontractor lists) could be cached.

---

## Recommended Actions (Priority Order)

### Phase 1: Critical Fixes (Expected: 60-70% bundle reduction)

1. **Add route-level code splitting**
   - Convert all page imports to `React.lazy()`
   - Add `<Suspense>` boundaries with loading states
   - Target: Initial JS < 200KB

2. **Lazy load heavy libraries**
   ```typescript
   // PDF generation - only when user clicks export
   const generatePDF = async () => {
     const { jsPDF } = await import('jspdf')
     // ...
   }

   // Charts - only on pages that need them
   const Chart = lazy(() => import('recharts').then(m => ({ default: m.LineChart })))
   ```

3. **Fix N+1 portfolio risks query**
   ```typescript
   // Batch all queries with Promise.all
   const projectIds = projects.map(p => p.id)

   const [majorNCRs, overdueNCRs, staleHPs] = await Promise.all([
     prisma.nCR.groupBy({
       by: ['projectId'],
       where: { projectId: { in: projectIds }, category: 'major', status: { notIn: [...] }},
       _count: true
     }),
     prisma.nCR.groupBy({
       by: ['projectId'],
       where: { projectId: { in: projectIds }, dueDate: { lt: today }, status: { notIn: [...] }},
       _count: true
     }),
     prisma.holdPoint.groupBy({
       by: ['lot.projectId'],
       where: { lot: { projectId: { in: projectIds }}, status: { in: [...] }, createdAt: { lt: sevenDaysAgo }},
       _count: true
     })
   ])
   ```

### Phase 2: High Priority (1-2 weeks)

4. **Add Vite manual chunks configuration**
   ```typescript
   // vite.config.ts
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           'pdf': ['jspdf', 'react-pdf'],
           'charts': ['recharts'],
           'vendor': ['react', 'react-dom', 'react-router-dom'],
         }
       }
     }
   }
   ```

5. **Add pagination to reports endpoints**
   ```typescript
   const lots = await prisma.lot.findMany({
     where: { projectId },
     take: limit || 1000,
     skip: offset || 0,
     orderBy: { lotNumber: 'asc' }
   })
   ```

6. **Add database indexes** (migration)

7. **Expand React Query adoption** - Replace useState+fetch patterns

### Phase 3: Medium Priority (2-4 weeks)

8. **Split large components**
   - `LotDetailPage` → `LotHeader`, `LotITPSection`, `LotPhotos`, `LotHistory`, `LotActions`
   - `LotsPage` → `LotsFilters`, `LotsTable`, `LotsModals`

9. **Add HTTP cache headers for static data**

10. **Move PDF generation to Web Worker**

---

## Verification Commands

After fixes, verify improvements:

```bash
# Rebuild and check bundle
cd frontend && npm run build

# Target output should show:
# - Main chunk < 200KB
# - Separate lazy chunks for pages
# - PDF/chart libraries in separate chunks

# Check for N+1 patterns
cd backend && grep -rn "for.*await.*prisma\|forEach.*await.*prisma" src/routes/

# Run Lighthouse
npx lighthouse http://localhost:5174 --view
```

---

## Audit Metadata

- **Auditor:** Claude Opus 4.5
- **Date:** 2026-02-02
- **Frontend Build Time:** 8.20s
- **Total Modules:** 2,831
- **Test Suite:** 252 backend tests passing
