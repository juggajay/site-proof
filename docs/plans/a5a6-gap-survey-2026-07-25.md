# A5/A6 Gap Survey — day-one UX essentials + instrumentation

**Date:** 25 July 2026 · **Verified tree:** `1cac0326` (#1546) · Read-only survey (agent-produced, orchestrator-reviewed) for Wave A increments A5/A6. Facts cited; per-section "cheapest meaningful increment"; build order at the end.

## 1. Cross-record retrieval (global search)
**Exists:** `frontend/src/components/GlobalSearch.tsx` — exactly three scopes (lot/ncr/test, `:21-27`), three parallel queries (`:143-174`) against `/api/lots`, `/api/ncrs`, `/api/test-results` (`search=<term>&page=1&limit=10`, `:81-90`). Header-only entry (`layouts/Header.tsx:8,266`) + Cmd/Ctrl-K (`Header.tsx:99`). Matching is case-insensitive substring server-side (lots `routes/lots/listQuery.ts:3-28`; NCRs `routes/ncrs/ncrListRoute.ts:250-262`; tests `routes/testResults/listRoutes.ts:190-200`) re-filtered client-side (`GlobalSearch.tsx:73-79,197-289`), capped 5/type. Good per-scope error/retry states (`:176-187,425-480`).
**Missing:** documents/drawings/dockets/diaries/hold-points/claims/variations scopes — although documents (`routes/documents/listRoutes.ts:154-160`) and drawings (`routes/drawings/readRoutes.ts:43-48`) already expose `search` server-side; no mobile-shell entry (`shell/components/ShellScreen.tsx:174-252` has no search affordance); single-project only (`:99,106`); no exact-id ranking (an exact "NCR-0012" can be buried under substring hits); no search indexes (no GIN/pg_trgm in schema; `contains` scans).
**Cheapest increment:** add documents/drawings/hold-points as three more parallel queries (server support exists) + rank exact number/id matches first. No new backend, no new dependency.

## 2. Saved register views
**Exists:** URL-searchParams filter idiom on lots (`pages/lots/LotsPage.tsx:50-66`), NCRs (`pages/ncr/components/NCRFilters.tsx:32-54`), hold points (`pages/holdpoints/HoldPointsPage.tsx:101-132`), dockets (status only, `DocketApprovalsPage.tsx:47-50`). localStorage for lot column visibility/order/view-mode (`LotsPage.tsx:20-45`, via `lib/storagePreferences`).
**Missing:** named/saved views anywhere (no server model, no localStorage preset list — shareable only by copying the URL). **Outlier:** test-results register keeps filters in local `useState` (`pages/tests/TestResultsPage.tsx:130`) — lost on refresh/back-nav, inconsistent with the other registers.
**Cheapest increment:** "Save view" = named querystring presets in localStorage via the existing `storagePreferences` helper; bring TestResultsPage onto the URL idiom first.

## 3. System states (save/sync/error consistency)
**Exists:** one toast system (sonner via `components/ui/toaster.tsx`, 34 call sites). But sync/offline state renders through **four components with three different enums**, all reading the same `useOfflineStatus` data: `shell/components/SyncChip.tsx` (saved/syncing/failed/offline/waiting, `:84-96`), `components/OfflineIndicator.tsx` floating pills (conflict/failed/offline/stuck/pending, `:79-148`), plus inline `OfflineBadge` and `SyncStatusBadge` (synced/pending/error/conflict, `:167-233`). Loading: ad-hoc spinners (no shared primitive). Errors: three distinct denied/error layouts (`RoleProtectedRoute.tsx:56-75`, `AccessDeniedState.tsx`, bespoke inline blocks).
**Cheapest increment:** one sync enum + one `<SyncStatus>` component (a merge, not a rewrite — all read the same hook). **Shell-touch warning:** `SyncChip` renders in the foreman/subbie shell header — this increment REQUIRES Jay's explicit shell go-ahead; sequenced with A3, not before.

## 4. Permissions explainability
**Exists:** boolean-only gates (`hooks/useCommercialAccess.ts:21-29`), hide-or-redirect presentation, two generic full-page denials (`RoleProtectedRoute.tsx:56-75`, `AccessDeniedState.tsx:12`).
**Missing:** any per-action "why can't I do this" — no reason strings, no required-role surfacing (`hasRoleInGroup` membership never shown), denied mutations = generic 403 toast.
**Cheapest increment:** return a `reason` (required role group) alongside each boolean in `useCommercialAccess` and render disabled-with-tooltip instead of hidden on office surfaces. Shells untouched.

## 5. Output branding
**Exists — effectively complete for PDFs:** shared layer `lib/pdf/branding.ts` (`resolvePdfBranding` with explicit-company-project fallback `:74-106`; header/band/details/footers helpers) consumed by all 8 generators (test cert, NCR, hold-point evidence, docket, dashboard, diary, conformance, claim evidence). Logo: company settings upload to Supabase `company-logos/` (`routes/company/logoStorage.ts:24-37`), embedded as data URL (`lib/pdf/fetchBranding.ts:6-21`).
**Missing:** CSV exports carry no branding header; silent degradation when logo/name absent.
**Cheapest increment:** company-name/ABN header row on CSV exports from the already-fetched branding data.

## 6. A6 instrumentation
**Exists:** Sentry errors-only both ends (traces sample 0: backend `lib/sentry.ts:86`, frontend `lib/sentry.ts:17-20`); in-memory request metrics (p95/p99/slow/per-endpoint, `middleware/requestLogger.ts:30-184` — volatile, resets on restart); AiProposal as a proven self-hosted-in-Postgres event pattern (`schema.prisma:1859-1880`); AuditLog shape + indexes (`schema.prisma:1634-1653`).
**Missing:** any UX/task-funnel event capture; any persisted metrics; any frontend event transport.
**Build decision (orchestrator, overriding the survey's suggestion):** funnel events go in a **separate `product_events` table** using the AuditLog writer *pattern* — NOT into AuditLog itself. AuditLog is a compliance artifact in a QA-evidence product; mixing UX telemetry into it would degrade its evidentiary value and bloat the compliance trail. Same code shape, different table, independent retention.

## Build order (safe-first)
1. **A5-i** Global search: +3 scopes + exact-match-first ranking (office header only — safe).
2. **A5-ii** TestResultsPage to the URL filter idiom, then named saved views (localStorage presets) on lots/NCR/hold-points/tests (safe).
3. **A5-iii** Permission reason tooltips on commercial gates (office surfaces only — safe).
4. **A5-iv** CSV branding header (safe).
5. **A6-i** `product_events` table + backend writer + minimal frontend transport + first funnel (lot-create) — needs a small reviewed migration.
6. **A5-v** Sync-state unification — **blocked on Jay's shell go-ahead**, sequenced with A3.
