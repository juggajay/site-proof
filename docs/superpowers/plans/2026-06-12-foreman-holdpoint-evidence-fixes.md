# Foreman Hold Point Evidence Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the highest-risk foreman, hold-point, and subcontractor evidence bugs found in the June 12 audit without colliding with the foreman shell v2 workstream.

**Architecture:** Keep each behavioral fix in a separate PR. The evidence system should treat uploads as a two-step contract: create a `Document`, then create the domain relation (`NCREvidence`, `ITPCompletionAttachment`, hold-point evidence relation/metadata) before telling the user the evidence is attached. Public superintendent flows should use bearer-token URLs as the external access boundary, not authenticated app URLs.

**Tech Stack:** React 18, Vite, TypeScript, TanStack Query, Express, Prisma, Vitest, IndexedDB/Dexie offline queue, Supabase Storage-backed document upload.

---

## Boundaries

- Do not edit `frontend/src/shell/**` unless the foreman shell owner explicitly hands over the file.
- Do not merge these fixes into one large branch. Each PR below is independently testable.
- Rebase each branch onto `master` before opening the PR.
- Run targeted tests first, then the repo's normal CI commands for the touched package.
- Keep production secrets and token values out of logs, reports, and test snapshots.

## Finding To PR Map

| Priority | Finding | PR |
|---|---|---|
| P0 | NCR capture evidence uploads but does not attach to NCR | PR 1 |
| P0 | External superintendent email primary links go to authenticated app pages | PR 3 |
| P1 | Chase reminders lose secure external access | PR 3 |
| P1 | Release-gated superintendent items can be blocked but not releasable | PR 4 |
| P1 | Lot-linked camera photos are hard to find | PR 2 |
| P1 | Offline upload response/timestamp contract is weak | PR 1 |
| P1 | ITP photo evidence is online-only | PR 6 |
| P1 | Intermittent access denied needs regression coverage | PR 7 |
| P2 | Public evidence package over-shares lot evidence | PR 5 |
| P2 | Manual email/paper release evidence is loosely attached | PR 5 |
| P2 | Global CaptureModal has dead ITP linkage | PR 2 or PR 6 |
| P2 | Capture modal role mounting differs from mobile nav role source | PR 7 |
| P2 | Diary mobile has no photo/evidence link | Separate product follow-up |

---

### Task 1: PR 1 - Fix Offline Upload Contract And Capture Timestamp

**Files:**
- Modify: `backend/src/routes/documents/uploadRoutes.ts`
- Modify: `backend/src/routes/documents.test.ts`
- Modify: `frontend/src/lib/offline/core.ts`
- Modify: `frontend/src/lib/offline/photos.ts`
- Modify: `frontend/src/lib/offline/syncWorker.ts`
- Modify: `frontend/src/lib/offline/syncWorker.test.ts`
- Modify: `frontend/src/lib/useOfflineStatus.test.tsx`

- [ ] **Step 1: Add backend test for `capturedAt` fallback**

Add this case inside `describe('POST /api/documents/upload', ...)` in `backend/src/routes/documents.test.ts`:

```ts
it('stores capturedAt as captureTimestamp when EXIF does not provide one', async () => {
  const capturedAt = '2026-01-01T10:00:00.000Z';

  const res = await request(app)
    .post('/api/documents/upload')
    .set('Authorization', `Bearer ${token}`)
    .field('projectId', projectId)
    .field('documentType', 'photo')
    .field('capturedAt', capturedAt)
    .attach('file', Buffer.from('fake image bytes'), {
      filename: 'site.jpg',
      contentType: 'image/jpeg',
    });

  expect(res.status).toBe(201);
  expect(res.body.captureTimestamp).toBe(capturedAt);

  const doc = await prisma.document.findUniqueOrThrow({ where: { id: res.body.id } });
  expect(doc.captureTimestamp?.toISOString()).toBe(capturedAt);
});
```

- [ ] **Step 2: Run the backend test and confirm it fails**

Run:

```bash
cd backend && npm test -- --run src/routes/documents.test.ts -t "stores capturedAt as captureTimestamp"
```

Expected: FAIL because `capturedAt` is not in the upload body schema and `captureTimestamp` stays null when EXIF is absent.

- [ ] **Step 3: Implement upload schema support**

In `backend/src/routes/documents/uploadRoutes.ts`, add `capturedAt` to the upload body schema:

```ts
capturedAt: optionalFormStringSchema('capturedAt', 64).pipe(
  z
    .string()
    .datetime()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
),
```

Then destructure it:

```ts
const {
  projectId,
  lotId,
  documentType,
  category,
  caption,
  tags,
  gpsLatitude,
  gpsLongitude,
  capturedAt,
} = bodyParse.data;
```

Store it as a fallback:

```ts
captureTimestamp: photoMetadata.captureTimestamp ?? capturedAt,
```

- [ ] **Step 4: Add frontend test for direct document response shape**

Update `frontend/src/lib/offline/syncWorker.test.ts` so the photo upload test mocks the real backend response:

```ts
authFetchMock.mockResolvedValue(okJson({ id: 'doc-9' }));
```

Expected assertion:

```ts
expect(markPhotoSyncedMock).toHaveBeenCalledWith('ph-1', 'doc-9');
```

Also update `frontend/src/lib/useOfflineStatus.test.tsx` to mock `{ id: 'doc-99' }`.

- [ ] **Step 5: Preserve the server document id in the offline photo row**

Add fields to `OfflinePhoto` in `frontend/src/lib/offline/core.ts`:

```ts
serverDocumentId?: string;
uploadedAt?: string;
```

Update `markPhotoSynced` in `frontend/src/lib/offline/photos.ts`:

```ts
export async function markPhotoSynced(photoId: string, serverDocumentId?: string): Promise<void> {
  await offlineDb.photos.update(photoId, {
    serverDocumentId,
    syncStatus: 'synced',
    uploadedAt: new Date().toISOString(),
    localUpdatedAt: new Date().toISOString(),
  });
}
```

- [ ] **Step 6: Parse both upload response shapes in `syncWorker`**

In `frontend/src/lib/offline/syncWorker.ts`, replace:

```ts
const result = await uploadResponse.json();
await markPhotoSynced(photoId, result.document?.id);
```

with:

```ts
const result = await uploadResponse.json();
const documentId = result?.id ?? result?.document?.id;
await markPhotoSynced(photoId, documentId);
```

- [ ] **Step 7: Run targeted tests**

Run:

```bash
cd backend && npm test -- --run src/routes/documents.test.ts -t "stores capturedAt as captureTimestamp"
cd frontend && npm test -- --run src/lib/offline/syncWorker.test.ts src/lib/useOfflineStatus.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit PR 1 base contract**

```bash
git add backend/src/routes/documents/uploadRoutes.ts backend/src/routes/documents.test.ts frontend/src/lib/offline/core.ts frontend/src/lib/offline/photos.ts frontend/src/lib/offline/syncWorker.ts frontend/src/lib/offline/syncWorker.test.ts frontend/src/lib/useOfflineStatus.test.tsx
git commit -m "fix: preserve offline photo upload document contract"
```

---

### Task 2: PR 1 - Attach Foreman NCR Capture Evidence

**Files:**
- Modify: `frontend/src/components/foreman/CaptureModal.tsx`
- Modify: `frontend/src/components/foreman/CaptureModal.test.tsx`
- Modify: `frontend/src/lib/offline/syncWorker.ts`
- Modify: `frontend/src/lib/offline/syncWorker.test.ts`

- [ ] **Step 1: Make the capture payload explicitly NCR evidence**

In `CaptureModal.tsx`, when `captureType === 'ncr'`, pass category:

```ts
category: captureType === 'ncr' ? 'ncr_evidence' : undefined,
```

Expected existing test update in `CaptureModal.test.tsx`:

```ts
expect(capturePhotoOfflineMock).toHaveBeenCalledWith(
  'p1',
  expect.any(File),
  expect.objectContaining({
    entityType: 'ncr',
    entityId: 'ncr-1',
    documentType: 'ncr_evidence',
    category: 'ncr_evidence',
  }),
);
```

- [ ] **Step 2: Add failing sync test for NCR evidence attach**

Add a test in `syncWorker.test.ts`:

```ts
it('attaches uploaded NCR evidence to the NCR before marking the photo synced', async () => {
  getOfflinePhotoMock.mockResolvedValue({
    dataUrl: 'data:image/jpeg;base64,abc',
    fileName: 'defect.jpg',
    projectId: 'proj-1',
    lotId: 'lot-1',
    documentType: 'ncr_evidence',
    category: 'ncr_evidence',
    entityType: 'ncr',
    entityId: 'ncr-1',
    caption: 'cracked kerb',
    capturedAt: '2026-01-01T00:00:00.000Z',
  });
  authFetchMock
    .mockResolvedValueOnce(okJson({ id: 'doc-9' }))
    .mockResolvedValueOnce(okJson({ evidence: { id: 'ev-1' } }));

  const result = await syncSingleItem(
    queueItem({ id: 41, type: 'photo_upload', data: { photoId: 'ph-1' } }),
  );

  expect(result).toEqual({ status: 'synced' });
  expect(authFetchMock).toHaveBeenNthCalledWith(
    2,
    '/api/ncrs/ncr-1/evidence',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ documentId: 'doc-9', evidenceType: 'photo' }),
    }),
  );
  expect(markPhotoSyncedMock).toHaveBeenCalledWith('ph-1', 'doc-9');
});
```

- [ ] **Step 3: Implement NCR evidence attach in `syncWorker`**

After upload response parsing:

```ts
if (!documentId) {
  throw new Error('Document upload response did not include a document id');
}

if (photo.entityType === 'ncr' && photo.entityId && photo.documentType === 'ncr_evidence') {
  const evidenceResponse = await authFetch(apiUrl(`/api/ncrs/${encodeURIComponent(photo.entityId)}/evidence`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, evidenceType: 'photo' }),
  });

  if (!evidenceResponse.ok) {
    const evidenceError = await evidenceResponse.text();
    throw new Error(evidenceError || 'Failed to attach NCR evidence');
  }
}
```

Keep `removeSyncQueueItem` and `markPhotoSynced` after the evidence call so a failed attach remains retryable.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
cd frontend && npm test -- --run src/components/foreman/CaptureModal.test.tsx src/lib/offline/syncWorker.test.ts
```

Expected: PASS.

- [ ] **Step 5: Open PR 1**

PR title:

```text
fix: attach foreman NCR capture evidence
```

PR body must call out:

- Upload response shape fixed to accept direct `Document`.
- `capturedAt` now persists as `captureTimestamp`.
- NCR capture now creates the `NCREvidence` relation.

---

### Task 3: PR 2 - Surface Lot-Linked Photos

**Files:**
- Modify: `frontend/src/pages/lots/components/PhotosTab.tsx`
- Modify: `frontend/src/pages/lots/components/PhotosTabSections.tsx`
- Create or modify: `frontend/src/pages/lots/components/PhotosTab.test.tsx`
- Modify: `frontend/src/pages/lots/components/LotDetailTabPanel.tsx`

- [ ] **Step 1: Add a Photos tab test for generic lot photos**

Create a test that mounts `PhotosTab` with no ITP attachments and mocks:

```ts
authFetchMock.mockResolvedValueOnce({
  ok: true,
  json: async () => ({
    documents: [
      {
        id: 'doc-lot-1',
        filename: 'progress.jpg',
        fileUrl: '/uploads/documents/progress.jpg',
        mimeType: 'image/jpeg',
        documentType: 'photo',
        category: 'progress',
        caption: 'progress photo',
        uploadedAt: '2026-01-01T00:00:00.000Z',
        uploadedBy: { id: 'u1', fullName: 'Fred Foreman', email: 'fred@example.com' },
      },
    ],
  }),
});
```

Expected assertion:

```ts
expect(await screen.findByText('progress.jpg')).toBeInTheDocument();
expect(screen.queryByText(/No photos have been uploaded/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Fetch lot photo documents**

In `PhotosTab.tsx`, fetch:

```ts
const res = await authFetch(
  `/api/documents/${encodeURIComponent(projectId)}?lotId=${encodeURIComponent(lotId)}&documentType=photo`,
);
```

If `PhotosTab` does not currently receive `projectId`, add it to `PhotosTabProps` and pass it from `LotDetailTabPanel`.

- [ ] **Step 3: Render two sections**

Render:

- `ITP evidence photos` from existing completion attachments.
- `Lot photos` from document list items that are not already present in ITP attachment document ids.

Keep the existing empty state only when both lists are empty.

- [ ] **Step 4: Allow generic lot photos to be added to ITP evidence**

Update `addPhotosToEvidence` so selected document ids can come from either:

```ts
const existingItpPhoto = itpPhotos.find((p) => p.attachment.document.id === documentId);
const genericLotPhoto = lotPhotoDocuments.find((document) => document.id === documentId);
const finalDocumentId = existingItpPhoto?.attachment.document.id ?? genericLotPhoto?.id;
```

Use `finalDocumentId` in the `/api/itp/completions/:completionId/attachments` request.

- [ ] **Step 5: Run targeted tests**

Run:

```bash
cd frontend && npm test -- --run src/pages/lots/components/PhotosTab.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Open PR 2**

PR title:

```text
fix: show lot-linked photos in lot detail
```

---

### Task 4: PR 3 - Make External Hold-Point Links Public-Token First

**Files:**
- Modify: `backend/src/routes/holdpoints/requestReleaseRoutes.ts`
- Modify: `backend/src/routes/holdpoints/chaseNotifications.ts`
- Modify: `backend/src/routes/holdpoints/chaseNotifications.test.ts`
- Modify: `backend/src/routes/holdpoints/actionRoutes.ts`
- Modify: `backend/src/routes/holdpoints/requestReleaseRoutes` tests in `backend/src/routes/holdpoints.test.ts` or extracted route test file if present

- [ ] **Step 1: Lock request email expectation**

Add/adjust a hold-point request email test so the payload sent to `sendHPReleaseRequestEmail` uses:

```ts
evidencePackageUrl: 'https://frontend.test/hp-release/raw-token',
releaseUrl: 'https://frontend.test/hp-release/raw-token',
```

Expected: no `/hold-points/.../evidence-package` authenticated URL in the external email payload.

- [ ] **Step 2: Keep request route using secure public URL**

`requestReleaseRoutes.ts` already builds:

```ts
const secureReleaseUrl = buildFrontendUrl(`/hp-release/${recipient.secureToken}`);
```

Make sure both `evidencePackageUrl` and `releaseUrl` use `secureReleaseUrl` for external recipients.

- [ ] **Step 3: Fix chase reminder recipient/link model**

Update `actionRoutes.ts` chase handling so it either:

- reuses an unexpired `HoldPointReleaseToken` for the original external recipient, or
- creates a fresh token and sends the chase email to that external recipient.

The chase email context must use:

```ts
releaseUrl: buildFrontendUrl(`/hp-release/${rawToken}`),
evidencePackageUrl: buildFrontendUrl(`/hp-release/${rawToken}`),
```

- [ ] **Step 4: Update chase notification tests**

In `chaseNotifications.test.ts`, assert the builder preserves the public URL passed in:

```ts
expect(payload.releaseUrl).toBe('https://app.example.com/hp-release/raw-token');
expect(payload.evidencePackageUrl).toBe('https://app.example.com/hp-release/raw-token');
```

- [ ] **Step 5: Run targeted tests**

Run:

```bash
cd backend && npm test -- --run src/routes/holdpoints.test.ts src/routes/holdpoints/chaseNotifications.test.ts
```

Expected: PASS.

- [ ] **Step 6: Open PR 3**

PR title:

```text
fix: use public hold-point links for external emails
```

---

### Task 5: PR 4 - Align Hold-Point Gating With Release Visibility

**Files:**
- Modify: `backend/src/routes/itp/completions.ts`
- Modify: `backend/src/routes/holdpoints/listPresentation.ts`
- Modify: `backend/src/routes/holdpoints/listPresentation.test.ts`
- Modify: `backend/src/routes/holdpoints/requestReleaseRoutes.ts`
- Modify: `backend/src/routes/itp.test.ts`
- Modify: `frontend/src/pages/lots/components/ITPChecklistItemRow.tsx`
- Modify: `frontend/src/components/foreman/MobileITPChecklistSections.tsx`

- [ ] **Step 1: Add a shared predicate**

Create a helper near existing ITP/hold-point helpers:

```ts
export function isReleaseGatedChecklistItem(item: {
  pointType?: string | null;
  responsibleParty?: string | null;
}): boolean {
  return (
    item.pointType === 'hold_point' ||
    (item.responsibleParty === 'superintendent' && item.pointType !== 'witness')
  );
}
```

Use the same helper in completion gating and hold-point list/request selection.

- [ ] **Step 2: Add backend regression test**

In `listPresentation.test.ts`, add a checklist item:

```ts
checklistItem({
  id: 'sup-review',
  pointType: 'verification',
  responsibleParty: 'superintendent',
  sequenceNumber: 4,
});
```

Expected:

```ts
expect(result.map((item) => item.checklistItemId)).toContain('sup-review');
```

- [ ] **Step 3: Update completion route to use helper**

Replace the inline condition in `backend/src/routes/itp/completions.ts` with the shared helper:

```ts
const isHoldPointSignoffItem = isReleaseGatedChecklistItem(checklistItem);
```

- [ ] **Step 4: Update UI labels**

For release-gated superintendent items, show hold-point/release wording consistently in:

- `frontend/src/pages/lots/components/ITPChecklistItemRow.tsx`
- `frontend/src/components/foreman/MobileITPChecklistSections.tsx`

Expected user-facing state: a blocked item explains it needs release and appears in hold-point release lists.

- [ ] **Step 5: Run targeted tests**

Run:

```bash
cd backend && npm test -- --run src/routes/holdpoints/listPresentation.test.ts src/routes/itp.test.ts
cd frontend && npm test -- --run src/components/foreman/MobileITPChecklistSections.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Open PR 4**

PR title:

```text
fix: align release-gated ITP items with hold-point lists
```

---

### Task 6: PR 5 - Tighten Hold-Point Evidence Package Scope And Manual Evidence Traceability

**Files:**
- Modify: `backend/src/routes/holdpoints/evidencePackage.ts`
- Modify: `backend/src/routes/holdpoints/evidencePackage.test.ts`
- Modify: `backend/src/routes/holdpoints/actionRoutes.ts`
- Modify: `backend/src/routes/holdpoints/readRoutes.ts`
- Modify: `backend/prisma/schema.prisma` only if a direct relation is chosen
- Add migration only if `schema.prisma` changes

- [ ] **Step 1: Scope tests/photos to the hold-point checklist boundary**

Add evidence package tests:

```ts
it('excludes test results outside the hold-point checklist boundary', () => {
  const result = mapHoldPointEvidenceTestResults([
    { id: 'inside', itpChecklistItemId: 'item-before-hp' },
    { id: 'outside', itpChecklistItemId: 'item-after-hp' },
  ], { includedChecklistItemIds: new Set(['item-before-hp']) });

  expect(result.map((item) => item.id)).toEqual(['inside']);
});
```

For photos, use `ITPCompletionAttachment` checklist item ids rather than every lot photo.

- [ ] **Step 2: Implement scoped evidence mapping**

Build a set of included checklist item ids from the current hold-point package checklist. Filter:

- `TestResult.itpChecklistItemId`
- `ITPCompletionAttachment.completion.checklistItemId`

Keep lot-level documents out unless they are explicitly linked to one of those completions.

- [ ] **Step 3: Add manual release evidence traceability**

Preferred lightweight option for this PR:

- Store uploaded manual release evidence as a `Document`.
- Add structured release metadata to audit log changes:

```ts
{
  releaseEvidenceDocumentId: evidenceDocument.id,
  releaseMethod,
}
```

If product needs direct querying later, follow-up with a `HoldPointReleaseEvidence` model.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
cd backend && npm test -- --run src/routes/holdpoints/evidencePackage.test.ts src/routes/holdpoints.test.ts
```

Expected: PASS.

- [ ] **Step 5: Open PR 5**

PR title:

```text
fix: tighten hold-point evidence package scope
```

---

### Task 7: PR 6 - Queue ITP Evidence Photos Offline

**Files:**
- Modify: `frontend/src/lib/offline/core.ts`
- Modify: `frontend/src/lib/offline/photos.ts`
- Modify: `frontend/src/lib/offline/syncWorker.ts`
- Modify: `frontend/src/lib/offline/syncWorker.test.ts`
- Modify: `frontend/src/pages/lots/hooks/useLotPhotoUpload.ts`
- Modify: `frontend/src/pages/lots/hooks/useLotPhotoUpload.test.ts`
- Modify: `frontend/src/pages/subcontractor-portal/SubcontractorLotITPPage.tsx`
- Modify: `frontend/src/pages/subcontractor-portal/SubcontractorLotITPPage.test.tsx`

- [ ] **Step 1: Add offline payload fields**

Extend `OfflinePhoto`:

```ts
completionId?: string;
attachAs?: 'itp_completion_attachment' | 'ncr_evidence' | 'document_only';
```

- [ ] **Step 2: Add sync test for ITP evidence attach**

In `syncWorker.test.ts`, add a photo record:

```ts
{
  dataUrl: 'data:image/jpeg;base64,abc',
  fileName: 'itp.jpg',
  projectId: 'proj-1',
  lotId: 'lot-1',
  documentType: 'photo',
  category: 'itp_evidence',
  entityType: 'itp',
  entityId: 'completion-1',
  completionId: 'completion-1',
  attachAs: 'itp_completion_attachment',
  capturedAt: '2026-01-01T00:00:00.000Z',
}
```

Expected second request:

```ts
expect(authFetchMock).toHaveBeenNthCalledWith(
  2,
  '/api/itp/completions/completion-1/attachments',
  expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ documentId: 'doc-9' }),
  }),
);
```

- [ ] **Step 3: Implement attach branch**

After upload:

```ts
if (photo.attachAs === 'itp_completion_attachment' && photo.completionId) {
  const attachResponse = await authFetch(
    apiUrl(`/api/itp/completions/${encodeURIComponent(photo.completionId)}/attachments`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId }),
    },
  );

  if (!attachResponse.ok) {
    throw new Error((await attachResponse.text()) || 'Failed to attach ITP evidence');
  }
}
```

- [ ] **Step 4: Wire offline fallback in ITP photo upload**

In `useLotPhotoUpload.ts`, when offline, call `capturePhotoOffline` with:

```ts
{
  lotId,
  entityType: 'itp',
  entityId: completionId,
  completionId,
  attachAs: 'itp_completion_attachment',
  documentType: 'photo',
  category: 'itp_evidence',
  caption,
  capturedBy: user.id,
}
```

Return a temporary local attachment only if the UI can clearly show it as pending. Otherwise, toast "Photo saved offline and will attach when synced" and refresh after sync.

- [ ] **Step 5: Run targeted tests**

Run:

```bash
cd frontend && npm test -- --run src/lib/offline/syncWorker.test.ts src/pages/lots/hooks/useLotPhotoUpload.test.ts src/pages/subcontractor-portal/SubcontractorLotITPPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Open PR 6**

PR title:

```text
feat: sync ITP evidence photos offline
```

---

### Task 8: PR 7 - Access-Denied Regression Coverage

**Files:**
- Modify: `frontend/src/components/auth/ProjectProtectedRoute.test.tsx`
- Modify: `frontend/src/components/auth/ProjectProtectedRoute.tsx`
- Modify: `frontend/src/hooks/useProjectAccess.ts`
- Modify: `frontend/src/components/layouts/MainLayout.tsx`
- Modify: `frontend/src/components/layouts/MobileNav.tsx`
- Modify: `backend/src/routes/projects.test.ts`
- Modify: `backend/src/routes/projects/readRoutes.ts`
- Modify: `backend/src/routes/lots.test.ts`
- Modify: `backend/src/routes/lots/readRoutes.ts`

- [ ] **Step 1: Add project-role foreman capture regression test**

In `MainLayout.capture.test.tsx`, set user company role to `member`, mock project access role as `foreman`, set `isCameraOpen: true`, and assert the modal mounts.

Expected:

```ts
expect(screen.getByText('Opening camera...')).toBeInTheDocument();
```

- [ ] **Step 2: Align modal mounting with project role**

Make `MainLayout` use the same project access result as `MobileNav`, or extract a shared `useEffectiveProjectRole` hook used by both.

The decision rule should be:

```ts
const effectiveRole = projectAccessRole ?? companyRole;
const isForeman = effectiveRole === 'foreman';
```

- [ ] **Step 3: Add backend subcontractor access tests**

In `projects.test.ts` and `lots.test.ts`, cover:

- subcontractor user linked to active subcontractor company can read the project
- suspended/removed subcontractor link gets a specific forbidden response
- assigned lot read succeeds
- unassigned lot read is forbidden or absent according to existing route semantics

- [ ] **Step 4: Run targeted tests**

Run:

```bash
cd frontend && npm test -- --run src/components/layouts/MainLayout.capture.test.tsx src/components/auth/ProjectProtectedRoute.test.tsx
cd backend && npm test -- --run src/routes/projects.test.ts src/routes/lots.test.ts
```

Expected: PASS.

- [ ] **Step 5: Open PR 7**

PR title:

```text
fix: align project role access for foreman and subcontractor flows
```

---

## Verification Before Merging Each PR

- [ ] Run targeted package tests listed in the task.
- [ ] Run `cd frontend && npm run type-check` for frontend changes.
- [ ] Run `cd backend && npm run type-check` for backend changes.
- [ ] Run `npm run fallow:audit` from repo root if Fallow is available.
- [ ] Open a PR and let GitHub CI run.
- [ ] Do not squash-merge until CI passes.

## Out Of Scope For This Plan

- Full foreman shell v2 audit under `frontend/src/shell/**`.
- Redesigning diary media capture. Keep it as a separate product decision after the evidence bugs are stable.
- Replacing the whole documents module. PR 2 only makes lot-linked photos visible where they are needed.
