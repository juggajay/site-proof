# SiteProof Pre-Launch Fixes Handoff

Checked on 2026-06-17 from checkout branch `perf/audit-2026-06-10`.

Important context: this checkout is not `master` and does not contain
`frontend/src/shell/**` or `docs/review/**`. The source report mentions
`review/pre-launch-audit`, but that branch/report folder was not present in
this checkout. Verify shell-specific notes in the relevant worktree before
changing them.

## Confirmed In This Checkout

### 1. Docket approved dollar totals mismatch

Priority: high.

The submitted docket totals are stored as money, but approval writes adjusted
hours into similarly named approved-total fields.

Evidence:
- `backend/src/routes/dockets/entryTotals.ts` writes submitted cost into
  `totalLabourSubmitted` and `totalPlantSubmitted`.
- `backend/src/routes/dockets/review.ts` writes `labourApproved` and
  `plantApproved` into `totalLabourApproved` and `totalPlantApproved`.
- `backend/src/routes/dockets/approvalResponse.ts` resolves approved totals
  directly from `adjustedLabourHours` / `adjustedPlantHours`.
- `frontend/src/pages/subcontractor-portal/DocketsListPage.tsx` displays
  `totalLabourSubmitted + totalPlantSubmitted`.
- `frontend/src/pages/dockets/components/DocketApprovalsTable.tsx` displays
  `totalLabourApproved` / `totalPlantApproved` as hours.

Existing related worktree:
- `C:\Users\jayso\site-proofv3\.worktrees\fix-docket-approved-costs`
- Branch: `fix/docket-approved-costs`
- Latest commit: `8cc07e57 fix: persist approved docket costs`

Next action:
- Review the existing worktree/PR before redoing the fix.
- Persist approved dollar totals separately from approved hours.
- Make PM and subbie surfaces read the same approved-money source once a
  docket is approved.

### 2. Adjustment reason not enforced

Priority: high.

The backend accepts adjusted hours with no reason, and the modal only marks
the field visually.

Evidence:
- `backend/src/routes/dockets/validation.ts` defines `adjustmentReason` as
  optional/nullable and does not link it to changed hours.
- `frontend/src/pages/dockets/components/DocketActionModal.tsx` disables submit
  only for reject/query notes, not approval adjustments.
- `frontend/src/pages/dockets/docketActionData.ts` trims blank
  `adjustmentReason` to `null`.

Branch-specific caveat:
- The source note references
  `frontend/src/shell/screens/dockets/DocketDetailScreen.tsx`, but this
  checkout has no `frontend/src/shell/**`.

Next action:
- Add backend schema validation that rejects adjusted hours with blank reason.
- Mirror that guard in the desktop modal.
- Check the foreman shell branch and add the same guard to mobile approval.

### 3. Offline docket claim is overstated

Priority: medium.

Offline docket helpers exist, but the current subbie docket screens use direct
`apiFetch` calls with no offline fallback.

Evidence:
- `frontend/src/lib/offline/dockets.ts` exports `createDocketOffline`,
  `submitDocketOffline`, and `updateDocketOffline`.
- `frontend/src/pages/subcontractor-portal/DocketEditPage.tsx` creates dockets
  and entries through direct `apiFetch`.
- `frontend/src/pages/subcontractor-portal/useDocketSubmitActions.ts` submits
  dockets through direct `apiFetch`.
- `frontend/src/components/landing/FAQ.tsx` claims the mobile app stores data
  locally and syncs, but only names ITPs, photos, and diaries.

Next action:
- Either wire the offline docket helpers into the subbie docket screens, or
  avoid marketing dockets as offline-capable until that is implemented.

### 4. Offline wording needs narrowing

Priority: medium.

The FAQ says diaries can be submitted offline. That may be true for the core
diary flow, but it should be checked against personnel/plant edit flows before
the wording stays broad.

Evidence:
- `frontend/src/components/landing/FAQ.tsx` says foremen can submit diaries
  from anywhere.
- Existing offline database tests and helpers cover some diary behavior, but
  this pass did not fully trace every diary sub-flow.

Next action:
- Verify diary personnel/plant edit behavior before keeping broad wording.
- Narrow wording if only diary quick-add/submit is offline-safe.

### 5. SOPA wording over-claims

Priority: medium.

Two in-app strings imply legal compliance rather than evidence support.

Evidence:
- `frontend/src/lib/pdf/claimEvidencePackagePdf.ts` prints:
  "This evidence package is prepared for Security of Payment Act compliance."
- `frontend/src/pages/legal/TermsOfServicePage.tsx` says:
  "Progress claim preparation with SOPA compliance".
- `frontend/src/components/ChangelogNotification.tsx` also says:
  "Claim certification tracking with SOPA compliance".

Next action:
- Change these to "evidence package to support your payment claim" or similar.

### 6. Supabase document URLs are public and permanent

Priority: medium before paying customers.

Uploaded files are represented as public Supabase object URLs.

Evidence:
- `backend/src/lib/supabase.ts` builds
  `/storage/v1/object/public/{bucket}/{path}`.
- Many routes/tests accept or store those public document URLs.

Existing related worktrees:
- `C:\Users\jayso\site-proofv3\.worktrees\fix-storage-privacy`
- Branch: `fix/storage-privacy`
- Latest commit: `8e00b249 Fix Supabase file download privacy`
- `C:\Users\jayso\site-proofv3\.worktrees\fix-protected-document-downloads`

Next action:
- Review the existing storage/privacy branches before redoing the fix.
- Prefer private bucket storage plus authenticated/signed download URLs.

### 7. CLAUDE role documentation is stale

Priority: low.

`CLAUDE.md` lists a six-role union, while `backend/src/lib/roles.ts` has a
larger canonical role set.

Evidence:
- `CLAUDE.md` lists `owner | admin | project_manager | site_manager | foreman |
  subcontractor`.
- `backend/src/lib/roles.ts` also includes `quality_manager`, `site_engineer`,
  `subcontractor_admin`, `viewer`, and `member`.

Next action:
- Update `CLAUDE.md` to point to `backend/src/lib/roles.ts` as the source of
  truth, or expand the role list.

## Not Verified In This Checkout

- `frontend/src/shell/screens/dockets/DocketDetailScreen.tsx` mobile one-tap
  approval behavior, because `frontend/src/shell/**` is absent in this branch.
- `docs/review/00-RELEASE-BLOCKERS.md`, because `docs/review/**` is absent in
  this branch.
- The full conflict-merge claim coverage, because this pass only checked the
  landing wording and offline helper wiring, not all sync conflict flows.
