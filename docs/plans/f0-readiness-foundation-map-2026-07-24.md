# F0 Foundation Map — the existing readiness engine and its neighbours

**Purpose:** factual foundation for the F0 execution specification ("shared readiness/action/evidence model" — Rev 1.2a §2). Facts only, with citations; no recommendations. The spec author writes against this document so the spec cites code, not assumptions.

**Verified against:** commit `3d9b4a90` (#1539). The two later commits at time of mapping were #1540 (docs-only) and #1541 (bounded escalation — covered below from its commit object; re-cite line numbers before relying on them). Line numbers cited are current at #1539.

**Headline:** there is **one pure lot-readiness engine** but **four independent claim/conformance readiness computations** and **five distinct definitions of "hold point released"**, none stored (all request-time), no server cache. The AiProposal review flow (#1479) is a first-class input for F0's Decision entity.

---

## 1. The existing Evidence Readiness engine

**Where it lives (pure library, DB-free):**
- `backend/src/lib/evidenceReadiness/core.ts` — all types + bucket helpers (`item`, `splitItems`, `bucketState`, `summarize`, `reviewBucket`).
- `backend/src/lib/evidenceReadiness.ts` — `buildLotReadinessFromInputs()` (`:504-563`): the main entry. Composes three item-builders: `buildConformanceItems` (`:73-211`), `buildClaimItems` (`:218-390`), `buildManagementPrepItems` (`:392-491`). Also `filterCommercialReadiness()` (`:565-596`) strips `area==='budget'` items for non-commercial roles.
- `backend/src/lib/evidenceReadiness/claimReview.ts` — `buildClaimEvidenceReviewFromInputs()` (`:8-345`): a **separate** claim-evidence computation with different thresholds (see §5).
- `backend/src/lib/conformancePrerequisites.ts` — `computeConformanceResult()` (`:397-511`): the authoritative conform gate; produces the `prerequisites` object the engine consumes.

**Current data shape (core.ts):**
- `EvidenceReadinessSeverity = 'blocker' | 'warning' | 'support'` (`core.ts:1`).
- `EvidenceReadinessArea` — 11 values: `conformance, claim, itp, hold_point, test, ncr, docket, diary, document, budget, permission` (`core.ts:3-14`).
- `EvidenceReadinessItem` (`core.ts:16-36`): `code, severity, area, title, detail, blocksAction:boolean, actionLabel?, actionHref?, count?, relatedIds?[], outstandingTests?[]`. **`blocksAction`** is the load-bearing flag — it, not `severity`, gates actions (a `blocker`-severity item with `blocksAction:false` is advisory).
- `ReadinessBucket` (`core.ts:38-49`): `state` (`ready|blocked|warning|already_conformed|already_claimed|not_conformed`) + `blockers[]/warnings[]/support[]`.
- `LotEvidenceReadiness` (`core.ts:79-100`): `lotId, lotNumber, status, conformStatus, conformance:ReadinessBucket, claim:ReadinessBucket(+budgetAmount?/claimedInId?/claimedPercentage?/remainingPercentage?), managementPrep?:ManagementPrepBucket, summary:{blockerCount,warningCount,supportCount,actionBlockerCount}`.
- Bucket-state derivation (`core.ts:254-271`): `blocked` if any item `blocksAction`; else `warning` if any blocker/warning severity; else `ready`.

**Where computed — request-time, NOT stored, NOT cached.** Two backend call sites only:
1. `GET /api/lots/:id/readiness` — `backend/src/routes/lots/qualityRoutes.ts:209-301`. Fetches lot via `fetchLotReadinessRecord` (`:53-110`, deep select) + `Promise.all` of 7 counts/checks (`:240-264`) incl. `checkConformancePrerequisites(id)`, then `buildLotReadinessFromInputs` (`:270`). Also computes `managementPrep` inline via `buildManagementPrepSnapshot` (`:112-160+`).
2. `GET /api/projects/:projectId/claim-readiness` — `backend/src/routes/claims/readRoutes.ts:154-264`. `lot.findMany` over all project lots (`:161`), `checkConformancePrerequisitesBatch` (`:216`), then `buildLotReadinessFromInputs` per lot (`:226`).

**Consumer surfaces:**
- Backend routes: the two above, plus `GET /api/projects/:projectId/claims/:claimId/completeness-check` → `buildClaimEvidenceReviewFromInputs` (`routes/claims/presentation.ts:293`).
- Frontend types mirror at `frontend/src/types/evidenceReadiness.ts` (full field parity).
- Frontend consumers: `LotReadinessPanel.tsx` (lot-detail card; renders conformance/claim/managementPrep buckets, flattens blockers+warnings+support into one icon-differentiated list, max 4-5 items), `QualityManagementSection.tsx` (reads only `readiness.conformStatus.prerequisites`), `useLotReadinessNavigation.ts` (maps `item.code` → tab nav; only `no_itp`/`no_itp_assigned` get special routing; `relatedIds` unused), `CreateClaimModal.tsx` (uses `claim.blockers` `blocksAction` to disable lot checkboxes), `CompletenessCheckModal.tsx` (renders claim-evidence review; explicitly advisory — "Evidence blockers do not change this claim's status").
- React Query keys (`frontend/src/lib/queryKeys.ts`): `lotReadiness(id)` (`:11`) and `claimReadiness(projectId)` (`:44`) are live; `claimEvidenceReview` (`:45`) is **defined but dead** — completeness-check fetches with manual `useState`, not the cache.
- **Mobile shell does NOT consume this engine** — it derives its own `LotReadinessLine` locally (see §5 A1).

## 2. Claim readiness (lot→claim eligibility)

Two distinct, differently-shaped surfaces:
- **`ProjectClaimReadiness`** (`/claim-readiness`, used to *build* a claim): per-lot `claim:ReadinessBucket` from `buildClaimItems` (`evidenceReadiness.ts:218-390`). Gating: `already_claimed` if `status==='claimed'||claimedInId` (`:225`, blocksAction), `not_conformed` if `status!=='conformed'` (`:249`, blocksAction), else `getClaimBlockingReasonsForConformedLot` (`conformancePrerequisites.ts:165-206`) detects post-conformance regressions. Adds `missing_budget` blocker (commercial only), `unreleased_hold_points` (blocksAction **false**), `pending_tests` (warning). Cumulative claiming: `claimedPercentage`/`remainingPercentage` via `getCumulativeClaimedPercentByLot` (`readRoutes.ts:209`).
- **`ClaimEvidenceReview`** (`/completeness-check`, used to *review* an existing claim): `claimReview.ts` — entirely separate thresholds, **everything `blocksAction:false`** (advisory pack), photo-count heuristics (`<3` warning), hold-point readiness keyed off `completion.verificationStatus` not `HoldPoint.status`.

**Hard claim gate (server-enforced, separate from readiness):** lot must be `status==='conformed'`. Stored decision on `Lot`: `conformedAt/conformedById` + override trio `conformanceOverriddenAt/ById/Reason` (`schema.prisma:554-566`). Claim-eligibility readiness is a *view*; the write-time gate is in the claim-create path.

## 3. Future consumers' current state (Prisma models + enums)

Status/enum values are **free-text `String` columns** everywhere — no Prisma enums; vocabularies are convention enforced only in app code.

**(a) Hold points** — `HoldPoint` (`schema.prisma:715+`): `lotId`, `itpChecklistItemId` (unique together), `pointType`, `status` (`pending|notified|released|completed|...`), `releasedByName/releasedByOrg/releasedAt/releaseMethod/releaseSignatureUrl/releaseNotes`, `evidencePackageUrl`, escalation fields. **No `releasedByUserId` FK** — release identity is free-text name+org. External release via `HoldPointReleaseToken` (`:759`, `sha256:`-hashed) and `HoldPointReleaseBatch` (`:785`, "review room" grouping per-hold-point tokens under one secure link — a partial "package" concept). Indexes: `[lotId,status]`, `[status,createdAt]`, `[status,scheduledDate]`.

**(b) ITP / test state machine** — `ITPTemplate`→`ITPChecklistItem` (`:628`; `pointType`, `responsibleParty`, `evidenceRequired`, `testType`) → `ITPInstance` (`:649`; 1:1 lot, `templateSnapshot` JSON) → `ITPCompletion` (`:666`): `status`(`pending|in_progress|completed|not_applicable|failed`), `verificationStatus`(`none|pending_verification|verified|rejected`), `verifiedById/verifiedAt`, `completedById`, GPS. **`itpChecklistItemId` wiring:** `TestResult.itpChecklistItemId` links a test to a checklist item; conformance match is direct-link-OR-testType-match (`conformancePrerequisites.ts:261-287`). `TestResult` (`:809`): `status`(`requested|at_lab|results_received|entered|verified` + others), `passFail`(`pending|pass|fail`), `certificateDocId`, `verifiedById/rejectedById`, `aiExtracted/aiConfidence`. Indexes: `ITPCompletion[verificationStatus]`, `TestResult[projectId,status]` + `[projectId,passFail]`.

**(c) NCR lifecycle** — `NCR` (`:863`): `status`(`open|investigating|rectification|verification|closed|closed_concession`), `severity`(`minor|major`, default minor), `category`(freeform), full decision-record columns: `qmApprovalRequired/qmApprovedById/At`, `qmReviewedById/At/Comments`, `verifiedById/At/Notes`, `closedById/At`, `raisedById/At`, `respondedById/At`, `revisionRequested/revisionCount`, concession trio (`concessionJustification/concessionRiskAssessment/clientApprovalReference`), `clientNotificationRequired/clientNotifiedAt`, `dueDate`, escalation fields. Junctions `NCRLot` (`:948`), `NCREvidence`. Indexes: `[projectId,status]`, `[projectId,dueDate]`, `[projectId,category,status]`.

**(d) Diary/dockets → lots** — `DailyDiary` (`:978`, `status: draft|submitted|...`, per-project-per-date). Diary sub-tables (`DiaryActivity/Delivery/Event/Delay/Plant/Personnel`) all carry `lotId` FKs. `DailyDocket` (`:1303`, `status: draft|pending_approval|approved|...`, `approvedById/At`) links to lots via `DocketLabourLot`/`DocketPlantLot` allocation junctions. The readiness engine reads only **counts** of these — and both are passed as **constant 0** at both call sites (`qualityRoutes.ts:290-291`, `readRoutes.ts:251-252`): the docket/diary support items are defined in the type but never populated today.

**(e) Alerts / needs-attention** — `NotificationAlert` (`@@map("notification_alerts")`, `schema.prisma:330-353`): `type/severity/title/message` (free strings), `entityId/entityType`, `assignedToId`, `projectId?`, `resolvedAt/escalatedAt/escalationLevel/escalatedTo Json?`. App-level `AlertType='overdue_ncr'|'stale_hold_point'|'pending_approval'|'overdue_test'` (`routes/notifications/alertMappers.ts:22`). Indexes keyed on `resolvedAt`; **partial unique index** `notification_alerts_active_type_entity_key WHERE resolved_at IS NULL` (#1530; migration `20260724070000`, noted `schema.prisma:349-352`).
Key facts for F0:
1. `notification_alerts` has **zero frontend consumers** — its only user-visible output is a mirrored `Notification` row + emails.
2. **One creation path** (#1530): `lib/notificationAutomation/systemAutomation.ts` `processSystemAlerts` (`:223-475`), called by both the hourly worker (`runner.ts:153`, advisory lock `731452021`) and the admin route (`routes/notifications/systemAlerts.ts:48` — pure delegation). Creators catch `P2002` as lost-race-skip (`alertPersistence.ts:28-38`).
3. **Auto-resolution + expiry** (#1534/#1537): `systemAlertResolution.ts` runs FIRST each pass (`systemAutomation.ts:205-208`), stamps `resolvedAt` when the creation condition inverts, paginated 500/batch; diary alerts also expire unconditionally at `STALE_DIARY_MAX_AGE_DAYS = 30` (`systemAlertResolution.ts:35,167-169`).
4. **Bounded escalation** (#1541, cite fresh line numbers before use): `lib/notificationAutomation/alertEscalations.ts` — forward-cursor pagination, idempotent via optimistic `updateMany` pinning `escalationLevel` + `resolvedAt: null`, escalate-and-notify capped 200/run with overflow logging, level 2 terminal.
5. Every dashboard "attention/overdue/pending/at-risk" surface (`dashboard/statsRoute.ts`, `roleDashboards.ts`, `operationalRoutes.ts`, `portfolio.ts`, `projectManagerDashboardRoute.ts`) **recomputes fresh from raw entities at request time and never reads `notification_alerts`**.
6. `overdue_test` is declared + escalation-configured but has **no creator** — never emitted.

## 4. Decision / audit primitives (what F0's Decision/ExceptionOrWaiver can build on)

- **`AuditLog`** (`schema.prisma:1634`): `projectId?, userId?, entityType, entityId, action, changes(JSON), ipAddress, userAgent, createdAt`. Single writer helper `backend/src/lib/auditLog.ts`: `createAuditLog()` (`:92`, best-effort, swallows errors) + `writeAuditLogInTransaction()` (`:110`, hard-fail, shares tx — used for privileged ops). `changes` sanitized (redacts password/token/signature). **Frozen action enum `AuditAction`** (`:140-245`, ~90 values) incl. `lot_force_conformed`, `lot_status_changed`, `hp_released`, `hp_public_released`, `hp_release_requested`, `ncr_qm_approved`, `itp_item_verified/rejected`, `ai_proposal_*`. `entityType` is convention-only free string. **No `decision_*`/`waiver_*`/`exception_*` action exists** — overrides ride on `lot_force_conformed`/`lot_status_changed` with a `changes.force`/`changes.override` flag.
- **`AiProposal`** (#1479; `schema.prisma:1859-1880`, `@@map("ai_proposals")`) — the AI-originated decision record and a first-class F0 input:
  - Fields: `projectId, stage` (`'project_facts'|'control_line'|'plan_sheets'|'lot_breakdown'`, open set), `status` (`proposed → accepted|edited|rejected|superseded|rolled_back`), `requestedById`, `model`, `sourceRefs Json` (citations), **`payload Json` — immutable, never updated**, `warnings Json?`, `decidedById?/decidedAt?`, **`editedPayload Json?`** (human edits stored separately from the immutable payload), **`appliedRecordIds Json?`** (`[{model, ids, meta?}]` — the rollback target). Indexes `[projectId,stage]`, `[projectId,status]`.
  - Design intent (comment `:1857-1858`): immutable proposal + separate edits trail keeps an AI-assisted QA pack insurable (PI exclusions for un-audited AI) — the compliance rationale F0's Decision entity inherits.
  - Service `backend/src/routes/copilot/proposalService.ts`: `createProposal` (`:67-102`, supersedes any live `proposed` for the same project+stage → at most one pending per project+stage; audits `ai_proposal_created`); `decideProposal` (`:131-182`, only `proposed` decidable; accept runs the stage's registered apply handler **in the same transaction**, stores `appliedRecordIds`; accept-with-edits → status `edited`, `payload` untouched; audits accepted/edited/rejected); `rollbackProposal` (`:194-231`, only accepted/edited; stage rollback handler deletes/restores applied records; audits rolled_back). Per-stage `applyHandlers`/`rollbackHandlers` registries (`:48-49`) registered at import time by executor modules.
  - Routes `backend/src/routes/copilot/index.ts:322-406`; cross-project access is 404.
  - **Audit relationship:** AiProposal does not replace AuditLog — every create/decide/rollback also appends an `AuditLog` row (`entityType='ai_proposal'`). Two immutable trails. F0 should treat AiProposal as the canonical AI-originated decision and reuse its accept/edit/reject/rollback vocabulary rather than duplicating it.
- **Hold-point release identity**: authenticated `POST /:id/release` (`routes/holdpoints/actionRoutes.ts:311-632`) stores free-text name/org on `HoldPoint` **and** the authenticated `userId` on the reconciled `ITPCompletion`. External token release (`routes/holdpoints/publicReleaseExecution.ts:66-200`) stores identity on the token + HoldPoint, leaves completion user-ids null, logs both `effectiveReleasedByName` and `submittedReleasedByName`.
- **Conformance/override**: `POST /:id/conform` (`qualityRoutes.ts:338-449`) — force requires `reason≥5 chars` + `LOT_FORCE_CONFORMERS` role; persists override trio only on force. `POST /:id/override-status` (`:452-557`) de-conform clears conformance stamps.
- **NCR approval**: `ncrClosureWorkflow.ts` — `qm-approve` (`:125`), `close` (`:205`) enforces **segregation of duties** (closer ≠ QM approver for major NCRs, `:254-266`); major+concession requires `clientApprovalReference`.

## 5. Tension points — independent computations of the same concept (what F0 unifies)

**A1 — "lot ready / conformable" — 4 definitions, increasingly loose:**
1. `conformancePrerequisites.ts:472-477` `canConform` — authoritative: `itpAssigned && itpCompleted && (!testRequired||hasPassingTest) && noOpenNcrs && noNaHoldPointBypass`.
2. `routes/itp/helpers/lotProgression.ts` auto-progression to `completed` — tightened in #1436 (shares completion-exclusion `:76-81`; hold-point release gate `:82-88`; writes `LOT_STATUS_CHANGED` audit with `auto:true` `:145-155`) **but still counts a test item complete via ITP completion status without inspecting `TestResult.passFail/status`** (`completedTestCount`, `:110`) and only guards `ncr_raised` by early-return (`:45`), not open-NCR count. A lot still reaches `completed` with no passing/verified test.
3. `frontend/src/shell/screens/lots/lotsShellState.ts:487-521` `deriveLotReadinessLine` — `conformable = total>0 && remainingItp===0 && openNcrs===0`; no test-verification, no hold-point, no budget gate. Deliberately does not call the office endpoint.
4. `evidenceReadiness.ts:73-211` `buildConformanceItems` — re-expresses #1 as items, but for already-conformed lots uses `getClaimBlockingReasonsForConformedLot` (`conformancePrerequisites.ts:165-206`), a **subset** predicate (skips ITP/test checks when overridden; always enforces NCR + N/A-hold-point).

**A2 — "hold point released / unreleased" — 5 distinct signals:**
1. `HoldPoint.status === 'released'` (canonical) — `conformancePrerequisites.ts:528-534`, `qualityRoutes.ts:250-251`, `readRoutes.ts:246-249`, `claimReview.ts:98`.
2. `completion.verificationStatus !== 'verified'` — `claimReview.ts:60-65` (keyed off completion, not HoldPoint).
3. `completion.holdPointRelease.releasedByName` present — `lotsShellState.ts:338-348`.
4. `TERMINAL_HOLD_POINT_STATUSES = {'released','completed'}` — `qualityRoutes.ts:45,141,153` (management-prep counts `completed` as done; conformance accepts only `released`).
5. Stale-hold-point: **two divergent definitions survive the alert consolidation** — alert engine `status in [requested,scheduled] && scheduledDate < now-1d` (`systemAutomation.ts:306-317`) vs dashboards `status in [pending,scheduled,requested] && created_at < now-7d` (`portfolio.ts:235-243`, `statsRoute.ts:131-140`). Different on all three axes (status set, date column, threshold).

**A3 — "test pending/passing/verified" — 4+ predicates:**
- Passing (conformance, item-matched): `passFail==='pass' && status==='verified'` + match — `conformancePrerequisites.ts:281-287,455-457`.
- Passing (claim, lot-wide, no match): same boolean — `claimReview.ts:139`, `claims/evidenceRoutes.ts:238`.
- Pending = "not fail and not verified": `claimReview.ts:136`, `evidenceRoutes.ts:242`.
- Pending = status whitelist `PENDING_TEST_RESULT_STATUSES` (`lib/testResultStatus.ts:1-8`) — `qualityRoutes.ts:255`, `readRoutes.ts:255-257`. **Diverges** from "not-fail-not-verified" on edge statuses.
- "Test done" for auto-progression: not a TestResult check at all (`lotProgression.ts:110`).

**A4 — "NCR open/overdue":** *open* is consistent (`status notIn ['closed','closed_concession']` everywhere). *Seriousness* drifts: `claimReview.ts:206-207` uses `severity in ['major','critical']` (`'critical'` is not a documented severity value → likely dead branch); dashboards use `category==='major'` (`portfolio.ts:218`, `projectManagerDashboardRoute.ts:118`). Overdue consistent: `dueDate < now && not closed`.

**A5 — extra duplicate:** `routes/claims/evidenceRoutes.ts:224-243` is effectively a **4th** per-lot claim-evidence computation (inline counts) duplicating `claimReview.ts` predicates instead of calling `buildClaimEvidenceReviewFromInputs`.

## 6. Scale facts

- **No pagination** on readiness/claim-readiness. `/claim-readiness` (`readRoutes.ts:161`) does `lot.findMany` over **all** project lots (8-status filter), no `take`/`skip`/`cursor`. Dashboards + test-result/hold-point lists do paginate; readiness does not.
- **No server-side cache** on any readiness path (`staleTime` is frontend-only).
- **Heaviest single-lot query:** `GET /:id/readiness` ≈ 9 queries — 1 deep `findUnique` + `Promise.all` of 7 (one of which, `checkConformancePrerequisites`, is itself 2 queries). Deep include: `itpInstance→template→checklistItems` + `completions→attachments` + `holdPoints`.
- **Heaviest at scale:** `/claim-readiness` fans out with lot count **and double-fetches the lot set** — `lot.findMany` (`:161`) then `checkConformancePrerequisitesBatch` (`conformancePrerequisites.ts:565-611`) re-fetches the same lots with `CONFORMANCE_LOT_INCLUDE`. The batch helper is O(constant) queries, built to kill the old per-lot ~2N+1 fan-out (comments `conformancePrerequisites.ts:559-564`, `readRoutes.ts:213-218`, `portfolio.ts:211`).
- **Table-size signals (indexes):** Lot `[projectId,status]`+`[projectId,conformedAt]`; HoldPoint `[status,scheduledDate]`+`[status,createdAt]`; TestResult `[projectId,status]`+`[projectId,passFail]`; NCR `[projectId,dueDate]`+`[projectId,category,status]`; ITPCompletion `[verificationStatus]`; NotificationAlert `resolvedAt`-keyed; AuditLog `[entityType,entityId]`.

## Open items for the spec author

1. ~~AiProposal existence~~ — resolved: exists (#1479), mapped in §4.
2. `overdue_test` alert type — declared + escalation-configured, **no creator**; decide whether F0/Wave-C wires it or removes it.
3. `'critical'` NCR severity checked in `claimReview.ts:206` but not a documented severity value — likely dead branch; confirm and clean when touched.
4. `approvedDockets`/`diaryEntries` readiness inputs are hardcoded `0` at both call sites — the docket/diary evidence surfaces are defined in the type but not populated; F0 should either wire or drop them.
5. #1541 escalation line numbers were read from the commit object, not a checked-out tree — re-cite before relying.
