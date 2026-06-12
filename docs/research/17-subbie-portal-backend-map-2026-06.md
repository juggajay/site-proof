# Subcontractor Role — Backend Surface Map (binding spec for shell rebuild)

Researched 2026-06-12 against master. The subbie shell frontend must not assume any
capability beyond this map.

> **No insurance/SWMS/license compliance-document feature exists** — no model, no routes,
> no expiry cron. Do not build UI expecting one.

## 1. Role & data model

Roles: `subcontractor_admin` (hierarchy 40, first invite-accepter), `subcontractor` (30).
Both in `ROLE_GROUPS.SUBCONTRACTOR` (`backend/src/lib/roles.ts`). Canonical check
`isSubcontractorPortalRole` (`projectAccess.ts:71`). Subbie portal users have
`companyId = null` (standalone identity).

Prisma: `GlobalSubcontractor` (org directory) → `SubcontractorCompany` (project-scoped;
`status`, `portalAccess` JSON, `invitationExpiresAt`) → `SubcontractorUser` (userId ↔ company,
link role `admin|user`; one user can link to multiple companies across projects) →
`EmployeeRoster` / `PlantRegister` (status `pending|approved|inactive|counter`, rates) →
`DailyDocket` + `DocketLabour`/`DocketLabourLot`/`DocketPlant`. Lot assignment via
`LotSubcontractorAssignment` (`canCompleteITP`, `itpRequiresVerification`) PLUS legacy
`Lot.assignedSubcontractorId` — access checks honor both. Subbies have NO `ProjectUser` rows;
access flows through SubcontractorUser → SubcontractorCompany.projectId.
Blocked statuses `suspended|removed` = total portal lockout (`projectAccess.ts:5`).

## 2. Docket lifecycle

Statuses: `draft, pending_approval, approved, rejected, queried`
(`dockets/validation.ts:10-16`). Entry-editable: `{draft, queried, rejected}`.

| From | Action | To | Who |
|---|---|---|---|
| — | create | draft | subcontractor only |
| draft, rejected | submit | pending_approval | linked subbie |
| pending_approval | approve / reject / query | approved / rejected / queried | DOCKET_APPROVERS (owner/admin/PM/SM/foreman) |
| queried | respond | pending_approval | linked subbie |

Submission guards (`submissionGuards.ts`): ≥1 entry (`ENTRY_REQUIRED`); if any labour entries,
≥1 must have a lot allocation (`LOT_REQUIRED`). Approve auto-populates the daily diary.

Endpoints (all `/api/dockets`): GET list (subbie auto-scoped to own company); POST create
(subbie only); GET `/:id`; PATCH `/:id` (notes only, editable status); POST `/:id/submit`;
POST `/:id/respond {response}`; labour GET/POST/PUT/DELETE `/:id/labour[/:entryId]`
(employeeId must be **approved** roster; lotAllocations constrained to company-assigned lots);
plant GET/POST/PUT/DELETE `/:id/plant[/:entryId]` (plantId must be approved; `wetOrDry`
default dry). Hours: >0 and ≤24; times `HH:mm`. **No materials, signatures, photos,
attachments on dockets.**

Notifications: submit → in-app+email to approver ProjectUsers; approve/reject/query →
in-app+email to all linked SubcontractorUsers; respond → in-app to approvers.

## 3. Module visibility (server-enforced)

`SubcontractorCompany.portalAccess` defaults: `lots:true, itps:true, holdPoints:true,
testResults:true, ncrs:FALSE, documents:true` (`projectAccess.ts:27-34`); enforced by
`requireSubcontractorPortalModuleAccess`. `ncrs` auto-enables on first NCR assignment.
Universal lot scoping: assigned lots only (both assignment models), every module.

- Lots: list auto-filtered to assigned; budget hidden; no create/edit.
- ITP: complete items only if `LotSubcontractorAssignment.canCompleteITP`;
  `itpRequiresVerification` → HC must verify; never verify/manage templates.
- Hold points / test results: read-scoped; no release/manage.
- NCRs: visible if responsible or NCR touches assigned lot (module default OFF).
- Documents: subbie reads scoped (`lotId null` OR own upload OR assigned lot) + category-gated
  by modules; subbie CAN upload but only linked to an assigned lot
  (`requireSubcontractorAssignedLotWriteScope`) — current portal UI exposes no upload; do not add.
- Diaries: no subbie access (dockets feed diaries on approval).
- Notifications: subbies receive notifications but are BLOCKED from the project-notification
  admin/query API; bell list only. Alert eligibility gated by approved company + module flags;
  docket alerts always allowed.
- Claims/reports/dashboard/company/audit: no subbie surface.

## 4. My-company self-service (`/api/subcontractors/my-company*`)

Standalone portal users only. GET my-company (`?projectId=`) → company + roster/plant across
links. POST employees / POST plant / DELETE employees/:id / DELETE plant/:id — gated by
`canManageLinkedSubcontractorCompany` = role `subcontractor_admin` OR link role `admin`.
New roster/plant rows start `status='pending'`. Only `approved` usable on dockets.
HC counter-proposals → status `counter` + `rate_counter` notification.

## 5. Subbie-received notifications

`rate_approved` / `rate_counter` (employee + plant variants) → linked users, link to portal;
docket approved/rejected/queried → linked users (in-app + email). No compliance-expiry
notifications (feature absent).

## 6. Invites/onboarding (out of shell scope — do not touch)

HC invites via POST `/api/subcontractors/invite` (14-day expiry, email links to
`/subcontractor-portal/accept-invite?id=`). New user: POST
`/api/auth/register-and-accept-invitation` (email must match invite, creates
subcontractor_admin, auto-verified). Existing user: POST `/invitation/:id/accept`
(EMAIL_MISMATCH 409 confirm; HC company accounts blocked). Login returns
`hasSubcontractorPortalAccess` + `dashboardRole`.

## 7. Gotchas for the rebuild

1. Two roles, asymmetric power — roster writes are admin-only.
2. `portalAccess.ncrs` defaults FALSE — NCR tile conditional.
3. Only `approved` employees/plant pickable on dockets — show pending/counter distinctly, locked.
4. Labour lot-allocation mandatory before submit; restricted to assigned lots.
5. ITP completion needs `canCompleteITP`; `itpRequiresVerification` drives pending-verify state.
6. Suspended/removed company = total lockout message.
7. No docket signatures/photos/materials; no compliance docs.
