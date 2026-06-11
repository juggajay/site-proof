# Foreman shell — functional map (photo pipeline + permission matrix)

Code-verified 2026-06-11 (agent pass, file:line evidence in the session record).
This is the factual contract for the foreman mobile shell rebuild.

## Photo pipeline (CaptureModal → offline store → sync)

- Capture always goes to IndexedDB first (`capturePhotoOffline`, lib/offline/photos.ts)
  and a `photo_upload` sync job uploads via `POST /api/documents/upload`
  (syncWorker.ts:378-440).
- **"Photo" and "Note" types are identical**: both become a `Document` row with
  `documentType='photo'`, `lotId=null` unless a lot was picked; "Note" just adds
  a caption. entityType 'general' is accepted-and-ignored by the backend
  (uploadRoutes.ts:126-131).
- **Unfiled photos are findable but easy to lose**: they appear only in the
  project Documents page (no lot, no category). There is NO "unfiled photos"
  inbox and NO UI to re-file a photo to a lot later — although the backend
  fully supports it (`PATCH /api/documents/:id` accepts lotId; foreman has
  write access). Capture-time filing is effectively final today.
  → SHELL REQUIREMENT: a Photos surface with "recent / unfiled" view + a
  re-file-to-lot action (frontend-only; API exists).
- **NCR capture, online**: NCR row IS created (`POST /api/ncrs`), but the
  evidence photo is uploaded with entityType='ncr' which the backend IGNORES —
  no NCREvidence join is created, so the photo never appears in the NCR's
  evidence list (needs `POST /api/ncrs/:id/evidence/upload` instead).
  → **PRODUCTION BUG, fix independent of shell**: route CaptureModal NCR
  photos through the NCR evidence endpoint (or attach server-side).
- **NCR capture, offline**: photo-only; no queued NCR creation (no ncr_create
  job type). User is told to raise the NCR later. Shell copy must stay honest
  about this.
- ITP evidence (entityType='itp') is the one linkage the upload endpoint DOES
  act on — ITP photo attach works end-to-end.

## Foreman permission matrix (effective project role 'foreman')

| Surface | Can | Cannot |
|---|---|---|
| Daily diary | create/edit/submit; read; addendums after submit | edit body after submit |
| Dockets | view; approve/reject/query (DOCKET_APPROVERS) | create (subcontractor-only) |
| ITP | complete items; request HP release; release HPs (unless superintendent-only project setting) | verify completions; manage templates |
| NCRs | raise; add/delete evidence | respond (only if set as responsible!); close; QM approve |
| Lots | view detail | create; edit fields; conform/status change; see budget |
| Documents | view; upload; delete ANY project doc; re-file via API | — |
| Test results | view; create/enter | verify; delete |
| Drawings | view | manage |

## Shell design consequences
- Lot detail is READ + ITP-action for foreman: no edit affordances anywhere.
- Docket surface = approval queue only; never a "create docket" button.
- NCR respond button only when user is the NCR's responsibleUserId — a foreman
  who raises an NCR is NOT auto-responsible (latent UX trap; consider
  auto-assigning or hiding respond cleanly).
- Test entry is allowed → can appear in lot context later (not in shell v1).
- Photos surface (new in shell): recent + unfiled + re-file action.

## Latent issues found (for the dev, independent of shell)
1. CaptureModal NCR evidence never attaches to the NCR (above) — real bug.
2. authMiddleware.ts:83-94 local ROLE_HIERARCHY omits quality_manager (level 0
   if any route uses requireMinRole) — latent.
3. site_manager can CREATE lots but cannot EDIT lot fields (intentional per
   tests, but surprising).
