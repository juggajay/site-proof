# External Codebase Review - SiteProof / CIVOS

## 1. Executive summary

- Overall, ordinary project and company authorization is disciplined, but launch risk remains in capability-token redaction, replay safety, and workflow evidence integrity.
- Read F-01 first: full batch hold-point and subcontractor invitation capabilities can be retained in request logs and support telemetry despite being hashed at rest.
- Read F-03 and F-04 next: an ambiguous response can create a second partial claim or record the same bank payment twice.
- Read F-02, F-05, and F-06: quality state can commit without its NCR, a hold point can release ahead of prerequisites, and an NCR can close or remain closed after its evidence disappears.
- No additional conventional cross-tenant IDOR was verified; hold-point token hashing, expiry, and transactional single-use enforcement were otherwise sound.

Review target: commit `5e3f00f1f1cf` on 2026-07-10. This was a static adversarial review with focused frontend unit verification and no production access.

## 2. Findings table

| ID | Severity | Finding | Primary evidence |
| --- | --- | --- | --- |
| F-01 | High | Batch hold-point and subcontractor invitation tokens survive path redaction into operational telemetry | `backend/src/lib/logSanitization.ts:55`, `backend/src/middleware/requestLogger.ts:137`, `frontend/src/lib/logger.ts:75` |
| F-02 | High | A failed ITP completion can commit without the NCR that is supposed to disposition it | `backend/src/routes/itp/completions.ts:349`, `backend/src/routes/itp/completionWorkflow.ts:123` |
| F-03 | High | Retrying claim creation after a lost response can double-claim partial progress | `backend/src/routes/claims/workflowRoutes.ts:195`, `backend/prisma/schema.prisma:1319` |
| F-04 | High | Retrying a partial payment after a lost response records the same payment twice | `backend/src/routes/claims/postEvidenceWorkflowRoutes.ts:309`, `backend/src/routes/claims/workflowValidation.ts:167` |
| F-05 | High | Public hold-point release does not enforce preceding-item prerequisites | `backend/src/routes/holdpoints/requestReleaseRoutes.ts:312`, `backend/src/routes/holdpoints/publicReleaseExecution.ts:78` |
| F-06 | High | NCR evidence remains removable during verification and through generic document deletion after closure | `backend/src/routes/ncrs/ncrEvidence.ts:333`, `backend/src/routes/documents/deleteRoutes.ts:109`, `backend/prisma/schema.prisma:870` |
| F-07 | High | Core subcontractor work, ITP, and docket flows silently stop at the first 20 lots | `backend/src/routes/lots/readRoutes.ts:98`, `frontend/src/shell/subbie/screens/WorkScreen.tsx:161` |
| F-08 | High | Offline caching downgrades witness points to standard items, and sync submits a bare completion | `frontend/src/pages/lots/lib/itpOfflineMapping.ts:67`, `frontend/src/lib/offline/syncWorker.ts:300`, `backend/src/routes/itp.test.ts:3704` |
| F-09 | Medium-High | Witness auto-notification never emails the configured client and suppresses later lots | `frontend/src/pages/projects/settings/components/NotificationsTab.tsx:354`, `backend/src/routes/itp/helpers/witnessPoints.ts:169` |
| F-10 | Medium-High | Reusing a document on an unlocked ITP item can mutate metadata on locked evidence | `backend/src/routes/itp/completionAttachmentRoutes.ts:199`, `backend/src/routes/documents/access.ts:91` |

## 3. Detailed findings

### F-01 - Capability tokens survive path redaction into operational telemetry

**Defect.** The redactor treats the first segment after `/api/holdpoints/public/` as the token. That is correct for the single-release route, but on a batch route it redacts the literal `batch` segment and leaves the full batch token in the remaining path. There is no path rule for `sub_invite_*` tokens. The same incomplete sanitizer feeds request logs, error/Sentry context, and fatal-client-error support reports.

**Concrete failure scenario.** A superintendent opens `/api/holdpoints/public/batch/<64-hex-token>` and the request is logged as `/api/holdpoints/public/[REDACTED]/<64-hex-token>`. An operator, support mailbox reader, or observability integration with access to that record can replay the still-live token to inspect another project's evidence or release its hold points. A fatal React error on `/hp-release/batch/<token>` also forwards the raw pathname into the support report. Subcontractor invitation tokens take the same path through backend request logging.

**Evidence.**

`backend/src/lib/logSanitization.ts:55-56`:

```ts
.replace(/(\/api\/holdpoints\/public\/)[^/?#\s]+/gi, `$1${REDACTED_LOG_VALUE}`)
.replace(/\/(?:reset|magic|verify)_[^/?#\s]+/gi, `/${REDACTED_LOG_VALUE}`);
```

`backend/src/middleware/requestLogger.ts:137-147`:

```ts
const message = `${req.method} ${sanitizeLogUrl(req.originalUrl)} ${res.statusCode} ${duration}ms`;
logInfo(message);
```

`frontend/src/lib/logger.ts:75-81` and `backend/src/routes/support.ts:125-146` preserve `window.location.pathname` and sanitize it with the same incomplete text rule before logging and emailing it. Token creation is deliberately safer than this telemetry path: hold-point and invitation tokens are SHA-256 hashed before database storage (`backend/src/routes/holdpoints/requestReleaseRoutes.ts:341-360`, `backend/src/lib/subcontractorInvitations.ts:24-29`).

A direct helper invocation with synthetic 64-character tokens reproduced both failures: the batch path became `/api/holdpoints/public/[REDACTED]/<full-token>`, while the `sub_invite_` path was unchanged. Endpoint normalization subsequently removes part of a hex token, so `/api/metrics` exposes a suffix rather than a replayable full capability; the exploitable full-token copies are the request/error/support telemetry paths.

**Smallest fix.** Add specific-first redaction rules for `/api/holdpoints/public/batch/:token`, `/api/holdpoints/public/:token`, `/api/subcontractors/invitation/sub_invite_*`, `/hp-release/batch/:token`, and `/hp-release/:token`. Apply the same path sanitizer to frontend client-error paths. Derive metric keys from matched route templates rather than raw paths.

**Missing test.** `backend/src/middleware/requestLogger.test.ts:39-46` covers only `/api/holdpoints/public/:token`. Add batch summary/evidence/download/release, invitation, frontend path, and support-report cases that assert the complete raw token is absent.

### F-02 - A failed ITP completion can commit without its NCR

**Defect.** The ITP completion transaction commits first. NCR allocation, NCR creation, the NCR-lot link, and the lot status update run afterward in a separate transaction. The retry guard creates an NCR only on the first transition into `failed`, while the standard route also prevents changing an already-failed completion back to another status.

**Concrete failure scenario.** The completion transaction successfully stores `status = failed`. The later NCR allocation or insert fails due to a transient database error, and the API returns 500. Retrying the identical request reads an existing failed completion, so `shouldCreateFailedItpNcr('failed', 'failed')` is false. The failed ITP is now permanent, but it has no NCR and no ordinary repair path.

**Evidence.**

`backend/src/routes/itp/completions.ts:349-435`:

```ts
const { completion, shouldCreateFailedNcr } = await prisma.$transaction(async (tx) => {
  // create/update completion
});

if (shouldCreateFailedNcr) {
  // NCR is created after the completion transaction has committed
```

`backend/src/routes/itp/completionWorkflow.ts:119-127`:

```ts
export function shouldCreateFailedItpNcr(newStatus: string, existingStatus: string | null | undefined) {
  return newStatus === 'failed' && existingStatus !== 'failed';
}
```

`backend/src/routes/itp/completions.ts:376-380` separately rejects changing a failed completion through this route.

**Smallest fix.** Let the NCR number allocator accept the existing `Prisma.TransactionClient`, then create/update the completion, NCR, NCR-lot link, and lot status in one transaction. Keep a defensive retry repair: if a completion is already failed but has no linked NCR marker, create the missing NCR idempotently.

**Missing test.** `backend/src/routes/itp/completionWorkflow.test.ts:183-193` pins `failed -> failed` to no new NCR, and the healthy integration path tests deduplication. Add a failure-injection test between completion write and NCR creation, then assert retry repairs or the original transaction rolls back.

### F-03 - Claim creation is replayable after an ambiguous response

**Defect.** Claim creation has concurrency protection for claim numbering and cumulative percentages, but no request identity. Every accepted POST allocates the next claim number and inserts a new claim. The schema has uniqueness for `(projectId, claimNumber)` and `(claimId, lotId)`, not for a client operation.

**Concrete failure scenario.** A user claims 50% of a $100,000 lot. The server commits Claim 7 for $50,000, but the response is lost. The modal shows failure and tells the user to try again. The unchanged retry is a valid second 50% increment, so the server creates Claim 8 for another $50,000. The user intended one claim; the database now records 100% across two claims.

**Evidence.**

`backend/src/routes/claims/workflowRoutes.ts:195-206,339-370`:

```ts
for (let attempt = 1; attempt <= CLAIM_NUMBER_RETRY_LIMIT; attempt += 1) {
  claimResult = await prisma.$transaction(async (tx) => {
    const nextClaimNumber = (lastClaim?.claimNumber || 0) + 1;
    const claim = await tx.progressClaim.create({
      data: { projectId, claimNumber: nextClaimNumber, claimedLots: { create: ... } },
    });
```

`backend/src/routes/claims/workflowValidation.ts:33-97` accepts periods, lots, percentages, and variation IDs only. `frontend/src/pages/claims/components/CreateClaimModal.tsx:232-257` sends no request key and recommends retry on failure.

**Smallest fix.** Generate one UUID when the modal starts submission, retain it across retries, store it on `ProgressClaim`, and add a unique `(projectId, requestKey)` constraint. Under the existing transaction, return the already-created claim when that key is replayed.

**Missing test.** Existing tests prove successive partial claims are valid and serialize concurrent percentage updates (`backend/src/routes/claims.test.ts:1118-1206`). Add sequential and concurrent same-key replay tests that both return one claim ID and one claimed-lot row.

### F-04 - Partial-payment recording is replayable

**Defect.** The payment route correctly locks the claim row, but it cannot distinguish a retry from a new bank payment. Each accepted request increments `paidAmount` and appends a new JSON history entry. Neither the request schema nor the history record has an idempotency key.

**Concrete failure scenario.** A $400 payment against a $1,000 certified claim commits, but the response drops. The payment dialog says to try again and still shows stale outstanding state. The retry sees $600 outstanding, records a second $400, and reports $800 paid for one transfer.

**Evidence.**

`backend/src/routes/claims/postEvidenceWorkflowRoutes.ts:309-393`:

```ts
await tx.$queryRaw`SELECT id FROM progress_claims ... FOR UPDATE`;
const totalPaid = roundClaimAmountToCents(previousPaidAmount + roundedPaidAmount);
paymentHistory.push({
  amount: roundedPaidAmount,
  reference: paymentReference || null,
  recordedAt,
});
await tx.progressClaim.update({ data: { paidAmount: totalPaid, disputeNotes: ... } });
```

`backend/src/routes/claims/workflowValidation.ts:167-178` has no request key. `frontend/src/pages/claims/ClaimsPage.tsx:432-459` posts only the payment form and recommends retry on error.

**Smallest fix.** Generate and retain a payment operation UUID in the dialog. Store it with each payment-history entry and, while holding the existing claim lock, return the prior result when the key already exists.

**Missing test.** `backend/src/routes/claims.test.ts:2924` covers concurrent distinct payments, not replay of the same operation. Add lost-response-equivalent sequential and concurrent same-key tests.

### F-05 - Public hold-point release bypasses preceding-item prerequisites

**Defect.** The single request route checks preceding checklist completions when the release request is created. The batch request explicitly permits incomplete preceding items. The shared public token executor validates token use/expiry and terminal hold-point state, but never reloads or validates prerequisites before marking the hold point and ITP completion released/verified.

**Concrete failure scenario.** A project sends a batch review package before the preceding inspection steps are complete, which the API intentionally permits. The reviewer immediately releases the hold point. CIVOS stores the hold point as released and upserts a verified, completed ITP item even though prerequisite work remains incomplete. The single-link route has the same time-of-check/time-of-use problem if a prerequisite is reopened after request creation.

**Evidence.**

`backend/src/routes/holdpoints/requestReleaseRoutes.ts:312-319`:

```ts
// A batch request is a superintendent review package. Earlier incomplete
// checklist items ... should not stop the package from being sent for review.
return { itemRequest, holdPointItem, existingHoldPoint };
```

`backend/src/routes/holdpoints/publicReleaseExecution.ts:78-196` consumes the token, sets `status: 'released'`, and upserts:

```ts
const completionData = {
  status: 'completed',
  verificationStatus: 'verified',
  verifiedAt: releasedAt,
};
```

There is no preceding-item query or guard in that transaction.

**Smallest fix.** Inside `executeHoldPointTokenRelease`, load the assigned ITP snapshot and current completions, call the existing prerequisite helpers, and reject without consuming the token when preceding items are incomplete.

**Missing test.** `backend/src/routes/holdpoints/requestReleaseRoutes.delivery.test.ts:486` accepts an incomplete batch request. `backend/src/routes/holdpoints/publicBatchRoutes.test.ts:330` covers membership, replay, and healthy atomic release, but not release-time prerequisite rejection. Add both batch and stale-single-link cases.

### F-06 - NCR evidence is mutable during verification and after closure

**Defect.** There are two independent lifecycle bypasses. The NCR-specific removal route blocks only `closed` and `closed_concession`, so responsible parties and uploaders can remove the last evidence while the NCR is in `verification`; closure does not recheck evidence. After closure, the generic document delete route blocks only selected document types and deletes the `Document`, while the `NCREvidence -> Document` foreign key cascades the evidence link.

**Concrete failure scenario.** A subcontractor uploads the required rectification photo and submits the NCR for verification. While it is awaiting closure, the uploader removes that evidence through the NCR endpoint. A quality manager then closes the NCR because the close transaction checks only `status = verification`. Separately, after a properly evidenced NCR is closed, the document uploader calls generic `DELETE /api/documents/:id`; the document and closed NCR evidence link disappear.

**Evidence.**

`backend/src/routes/ncrs/ncrEvidence.ts:333-360`:

```ts
if (ncr.status === 'closed' || ncr.status === 'closed_concession') {
  throw AppError.badRequest('Cannot remove evidence from a closed NCR');
}
await prisma.nCREvidence.delete({ where: { id: evidenceId } });
```

`backend/src/routes/ncrs/ncrClosureWorkflow.ts:282-298` closes with `where: { id, status: 'verification' }` and no evidence predicate. `backend/src/routes/documents/deleteRoutes.ts:109-116,166` applies only the generic type block and then calls `tx.document.delete`. The relationship is cascading at `backend/prisma/schema.prisma:870-880`:

```prisma
document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
```

The versioning route already recognizes the intended boundary and rejects generic versioning of NCR evidence (`backend/src/routes/documents/versionRoutes.ts:56-81`); deletion lacks the equivalent guard.

**Smallest fix.** Make `verification`, `closed`, and `closed_concession` evidence immutable through the NCR route. Add `ncrEvidence: { some: {} }` to the conditional close update. In generic document deletion, detect any workflow evidence link and require removal through the owning workflow (or reject it outright once immutable).

**Missing test.** The suite tests submission without evidence and locked ITP document deletion, but not remove-last-evidence during NCR verification or generic deletion of a document linked to a closed NCR. Add both paths and assert the document/link survive.

### F-07 - Core subcontractor flows silently stop at 20 lots

**Defect.** The lots API defaults to page 1 with 20 records. The subbie mobile Work and ITP screens, their classic portal equivalents, and the docket lot selector each make one request and discard pagination metadata. They neither request a larger bounded page nor load subsequent pages.

**Concrete failure scenario.** A subcontractor is assigned 35 lots. Only the first 20 appear in Work and ITPs. The other 15 cannot be opened from those core screens and cannot be selected for a docket, even though authorization and assignment data are correct.

**Evidence.**

`backend/src/routes/lots/readRoutes.ts:98-101,171-191`:

```ts
const page = parsePositiveIntQuery(req.query, 'page', 1);
const limit = parsePositiveIntQuery(req.query, 'limit', 20, 100);
// findMany({ skip, take }) and return pagination metadata
```

`frontend/src/shell/subbie/screens/WorkScreen.tsx:161-168`:

```ts
const res = await apiFetch<{ lots: Lot[] }>(
  `/api/lots${projectQuery}${projectQuery ? '&' : '?'}portalModule=lots`,
);
return res.lots ?? [];
```

The same one-shot shape appears in `frontend/src/shell/subbie/screens/ItpsScreen.tsx:172-179`, `frontend/src/pages/subcontractor-portal/AssignedWorkPage.tsx:100-110`, `frontend/src/pages/subcontractor-portal/SubcontractorITPsPage.tsx:107-119`, and `frontend/src/pages/subcontractor-portal/docketEditData.ts:130-135,280-287`.

**Smallest fix.** Add paginated/infinite loading to list screens. For selectors that require a complete option set, add one reusable `fetchAllLotPages` helper that requests `limit=100` and follows `pagination.totalPages`.

**Missing test.** The current screen tests pin the unpaginated URLs (`WorkScreen.test.tsx:102-107`, `ItpsScreen.test.tsx:108-115`). Add a two-page response with more than 20 lots and assert all records remain reachable/selectable.

### F-08 - Offline caching downgrades witness points to standard items

**Defect.** `OfflineChecklistItem` stores only `isHoldPoint`, not `pointType`. Reconstructing an ITP from cache therefore converts every non-hold item, including witness points, to `standard`. The UI gates witness capture only when `pointType === 'witness'`. Offline sync sends no witness fields, and the backend currently accepts a bare completion for a canonical witness item.

**Concrete failure scenario.** A foreman opens an ITP online, caching a witness item, then loses reception. The cached ITP reconstructs that item as standard. Tapping complete bypasses the witness modal and queues a normal completion. When reception returns, the worker submits it without witness presence/name/company, and the backend accepts it. The compliance record says the witness item passed without a witness record.

**Evidence.**

`frontend/src/pages/lots/lib/itpOfflineMapping.ts:74-80,101-108`:

```ts
return { id: item.id, isHoldPoint: item.isHoldPoint, status };
// ...later...
pointType: item.isHoldPoint ? 'hold_point' : 'standard',
```

The test explicitly characterizes the loss at `frontend/src/pages/lots/lib/itpOfflineMapping.test.ts:407-417`. The UI gate is `item?.pointType === 'witness'` at `frontend/src/pages/lots/hooks/useItpInstance.ts:231-240`. The sync request body at `frontend/src/lib/offline/syncWorker.ts:300-331` has no witness fields, while `backend/src/routes/itp.test.ts:3704-3720` asserts that a bare witness completion succeeds.

**Smallest fix.** Persist canonical `pointType` in `OfflineChecklistItem` and preserve it during round-trip mapping. Carry witness data in the queued completion. On the server, load the canonical checklist item and reject completion of a witness item unless the required witness decision/details are present.

**Missing test.** Replace the current lossiness characterization with a witness-preservation test, then add an offline queue-to-sync test and a backend rejection test for a bare canonical witness item. The focused mapping suite currently passes all 23 tests, including the test that documents the defect.

### F-09 - Witness auto-notification does not notify the configured client

**Defect.** Project settings promise client auto-notification and collect a client email. The backend resolves that address but only creates in-app notifications for internal project users; it never sends an email. It then deduplicates by project plus template checklist-item ID embedded in `linkUrl`. Since template item IDs are reused across lots, the first lot suppresses later lots.

**Concrete failure scenario.** A project manager configures the superintendent's email. A foreman completes the item before a witness point on Lot A. The superintendent receives no email. The helper creates an internal notification whose URL contains the template item ID. When the same template reaches that witness point on Lot B, the project-wide lookup finds Lot A's notification and suppresses every notification for Lot B.

**Evidence.**

`frontend/src/pages/projects/settings/components/NotificationsTab.tsx:354-415` says "Automatically notify clients" and labels the field "Email address for witness point notifications."

`backend/src/routes/itp/helpers/witnessPoints.ts:169-179,190-223`:

```ts
const existingNotification = await prisma.notification.findFirst({
  where: { projectId: project.id, type: 'witness_point_approaching', linkUrl: { contains: nextItem.id } },
});
// creates prisma.notification rows for project users only
return { witnessPoint: nextItem, notificationsSent: notificationsCreated.length, clientEmail, clientName };
```

`frontend/src/pages/lots/lib/itpCompletionWrite.ts:53-81` types the response as `{ completion }` and discards the returned notification metadata.

**Smallest fix.** Send the configured address through the existing email service and surface a delivery failure instead of reporting silent success. Scope deduplication to `lotId + checklistItemId + recipient` (preferably a deterministic stored key rather than a URL substring).

**Missing test.** `backend/src/routes/itp/helpers/witnessPoints.test.ts:4-96` covers settings parsing only. Add actual client delivery, delivery failure, and two lots using the same template item.

### F-10 - ITP attachment reuse can mutate locked evidence metadata

**Defect.** When attaching an existing `Document` to an unlocked completion, the route checks the target completion's lock and calls `canReadDocument`. It then updates shared document caption/GPS directly. It does not call the canonical document mutation guard, which would detect that the same document is already attached to a verified or not-applicable completion.

**Concrete failure scenario.** Document D is evidence on verified completion A. An ITP writer attaches D to pending completion B in the same project/lot and supplies a new caption or GPS coordinate. B is unlocked and D is readable, so the route mutates D. Completion A's locked evidence now displays a changed description/location without reopening or invalidating its verification.

**Evidence.**

`backend/src/routes/itp/completionAttachmentRoutes.ts:199-252`:

```ts
assertItpCompletionEvidenceUnlocked(completion); // target completion B only
if (documentId) {
  // ...same project/lot and canReadDocument checks...
  document = await prisma.document.update({ where: { id: existingDocument.id }, data: updateData });
}
```

The canonical guard at `backend/src/routes/documents/access.ts:91-118,566-586` queries all attachment links and rejects a document linked to a verified/not-applicable completion via `requireNoLockedItpEvidenceAttachment`. This route bypasses it.

**Smallest fix.** Before changing caption/GPS, call `requireDocumentMutationAccess(req.user!, existingDocument)`. If no metadata is supplied, a read-authorized link to B can remain allowed if intentional.

**Missing test.** `backend/src/routes/itp.test.ts:1494-1525` confirms existing-document metadata mutation, while `backend/src/routes/itp.test.ts:1591-1699` locks only the target completion. Add verified A plus pending B sharing D; expect 409, unchanged metadata, and no new link.

## 4. Gaps I could not verify

- **Production token exposure (unverified):** code proves that vulnerable paths can retain raw capability tokens, but I did not inspect production logs, Sentry events, support emails, or retention settings. Determine whether any still-live tokens were captured, then expire/reissue them if necessary.
- **Existing inconsistent records (unverified):** a safe production aggregate is needed to determine whether there are already failed ITP completions without linked NCRs, verification/closed NCRs with zero evidence, or duplicate replay-created claims/payments. No production database query was run.
- **Ingress controls (unverified):** `server.ts` mounts `/api/metrics` for any company owner/admin, but an external gateway could restrict it. The metric normalizer leaks only a non-replayable token suffix for 64-hex batch tokens; the full-token defect is in logs/error/support paths.
- **Backend execution (unverified):** focused backend Vitest files did not execute because the repository safety guard rejected the configured non-local database. I did not bypass that guard. Focused frontend suites completed successfully: 58/58 tests passed across offline ITP mapping, Work, ITPs, and docket lot-data behavior.
- **Dockets and Xero:** no additional finding was promoted. The strongest docket allocation candidate required raw API/legacy partial or multi-lot rows, and the historical Xero cumulative behavior matches the documented export-at-time design.
