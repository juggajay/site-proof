# Hold Point And Foreman Audit Notes - 2026-06-12

Purpose: preserve the latest read-only audit findings and the foreman-side gaps
that were intentionally left alone because another dev session owns the foreman
shell workstream.

No fixes were started from this audit note.

## Scope Covered

- Existing/default lot detail and ITP checklist path.
- Existing hold-point request, release, chase, public token, and evidence
  package paths.
- Backend access checks for subcontractors, internal users, and public
  superintendent release tokens.
- Current non-shell frontend paths for hold-point request/release and evidence
  preview.
- Existing/default foreman camera capture, offline photo sync, normal ITP photo
  upload, subcontractor ITP photo upload, diary mobile quick-add, and lot photo
  display paths.

## Consolidated Finding Register

### P0 - Must Fix Before More Foreman Evidence Work

1. Foreman NCR evidence capture uploads a document but does not attach it to
   the NCR.
   `CaptureModal` stores `entityType: "ncr"`, `entityId`, and
   `documentType: "ncr_evidence"` in IndexedDB, but `syncWorker` only posts the
   file to `/api/documents/upload`. The documents upload route ignores
   `entityType` and `entityId`; the real NCR evidence relation is created only
   by `/api/ncrs/:id/evidence`. Result: the photo can sync successfully but not
   appear as NCR evidence.

2. External superintendent emails use the wrong primary links.
   The request email renders prominent authenticated app links for evidence and
   release, while the public `/hp-release/:token` link is secondary. External
   recipients can hit login/access denied even though they were sent a secure
   release token.

### P1 - High Risk Evidence/Access Defects

3. Chase reminders do not preserve external recipient access.
   Chase emails are sent to project superintendents or project managers, not
   necessarily the original external recipient, and they use authenticated app
   URLs instead of fresh secure public links.

4. Superintendent sign-off items can become impossible to complete or release.
   Backend completion gating treats `pointType === "hold_point"` and
   `responsibleParty === "superintendent"` non-witness items as release-gated,
   but the hold-point register/request routes and existing live UI only treat
   explicit `hold_point` items as hold points. A template item can therefore be
   blocked from PASS while not appearing in the release flow.

5. Foreman lot photos can sync but remain hard to find.
   The lot Photos tab flattens only ITP completion attachments. The lot
   Documents tab is currently a placeholder. A plain photo linked to a lot from
   the foreman camera can become a document row but not surface in the lot
   workflow where the field user expects it.

6. Offline photo upload response/timestamp handling is weak.
   The backend returns the uploaded document directly, while frontend offline
   sync tests mock `{ document: { id } }`. `markPhotoSynced` ignores the server
   document id, so follow-up evidence attachment cannot safely retry without
   duplicate uploads. Offline photos also send `capturedAt`, but the backend
   ignores it and only stores EXIF `captureTimestamp`; canvas compression can
   strip EXIF.

7. ITP photo evidence is online-only.
   The normal lot/subcontractor ITP path correctly uploads the document and
   calls `/api/itp/completions/:completionId/attachments`, but the shared
   `uploadItpEvidencePhoto` path explicitly does not write through to IndexedDB.
   ITP status can queue offline, but photo evidence cannot.

8. Intermittent "access denied" remains an audit item, not a confirmed single
   bug.
   The likely risk area is mixed company-role/project-role/subcontractor-company
   resolution across project routes and portal routes. There are also in-flight
   local changes around `ProjectProtectedRoute`, `useProjectAccess`, and
   subcontractor portal routing, so this should be verified in a fresh PR after
   those changes settle.

### P2 - Important Traceability/Product Gaps

9. Public evidence packages can over-share lot evidence.
   Checklist rows are scoped up to the hold point, but tests and photos are
   pulled from the whole lot. The schema has `TestResult.itpChecklistItemId`
   and `ITPCompletionAttachment`, so this can be scoped more tightly.

10. Manual email/paper release evidence is only loosely attached.
   The uploaded file is saved as a generic lot document and the release notes
   only get the filename. There is no direct hold-point-to-evidence relation,
   so audit traceability is weak.

11. Global `CaptureModal` has dead ITP linkage.
    It has `defaultItpId`/`linkedItp`, but no caller passes `defaultItpId` and
    there is no ITP selector. The global foreman camera cannot actually attach
    directly to an ITP item; the existing ITP item sheet remains the only safe
    path.

12. Foreman capture role mounting is inconsistent.
    `MobileNav` shows the foreman bottom nav from project role, while
    `MainLayout` mounts the camera modal from company/user role. A project-role
    foreman can see Capture but not get the mounted modal.

13. Diary mobile has no first-class photo/evidence path.
    Diary quick-add covers activity, delay, delivery, plant, event, and manual
    entries. There is no diary photo chip or linkage from the shared camera
    modal back to a diary record.

## Implementation Plan

Detailed plan saved to:

`docs/superpowers/plans/2026-06-12-foreman-holdpoint-evidence-fixes.md`

Recommended PR sequence:

1. **PR 1 - Photo upload contract + NCR evidence attach.**
   Fix the offline photo upload response shape, preserve server document ids,
   persist `capturedAt` as `captureTimestamp`, and make NCR capture sync call
   `/api/ncrs/:id/evidence`.

2. **PR 2 - Lot photo visibility.**
   Make lot-linked photo documents visible in the lot Photos/Documents surface
   and allow generic lot photos to be promoted to ITP evidence.

3. **PR 3 - External hold-point email links.**
   Make the public token link the primary external superintendent action and
   make chase reminders preserve or reissue secure public access.

4. **PR 4 - Hold-point gating alignment.**
   Align ITP completion gating, hold-point list/request routes, and UI labels so
   every release-gated item appears in the release workflow.

5. **PR 5 - Hold-point evidence scoping/traceability.**
   Scope public evidence packages to the relevant hold point and add a direct
   relation or auditable metadata path for manual email/paper release evidence.

6. **PR 6 - ITP evidence offline support.**
   Queue ITP evidence photos offline and attach them to completions after upload,
   reusing the upload/attach pattern from the online path.

7. **PR 7 - Access-denied verification.**
   Add role/project/subcontractor access regression tests around the rare access
   denied report after the current portal route changes land.

## Not Completed Because Foreman Shell Was Owned Elsewhere

- Full audit of `frontend/src/shell/**` and the new foreman mobile shell behind
  `?shell=v2`.
- New shell Lots + ITP run flow, especially hold point, N/A, fail, photo, and
  offline behavior.
- Planned shell screens for Dockets, Issues/NCR, Photos, and Drawings.
- `CaptureModal` NCR evidence attachment bug. The coordination note says NCR
  evidence captured from the foreman camera path may not attach to the NCR.
- Full mobile/live QA of foreman and subcontractor paths.
- Any behavior-preserving extractions from existing lot/ITP components for the
  shell.

## Suggested Next Audit Before Fixes

Audit the foreman mobile path end to end, but avoid files currently owned by
the foreman shell workstream until that dev session has merged or handed over.
Recommended focus:

- `CaptureModal` save paths for lot photos, diary photos, NCR evidence, and ITP
  evidence.
- Offline sync worker handling for captured photos and ITP attachments.
- Existing mobile ITP checklist behavior versus new shell ITP run behavior.
- Subcontractor portal ITP completion behavior on assigned lots.
- Docket and diary mobile flows that feed claims or legal records.
