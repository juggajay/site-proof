# Agent coordination — mobile shell workstream (`frontend/src/shell/**`)

This workstream owns the `frontend/src/shell/**` tree exclusively. Two parallel
mobile shells live here, both built on the same primitives (`ShellScreen`,
`SyncChip`, `useTimeGreeting`, the shell-\* CSS in `frontend/src/index.css`, and
the per-domain context pattern):

- **Foreman shell** — `/m/*`, internal roles, `useShellV2Enabled` /
  `SHELL_DEFAULT_ROLES` (foreman default-ON).
- **Subbie portal shell** — `/p/*`, subcontractor portal roles,
  `useSubbieShellActive` / `SUBBIE_SHELL_DEFAULT_ROLES` (empty — DARK).

The two activations are **mutually exclusive by role**: a subcontractor role can
never get `/m`, an internal role can never get `/p`. This is enforced by the role
gate in `isShellActiveForRole` vs `isSubbieShellActiveForRole` and pinned by a
test (`shellFlag.test.ts` → "the foreman and subbie role gates are mutually
exclusive"). Keep it that way — the two shells share a device and the same
`?shell=v2` / `?shell=off` override.

## Subbie shell (2026-06-12)

### Staged-PR plan

- **A — foundation (THIS PR):** flag, `/p` routes, real Home screen, stubs for
  every other surface (DARK: override-only, zero behaviour change without the
  override).
- **B — dockets (PR #858):** the docket editor surface (`/p/docket`,
  `/p/docket/:id`, `/p/dockets`) — the primary action surface (labour/plant
  entry sheets, submit/respond). DONE.
- **C — inspections (PR #856):** `/p/work`, `/p/itps`, `/p/lots/:lotId/itp`
  (the editable ITP run, reusing — importing, not forking — the foreman ITP
  dot-track trio).
- **D — quality + docs + company (PR #857):** `/p/quality` (holds &
  tests), `/p/ncrs` (module-conditional), `/p/docs`, `/p/company` — read-only QA
  visibility + admin-gated roster. Stubs replaced for quality/docs/company; new
  `/p/ncrs` route added; Home NCR tile retargeted to `/p/ncrs`.

Each subsequent PR replaces the matching stub in `SubbieStubScreen` usage with a
real screen and keeps the classic `/subcontractor-portal/*` pages untouched until
the shell screen reaches parity.

### Files touched by PR A (foundation)

New:

- `frontend/src/shell/SubbieShellGuard.tsx`
- `frontend/src/shell/subbie/SubbieShellRoutes.tsx`
- `frontend/src/shell/subbie/subbieShellData.ts`
- `frontend/src/shell/subbie/subbieShellContext.ts`
- `frontend/src/shell/subbie/screens/HomeScreen.tsx`
- `frontend/src/shell/subbie/screens/SubbieStubScreen.tsx`
- `frontend/src/shell/subbie/screens/test/HomeScreen.test.tsx`
- `frontend/src/shell/test/SubbieShellGuard.test.tsx`
- `docs/research/16-subbie-portal-functional-map-2026-06.md`
- `docs/research/17-subbie-portal-backend-map-2026-06.md`
- `docs/design-subbie-shell-mock-v1.html`

Modified:

- `frontend/src/shell/shellFlag.ts` — added `SUBBIE_SHELL_DEFAULT_ROLES`,
  `isSubbieShellActiveForRole`, `useSubbieShellActive`. Foreman logic
  (`isShellActiveForRole`, `SHELL_DEFAULT_ROLES`, `useShellV2Enabled`)
  UNCHANGED.
- `frontend/src/shell/index.ts` — barrel exports for the new pieces.
- `frontend/src/shell/components/ShellScreen.tsx` — added `subcontractor` /
  `subcontractor_admin` → `SUBCONTRACTOR` to the role-chip map; added optional
  `projectLabel` (overrides the `/api/projects` lookup subbies can't call) and
  `headerExtra` (project switcher) props to the home variant. Foreman call sites
  and tests unchanged.
- `frontend/src/shell/test/shellFlag.test.ts` — added subbie-function coverage
  (existing foreman tests unchanged).
- `frontend/src/index.css` — added `shell-hero-big`, `shell-hero-money`,
  `shell-notice*`, `shell-badge*` classes (same `shell-` prefix + Quiet
  Authority tokens).
- `frontend/src/App.tsx` — lazy `/p/*` mount (mirrors `/m/*`, outside
  `ProtectedAppShell`, `RoleProtectedRoute` + `SUBCONTRACTOR_ROLES`); wrapped the
  `/subcontractor-portal` dashboard route in `SubbieShellGuard`.

### Files touched by PR C (inspections) — PR #856

New:

- `frontend/src/shell/subbie/screens/WorkScreen.tsx` — `/p/work` assigned-lots
  list (read-only; classic `portalModule=lots` query reused).
- `frontend/src/shell/subbie/screens/ItpsScreen.tsx` — `/p/itps` inspection list
  (classic `includeITP=true&portalModule=itps` query reused; canComplete pill).
- `frontend/src/shell/subbie/screens/SubbieItpRunScreen.tsx` — `/p/lots/:lotId/itp`
  the editable ITP run; IMPORTS (no fork) the foreman `ItpDotTrack`,
  `itpTrackPhysics`, `useItpContentDrag`, `lotsShellState`.
- `frontend/src/shell/subbie/screens/useSubbieItpRun.ts` — run data + actions
  wiring the SHARED `useItpCompletionActions` hook + `subcontractorView=true`
  reads, exactly as the classic `SubcontractorLotITPPage`.
- `frontend/src/shell/subbie/screens/ShellAccessDenied.tsx` — dark-shell
  equivalent of `PortalAccessDenied` (module-gate notice).
- `frontend/src/shell/subbie/screens/test/WorkScreen.test.tsx`
- `frontend/src/shell/subbie/screens/test/ItpsScreen.test.tsx`
- `frontend/src/shell/subbie/screens/test/SubbieItpRunScreen.test.tsx`
- `frontend/src/shell/subbie/screens/test/useSubbieItpRun.test.tsx`

Modified:

- `frontend/src/shell/subbie/SubbieShellRoutes.tsx` — replaced the `work`, `itps`
  and `lots/:lotId/itp` stub routes with the real screens (docket/dockets/quality/
  docs/company stubs left for PRs B/D; foreman files imports-only, unchanged).

### Files touched by PR D (quality + docs + company) — PR #857

New:

- `frontend/src/shell/subbie/screens/QualityScreen.tsx`
- `frontend/src/shell/subbie/screens/DocsScreen.tsx`
- `frontend/src/shell/subbie/screens/NcrsScreen.tsx`
- `frontend/src/shell/subbie/screens/CompanyScreen.tsx`
- `frontend/src/shell/subbie/screens/test/QualityScreen.test.tsx`
- `frontend/src/shell/subbie/screens/test/DocsScreen.test.tsx`
- `frontend/src/shell/subbie/screens/test/NcrsScreen.test.tsx`
- `frontend/src/shell/subbie/screens/test/CompanyScreen.test.tsx`

Modified:

- `frontend/src/shell/subbie/SubbieShellRoutes.tsx` — replaced the quality/docs/
  company stubs with the real screens; added the `/p/ncrs` route. Docket /
  dockets / work / itps / lots-run stubs left untouched for their PRs.
- `frontend/src/shell/subbie/screens/HomeScreen.tsx` — retargeted the
  conditional NCR tile from `/p/quality` to `/p/ncrs`.
- `frontend/src/shell/subbie/screens/test/HomeScreen.test.tsx` — added the NCR
  tile navigation-target assertion.

### Files touched by PR B (docket surface) — PR #858

New:

- `frontend/src/shell/subbie/screens/dockets/DocketScreen.tsx` — `/p/docket` +
  `/p/docket/:docketId`, one status-driven screen (lazy create, CREW/PLANT/NOTES,
  totals, submit/respond/resubmit, the `#submitted` confirmation state).
- `frontend/src/shell/subbie/screens/dockets/DocketEntrySheets.tsx` — labour +
  plant add-entry bottom sheets (rebuilt mobile `BottomSheet`, approved-only
  pickers, presets, wet/dry, live preview).
- `frontend/src/shell/subbie/screens/dockets/DocketsListScreen.tsx` — `/p/dockets`
  history (month-approved sub-line, All/Needs-attention/Pending/Approved chips,
  month groups, foremanNotes snippets).
- `frontend/src/shell/subbie/screens/dockets/test/DocketScreen.test.tsx`
- `frontend/src/shell/subbie/screens/dockets/test/DocketsListScreen.test.tsx`

Modified:

- `frontend/src/shell/subbie/SubbieShellRoutes.tsx` — replaced the docket /
  docket/:id / dockets stubs with the real screens (only those three route
  blocks; all other stubs untouched).
- `frontend/src/shell/subbie/screens/HomeScreen.tsx` — rewrote the
  needs-attention docket links + rate-counter My-Company link into `/p` so the
  docket flow is fully internal to the shell.
- `frontend/src/index.css` — added docket-surface classes under the same
  `shell-` prefix (`shell-sect`, `shell-entry`, `shell-lotchip`, `shell-addline`,
  `shell-totals`, `shell-notes`, `shell-quote`, `shell-crewpick`/`shell-pickrow`,
  `shell-presets`/`shell-wetdry`/`shell-segbtn`, `shell-preview`,
  `shell-sheetbtn`, `shell-field-label`, `shell-input`).
- `frontend/src/pages/subcontractor-portal/useDocketSubmitActions.ts` — added
  OPTIONAL `redirectTo` / `onSubmitted` / `onResponded` params (defaulted →
  classic `DocketEditPage` behaviour is byte-for-byte identical). This is the
  single permitted classic-file touch.
- `frontend/src/pages/subcontractor-portal/useDocketEntrySheetState.ts` — exposed
  `setSelectedEmployee` / `setSelectedPlant` on the return (additive; the classic
  page never reads them, so its behaviour is unchanged) for the in-sheet pickers.

`frontend/src/shell/**` remains this workstream's exclusive zone.
