# Subcontractor Portal Frontend — Functional Map (binding spec for shell rebuild)

Researched 2026-06-12 against master. This is the binding inventory of everything a
`subcontractor` / `subcontractor_admin` user sees and does today. The subbie shell rebuild
must preserve ALL of it — a missed feature is lost functionality.

> **Correction on PR #759:** it was a pure visual restyle of the existing portal QA-visibility
> screens, NOT an insurance/SWMS/license document feature. There is NO compliance-document
> upload surface in this product. "Compliance" = (a) employee/plant rate-approval status
> (pending → approved by head contractor), and (b) read-only QA visibility (ITPs, hold points,
> test results, NCRs, documents).

## 1. Routes (path → component → roles)

Role constant: `SUBCONTRACTOR_ROLES = ['subcontractor', 'subcontractor_admin']`
(`frontend/src/appRouteRoles.ts:4`). All protected portal routes nest inside
`<ProtectedAppShell />` (`App.tsx:133`) which renders `MainLayout`.

| Path | Component | Guard |
|---|---|---|
| `/subcontractor-portal/accept-invite` | `AcceptInvitePage` | public/hybrid |
| `/accept-invite` | `AcceptInvitePage` | public/hybrid (alias) |
| `/my-company` | `MyCompanyPage` | SUBCONTRACTOR_ROLES |
| `/subcontractor-portal` | `SubcontractorDashboard` | SUBCONTRACTOR_ROLES |
| `/subcontractor-portal/docket/new` | `DocketEditPage` | SUBCONTRACTOR_ROLES |
| `/subcontractor-portal/docket/:docketId` | `DocketEditPage` | SUBCONTRACTOR_ROLES |
| `/subcontractor-portal/dockets` | `DocketsListPage` | SUBCONTRACTOR_ROLES |
| `/subcontractor-portal/work` | `AssignedWorkPage` | SUBCONTRACTOR_ROLES |
| `/subcontractor-portal/itps` | `SubcontractorITPsPage` | SUBCONTRACTOR_ROLES |
| `/subcontractor-portal/lots/:lotId/itp` | `SubcontractorLotITPPage` | SUBCONTRACTOR_ROLES |
| `/subcontractor-portal/holdpoints` | `SubcontractorHoldPointsPage` | SUBCONTRACTOR_ROLES |
| `/subcontractor-portal/tests` | `SubcontractorTestResultsPage` | SUBCONTRACTOR_ROLES |
| `/subcontractor-portal/ncrs` | `SubcontractorNCRsPage` | SUBCONTRACTOR_ROLES |
| `/subcontractor-portal/documents` | `SubcontractorDocumentsPage` | SUBCONTRACTOR_ROLES |

**Post-login landing** (`pages/auth/LoginPage.tsx:56-82`): `getDefaultPostLoginRedirect` →
`/subcontractor-portal` when `hasSubcontractorPortalIdentity(user)`; `?redirect=` to
`/subcontractor-portal*` honored only with portal identity.

**Portal identity** (`lib/subcontractorIdentity.ts:21-27`):
`hasSubcontractorPortalIdentity = !user.companyId && user.hasSubcontractorPortalAccess === true`.
`RoleProtectedRoute` (`components/auth/RoleProtectedRoute.tsx:42-47`) grants portal routes by
identity AND hard-blocks subbie-role users from any non-subbie route.

**Onboarding gate** (`ProtectedAppShell.tsx:17-32`): subbies skip the `/onboarding` redirect.

## 2. Portal module access model

`pages/subcontractor-portal/portalAccessModel.ts`:
`DEFAULT_PORTAL_ACCESS = { lots:true, itps:true, holdPoints:true, testResults:true, ncrs:false, documents:true }`.
`isPortalModuleEnabled(company, module)` gates each screen; disabled → `<PortalAccessDenied>`.
**`ncrs` defaults OFF** (auto-enabled server-side on first NCR assignment).

Common bootstrap read on every portal page:
`GET /api/subcontractors/my-company[?projectId=…]` → `{ company }` with `portalAccess`,
`availableProjects[]` (multi-project switcher), `employees[]`, `plant[]`.
Query keys: `lib/queryKeys.ts:81-102` — all scoped by `userId`.

## 3. Per-page inventory

### SubcontractorDashboard — `/subcontractor-portal`
Data: my-company; `GET /api/dockets?projectId=`; assigned lots (if lots module)
`GET /api/lots?projectId=&portalModule=lots` (sliced to 5); `GET /api/notifications?limit=10`.
UI: project switcher (when >1 project, sets `?projectId=`); Today's Docket hero
(local-date key; existing today docket → Continue/View link, else Start → `/docket/new`);
docket prerequisite warning (`getDocketPrerequisiteState`: no approved employees/plant → link
My Company; lots module on but no lot assigned; lots module off message);
Needs Attention (`buildNeedsAttentionItems`: queried dockets, rejected dockets, unread
`rate_counter` notifications); Assigned Lots (5) → `/work`; Recent Dockets (3) → `/dockets`;
Quick links grid gated per `isPortalModuleEnabled`. Refresh invalidates the 4 portal keys.
Docket statuses: `draft, pending_approval, approved, rejected, queried`.

### DocketsListPage — `/subcontractor-portal/dockets`
my-company + `GET /api/dockets?projectId=`. CTA continue/start today's docket; status filter
tabs (All/Pending/Approved/Queried); grouped by month; `queried`/`rejected` rows show
`foremanNotes`. Read-only; rows link to `/docket/:id`.

### DocketEditPage — `/docket/new`, `/docket/:docketId` (PRIMARY ACTION SURFACE)
Files: `DocketEditPage.tsx`, `docketEditData.ts`, `docketEditHelpers.ts`,
`useDocketSubmitActions.ts`, `useDocketEntrySheetState.ts`, `DocketEditPagePanels.tsx`,
`DocketEditTabs.tsx`, `DocketEntrySheet.tsx`.

- Bootstrap: my-company; lots `GET /api/lots?projectId=` (403 → `lotsModuleDisabled` notice);
  docket `GET /api/dockets/:id`; today's dockets list.
- Editable statuses: unset OR `draft`/`queried`/`rejected` (`isEditableDocketStatus`).
  `pending_approval`/`approved` read-only. `canSubmit` = `draft`|`rejected` + ≥1 entry.
- `/docket/new` redirects to today's docket if exists. `ensureDocket` lazily
  `POST /api/dockets {projectId, date(today), notes}` on first entry add, rewrites URL.
- Tabs: Labour / Plant / Summary.
- LABOUR: tap **approved** employee → sheet. Start/Finish (`type=time`), presets 6-2/7-3/7-5/6-6,
  lot allocation (auto if exactly one assigned lot, else select; REQUIRED). Hours via
  `calculateHours` (overnight-safe, rounds 0.1). Live hours+cost preview.
  `POST /api/dockets/:id/labour {employeeId, startTime, finishTime, lotAllocations:[{lotId,hours}]}`.
  `DELETE /api/dockets/:id/labour/:entryId`.
- PLANT: tap approved plant → sheet. Hours operated (step .5, >0 ≤24 via `parseDailyHoursInput`),
  wet/dry toggle only when `wetRate>0`.
  `POST /api/dockets/:id/plant {plantId, hoursOperated, wetOrDry}`.
  `DELETE /api/dockets/:id/plant/:entryId`.
- Notes auto-save on blur: `PATCH /api/dockets/:id {notes}` (only editable + changed).
- Submit (`useDocketSubmitActions`): saves notes then `POST /api/dockets/:id/submit` → toast →
  navigate `/subcontractor-portal`. Respond to query: `POST /api/dockets/:id/respond {response}`
  (when `queried`; shows foreman query + textarea + "Respond & Resubmit"). Rejected shows
  `foremanNotes` + edit + "Resubmit for Approval".
- Running totals updated optimistically from each mutation's `runningTotal.cost`. Fixed bottom
  action bar: Total + Submit.
- **No signature capture, no docket photos/attachments, no materials lines.**

### AssignedWorkPage — `/work` (lots module)
my-company + `GET /api/lots?projectId=&portalModule=lots`. Read-only; grouped
In Progress / Not Started / On Hold / Completed; statuses `not_started,in_progress,completed,on_hold`;
shows area m²; project switcher.

### SubcontractorITPsPage — `/itps` (itps module)
`GET /api/lots?projectId=&includeITP=true&portalModule=itps`, filter lots with `itpInstances`.
Grouped by ITP status. Per-lot `canCompleteITP` (from `subcontractorAssignments`) — "View only -
contact PM for completion access" when false. Links `/lots/:lotId/itp`.

### SubcontractorLotITPPage — `/lots/:lotId/itp` (EDITABLE)
Data (manual apiFetch): `GET /api/lots/:lotId?portalModule=itps` (lot +
`subcontractorAssignments[].canCompleteITP`); `GET /api/itp/instances/lot/:lotId?subcontractorView=true`.
Actions via shared `useItpCompletionActions` (`pages/lots/hooks/`), gated
`requireCompletionAccess()`: toggle completion; mark N/A (trimmed reason); mark Failed (surfaces
raised NCR number); update notes `PATCH /api/itp/completions/:id {notes}`.
Add photo: create completion if needed `POST /api/itp/completions {itpInstanceId, checklistItemId,
status:'pending', notes:''}` then `uploadItpEvidencePhotoWithOfflineFallback({projectId, lotId,
completionId, file, capturedBy})`; validation `getItpPhotoValidationError` (10MB/types);
offline-queues on network failure. AI classification is HC-only.

### SubcontractorHoldPointsPage — `/holdpoints` (holdPoints module)
`GET /api/holdpoints/project/:projectId?subcontractorView=true`. Read-only. Statuses
`pending/notified/released/rejected`; grouped Pending(+notified)/Released/Rejected; released-by + date.

### SubcontractorTestResultsPage — `/tests` (testResults module)
`GET /api/test-results?projectId=&subcontractorView=true` (`passFail`→pass/fail/pending;
value = `resultValue+resultUnit`). Read-only; grouped Failed/Pending/Passed.

### SubcontractorNCRsPage — `/ncrs` (ncrs module, default OFF)
`GET /api/ncrs?projectId=&subcontractorView=true`. Read-only. Severity minor/major/critical;
statuses open/investigating/rectification/verification/closed/closed_concession/rejected;
grouped Open/In Progress/Closed; lot numbers from `ncrLots`.

### SubcontractorDocumentsPage — `/documents` (documents module)
`GET /api/documents/:projectId?subcontractorView=true`. Read-only, grouped by `category`.
Open via `openDocumentAccessUrl(doc.id, doc.fileUrl)` (`lib/documentAccess`). No upload UI.

### MyCompanyPage — `/my-company`
Data: `GET /api/subcontractors/my-company[?projectId=]` — `companyName, abn,
primaryContact{Name,Email,Phone}, status, availableProjects[], employees[], plant[]`.
**Write gate: `canManageRoster = user.role === 'subcontractor_admin'`** — plain `subcontractor`
is view-only. Mutations: `POST /my-company/employees {projectId,name,phone,role,hourlyRate}`;
`POST /my-company/plant {projectId,type,description,idRego,dryRate,wetRate}`;
`DELETE /my-company/employees/:id?projectId=`; `DELETE /my-company/plant/:id?projectId=`.
Status model: employee/plant `pending|approved|inactive` (+ `counter` from HC). 
`PendingApprovalsAlert`: pending rates must be HC-approved before docket use.
Form fields — employee: Name*, Phone, Role* (Supervisor/Foreman/Operator/Labourer/Leading Hand/
Pipe Layer/Traffic Controller), Hourly Rate*. Plant: Type* (Excavator/Loader/Roller/Grader/
Dump Truck/Water Cart/Paver/Bobcat/Compactor/Other), Description*, ID/Rego, Dry Rate*, Wet Rate
(optional/allowZero). Rate validation `parseRateInput` (`rateValidation.ts`).

### AcceptInvitePage — `/subcontractor-portal/accept-invite`
By `?id=` → `GET /api/subcontractors/invitation/:id`; logged-in fallback
`GET /api/subcontractors/my-pending-invitation`. Flows: logged-in accept
`POST /api/subcontractors/invitation/:id/accept {acknowledgeEmailMismatch}` (409 EMAIL_MISMATCH
→ masked-email confirm); new-user `POST /api/auth/register-and-accept-invitation
{email,password,fullName,invitationId,tosAccepted}` (zod `acceptInviteSchema`, 12+ char password
strength, readonly email, ToS checkbox); already-accepted state. NOT part of the shell rebuild —
leave untouched.

## 4. Navigation today

No dedicated subbie layout — shares `MainLayout`. Sidebar: Portal + My Company only
(`subcontractorNavigation`, Sidebar.tsx:133-146); all other nav `excludeRoles SUBCONTRACTOR`.
Mobile bottom nav (`MobileNav.tsx:126-130`): Docket (`/docket/new`), Home, My Company; FAB and
project nav suppressed. Every other screen reached via in-page links.

## 5. Shell reuse notes

Foreman shell `frontend/src/shell/**`: `shellFlag.ts` `SHELL_DEFAULT_ROLES = {'foreman'}` and
`isShellActiveForRole` returns **false for subbie roles unconditionally** (deliberate: the /m
foreman shell must not bleed into the portal). The subbie shell is a PARALLEL activation —
do not relax the foreman guard. Reuse: `ShellScreen` (home/inner variants, `headerExtra`,
declared-parent back), `SyncChip`/`syncChipState`, `useTimeGreeting`, stagger-rise CSS, the ITP
dot-track trio (`ItpDotTrack.tsx`, `itpTrackPhysics.ts`, `useItpContentDrag.ts`).
ShellScreen role-chip map needs a SUBCONTRACTOR entry; home variant must show the subbie's
company + project name sourced from my-company (`availableProjects`), not `/api/projects`.
