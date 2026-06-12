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
- **B — dockets:** the docket editor surface (`/p/docket`, `/p/dockets`) — the
  primary action surface (labour/plant entry sheets, submit/respond).
- **C — inspections:** `/p/work`, `/p/itps`, `/p/lots/:lotId/itp` (the editable
  ITP run, reusing the foreman ITP dot-track trio).
- **D — quality + docs + company:** `/p/quality` (holds & tests, NCRs),
  `/p/docs`, `/p/company`.

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

`frontend/src/shell/**` remains this workstream's exclusive zone.
