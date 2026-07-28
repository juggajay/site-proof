# Wave E Execution Specification — the approvals thin slice: the reminder that never fired

**Date:** 28 July 2026 · **Rev 2** · **Size:** S (two code phases, one of them zero-migration)

**Status:** implementation-ready for **E1 and E2 only**, behind one blocking pre-build gate (**E.0**, §7.1). No Wave E code PR may merge before the E.0 artifact merges, and E.0 now has to *resolve* what it finds, not merely record it. **E3 (the recipient-scoped queue) is DEFERRED out of this wave** and is specified-but-unbuilt in §4.3 so the successor slice starts from a design rather than from a rewrite. The wave is therefore **E.0 → E1 → E2**.

**All `file:line` citations were regenerated in this worktree at HEAD `470b0422e23865b5207d59b8984a674cb050acb4`** (= `origin/master`, `fix(e2e): test-results spec catches up with the C2 lab-lifecycle UI (#1647)`). Rev 1 cited `a22d2026`; §0.5 records exactly which citations moved and which did not. Nothing here is quoted from memory or from another spec's citation.

**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md`
- **§3 line 95** — Wave E's scope sentence, disposed of clause by clause in §1.2.
- **§1 line 17** — the belief this wave rests on: *"passwordless links (**mandatory reviewer accounts are a known adoption risk** — CivilPro's no-account link won in market; validate the strength of this with CIVOS design partners); v1 = due dates + reminders + link-opened pending queue; hold points only; accounts/delegation deferred until demanded."*
- **§4 line 110** — deliberate non-build: *"external-reviewer accounts/portals"*.
- **§6 line 127** — the External collaboration standard, which is this wave's definition of done.
- **§7 lines 134–135** — the threat-model gate and the standing security requirements. §7.1 here is that gate.
- **§9 line 149** — the execution-specification requirement this document satisfies.

**Parent specs, read not remembered:**
- `docs/plans/f0-execution-spec-2026-07-24.md` — **line 142**: *"The batch's N-fold duplicate notification volleys are a known pre-existing defect fixed separately, NOT in F0.4b."* Still open at this SHA (§2.7), and now a named precondition of the **deferred** E3 slice (§4.3), not of anything this wave ships.
- `docs/plans/wave-c2-test-lifecycle-spec-2026-07-28.md` — **§7.3 line 530–532**, the precedent for the threat-model gate: *"**NOT FOUND:** any threat-model artifact under `docs/`. The gate is satisfied for v1 **by scope** … The moment J4 flips and an external lab upload link is built, the threat-model artifact becomes a hard precondition — a PR, not a paragraph."*
- `docs/plans/wave-c3-spatial-tests-lims-spec-2026-07-28.md` — the **C3.0** pattern: a blocking, docs-only, pre-build research PR that discharges a gate before any code (`:3`, `:71-82`). E.0 is the same shape, for security instead of research.
- `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` — **line 66** (Electronic Transactions Act 1999) and **lines 67, 69** (CivilPro / HoldPoint no-account links). Quoted verbatim in §15.1; nothing is added to them.

**House style** matches the C1, C2, C3, D14, F1 and sync-centre specs: numbered sections, an explicit clause-by-clause disposal of the program line, a current-state map with citations, migrations called out loud, independently shippable phases, a named acceptance-test series continuing the shared numbering (this wave starts at **AT-98**; AT-97 is C3's last, `wave-c3-spatial-tests-lims-spec-2026-07-28.md:618`), an exit gate, and a decision register with flip conditions.

---

## 0. Rev 2 — what changed and why

### 0.1 The verdict this revision folds

Rev 1 was reviewed by the standing adversarial reviewer (gpt-5.6-sol) at `64de4bd2` and **rejected for implementation, 2.5/10**, with eleven blockers `[ER-B1..B11]` and six advisories `[ER-A1..A6]`. Every finding was re-verified in this worktree at `470b0422` before folding. **Sixteen of seventeen were confirmed; one was partially refuted; two were confirmed and found to be worse than stated.** §0.4 is the tag-by-tag disposition.

### 0.2 The three structural changes

1. **E3 is out of the wave.** The reviewer's `[ER-B8]`/`[ER-B9]`/`[ER-B10]` are not a set of fixable details — together they say the E3 design was wrong at the capability layer (a dynamic union by email escalates one bearer token into another's capability), wrong at the evidence layer (the release evaluator is single-lot by construction and would stamp the anchor lot's verdict onto every other lot's immutable snapshot), and wrong at the storage layer (the proposed index is on a column the real query never starts from). §4.3 is now a **specified, unbuilt** successor slice built around an explicit project-scoped aggregate capability. It ships nothing in Wave E.
2. **E.0 becomes enforceable, not descriptive.** `[ER-B11]` is correct that a gate whose output is a *verdict* lets "violated" become documentation. Every E.0 item now terminates in **Accept / Mitigate-before-phase-X / Block**, with a named owner and a testable exit condition, and any *current* disclosure violation that E1 or E2 touches gets a named prerequisite remediation PR (§7.1, §9).
3. **E1's premise was inverted and is corrected.** This is the largest single correction in Rev 2 and it goes beyond what the reviewer found — see §0.3.

### 0.3 The correction Rev 1 most needed: E1 was repointing the wrong thing

Rev 1 §4.1 said the shared `OVERDUE_HOLD_POINT_STATUSES` / `holdPointOverdue` symbols *"have no production consumer beyond the two sites above once repointed"*, the two sites being the alert creator and its resolver. `[ER-B3]` said that was false. Verification at `470b0422` shows it is false **in both directions**:

- The alert creator does **not** consume the shared symbols. `systemAutomation.ts:281` carries an **inline literal** `status: { in: ['requested', 'scheduled'] }`, and its import list (`systemAutomation.ts:1-6`) pulls only `daysOverdue` from the predicate library. The resolver likewise declares its own private copy: `systemAlertResolution.ts:32`, `const STALE_HOLD_POINT_STATUSES = ['requested', 'scheduled'];`, used at `:89`.
- The shared symbols **do** have production consumers, and they are dashboards: `statsRoute.ts:9` (import) and `:89` (`status: { in: [...OVERDUE_HOLD_POINT_STATUSES] }`), and `actionAssignments.ts:18` (import) and `:135` (`const overdue = holdPointOverdue(holdPoint, now);` — which drives the `hold_point_overdue` reason code and the "Review hold point" vs "Release hold point" button label in My Work).

So Rev 1's plan — "repoint the constant, and the alert engine follows" — would have **moved two dashboard surfaces and left the alert engine exactly as dead as it is today**. E1 in Rev 2 repoints the two inline literals and deliberately does *not* touch `OVERDUE_HOLD_POINT_STATUSES` (§4.1).

The same audit found the divergence is wider than Rev 1's §3.2 table showed. The "stagnant" list `['pending','scheduled','requested']` appears at **eight** sites, only two of which read the shared constant:

| Site | Form |
|---|---|
| `statsRoute.ts:9`, `:85`, `:257` | imports `STAGNANT_HOLD_POINT_STATUSES` |
| `portfolio.ts:8`, `:245` | imports it (raw SQL via `Prisma.join`) |
| `statsRoute.ts:138` | **inline literal** |
| `operationalRoutes.ts:305` | **inline literal** |
| `projectManagerDashboardRoute.ts:166` | **inline literal** (plus `:156` `status: 'requested'` and `:161` `['scheduled','requested']`) |
| `roleDashboards.ts:378` | **inline literal** (plus `:196` `['scheduled','requested']`) |
| `projects/projectOverviewRoute.ts:132`, `:209` | **inline literal** |

Rev 1 cited `dashboard/projectOverview.ts`; that file does not exist. The real file is `routes/projects/projectOverviewRoute.ts`.

### 0.4 Disposition of every review tag

| Tag | Reviewer's finding | Verified at `470b0422`? | Disposition in Rev 2 |
|---|---|---|---|
| **ER-B1** | "Exactly three live values" is false; "never fired" is not provable from the repo | **Confirmed** — `status` is unconstrained `TEXT` (`schema.prisma:767`; `migrations/20260508000000_initial/migration.sql:406`), **zero** enums or CHECKs on `hold_points.status` in any migration | §3 rewritten to claim only what the repo can prove. **A production status inventory is a hard E1 precondition** (§4.1.1), run by the orchestrator, with an explicit disposition rule for every unexpected row. §0.6 carries the query. |
| **ER-B2** | The 30-day horizon and a per-project `take` do not bound a global volley | **Confirmed** — unbounded `findMany`, no `take` (`systemAutomation.ts:278-288`); runner deliberately has no project cap (`notificationAutomation.ts:177-186`); global kill switch only (`runner.ts:107`) | §4.1.2 specifies **numeric per-project, per-pass and per-recipient caps**, shows the worst-case fan-out arithmetic, adds a deferred-work cursor, and adds a **Wave-E-scoped canary flag** (§4.1.3 — the reviewer's argument survived verification; see §0.7). |
| **ER-B3** | The shared predicate does not unify the real consumers; dashboards do consume `holdPointOverdue` | **Confirmed, and worse** — see §0.3. The alert engine consumes *neither* shared symbol | §4.1 rewritten. E1 repoints two **inline literals**, leaves `OVERDUE_HOLD_POINT_STATUSES` untouched, and §4.1.4 corrects the provenance record. The "no production consumer" claim is withdrawn. |
| **ER-B4** | `minimumNoticeDays` is a forward lead time, not a reminder age | **Confirmed on three axes** — backend counts **working days forward from today to `scheduledDate`** (`requestReleaseRoutes.ts:654-676`); the frontend helper counts **calendar days backward from `notificationSentAt`** and admits it has no project override (`holdPointTableUtils.ts:26-32`) | §4.2.1 defines reminder timing **relative to `scheduledDate`** using the project working calendar. `minimumNoticeDays` stays what it is: a request-time gate. |
| **ER-B5** | The cap of three is neither systemic nor race-safe | **Confirmed on all four sub-claims** — **no `chaseCount` comparison exists anywhere in the codebase**; the guard is a read-then-write (`actionRoutes.ts:721` findUnique → `:744` check → `:749` update); re-requesting never resets the counter (`HoldPointRequestStateData`, `requestReleaseRoutes.ts:68-75`); no generation identifier on `HoldPoint` or its tokens | §4.2.2 specifies **one atomic reservation** (`updateMany` with the full predicate) shared by the manual route and the job, defines the cap grain as **per request generation**, and defines the generation identifier. |
| **ER-B6** | The recipient fallback renews an expired capability with no defined authority | **Confirmed, and worse** — the chase resolver filters on `usedAt: null` only, never `expiresAt` (`actionRoutes.ts:200-211`); retention is daily *and disabled outside production by default* (`dataRetentionWorker.ts:29`), so outside prod an expired token seeds chases indefinitely | §4.2.3. Live-token resolution now **requires `expiresAt > now`**. **Reissuance authority is an explicit E.0 decision** (§7.1 item 11) with a bounded window and named revocation events. |
| **ER-B7** | `replyTo` has no transport support and there is no durable requester | **Partially refuted.** `EmailOptions` genuinely has no `replyTo` (`email.ts:51-58`) and the Resend payload does not pass one (`email.ts:173-180`) — confirmed. But a durable requester **already exists**: `HoldPointReleaseBatch.requestedByUserId` (`schema.prisma:843`, written `requestReleaseRoutes.ts:365`) *and*, on both paths, an `HP_RELEASE_REQUESTED` audit row carrying `userId` (`requestReleaseRoutes.ts:486-501` batch, `:916-935` single) | §4.2.4 picks the **audit-event lookup, not a new column**, and argues it (§4.2.5). `replyTo` is plumbed through **the one transport and the four hold-point payload sites**, enumerated. |
| **ER-B8** | E3 escalates one bearer token into another's capability | **Confirmed** — token identity is `recipientEmail` + optional name with no principal (`schema.prisma:805-828`); dedup normalizes for the key but **stores the first-seen casing** (`actionRoutes.ts:91-103`) | **E3 deferred.** §4.3 redesigns it around an **explicit project-scoped aggregate capability** with a materialized membership set. Dynamic union-by-email is forbidden by name (`[E-B8]`). |
| **ER-B9** | E3's multi-lot queue would write incorrect readiness evidence | **Confirmed, and worse** — sufficiency resolves against `batch.lotId` alone (`publicBatchRoutes.ts:313-315`), `outstandingSiblings` counts a **single scalar `lotId`** (`releaseDecision.ts:98-110`), and one `result` is stamped on every member's snapshot (`releaseDecision.ts:125-137`). The audit row's `projectId` also comes from the batch's lot (`publicBatchRoutes.ts:292`) | §4.3.3 requires **per-lot evaluation**: group by lot, resolve sufficiency per lot, build each item's snapshot from its own lot. Named as a precondition of the deferred slice, with the two-lot DB test specified. |
| **ER-B10** | The stated index is on the wrong lookup path | **Confirmed** — `HoldPointReleaseToken`'s only secondary index is `@@index([batchId])` (`schema.prisma:826`); `HoldPointReleaseBatch` has **no `projectId`** (`:833-851`); chase-minted tokens have `batchId = null` (`actionRoutes.ts:118-126`), so batch-side queries cannot see them | §4.3.4 writes **the real query** (token → holdPoint → lot → project, three hops), names the composite index it needs, and requires an execution-plan threshold. The `HoldPointReleaseBatch.recipientEmail` index idea is withdrawn. |
| **ER-B11** | E.0 can document a violation and proceed | **Confirmed, and worse** — two tests currently **lock the disclosure in**: `holdpoints.test.ts:311` asserts `notificationSentTo` is present, `publicBatchRoutes.test.ts:269-273` asserts `requestedBy` and `recipient.email` are present | §7.1 rewritten: every item ends **Accept / Mitigate-before-phase-X / Block**, owner + testable exit condition; six missing decisions added (items 11–16); **E.0a** is a named prerequisite remediation PR (§9). |
| **ER-A1** | The N-fold volley is present | **Confirmed** — self-documented at `publicBatchRoutes.ts:398-415`; each call reloads all project users and fans out (`publicReleaseExecution.ts:289-348`) | Retained as a **named precondition of the deferred E3 slice** (§4.3.5). Not a Wave E deliverable. |
| **ER-A2** | J1 per-project is right but is not authorization | **Accepted as argued** | §14.1 J1 relabelled **"scope, not authorization"**, with the sentence stated in the decision itself. |
| **ER-A3** | Reject J2 as framed; 3×100 = 300 messages | **Accepted as argued** | §14.1 J2 **reframed**: consolidated **per-recipient digest**, a **per-project-and-normalized-recipient daily limit**, and **suppression handling**. §4.2.6. |
| **ER-A4** | GET purity is intact but untested | **Confirmed** — all public GETs are pure reads; `usedAt` is only written in `executeHoldPointTokenRelease`; **no test asserts GET non-mutation** | **AT-112 added to E1's ATs.** |
| **ER-A5** | Automated chase audit attribution is underspecified | **Confirmed** — `HP_CHASED` uses `req.user!.userId` (`actionRoutes.ts:830`). The helper already accepts an absent actor (`auditLog.ts:7-15`, `userId?`; column nullable, `onDelete: SetNull`) | §4.2.7 specifies the system actor and the fields every send row carries, **including failed and suppressed sends**. AT-117. |
| **ER-A6** | Citations are stale | **Confirmed but narrow** — the diff `a22d2026..470b0422` touches only 12 files, of which exactly **one** (`backend/src/server.ts`) is cited by this spec | All citations regenerated; §0.5 lists the moves. The reviewer's `qualityRoutes.ts:403` example is moot — this spec never cited that file. |

**Slicing verdict, folded:** the reviewer's ordering is adopted verbatim except that E3 is deferred rather than merely re-sequenced.

### 0.5 Citation regeneration — what actually moved

`git diff --name-only a22d2026 470b0422 -- backend/src backend/prisma frontend/src` returns 12 files. Only `backend/src/server.ts` is cited here. Every other `file:line` in Rev 1 was re-opened and holds at `470b0422`, except the two Rev 1 got wrong at any SHA.

| Citation | Rev 1 | Rev 2 | Cause |
|---|---|---|---|
| `app.use(rateLimiter)` | `server.ts:114` | **`server.ts:115`** | #1644/#1646 |
| `authRateLimiter` mount | `server.ts:139` | **`server.ts:140`** | #1644/#1646 |
| **Hold-point router mount** | `server.ts:157` | **`server.ts:159`** | #1644/#1646 |
| `supportRateLimiter` | `server.ts:162` | **`server.ts:162-163`** | unchanged line, corrected range |
| Background workers started | `server.ts:206-209` | **`server.ts:209-210`** | #1644/#1646 |
| Readiness corpus seeder | `lib/readiness/seedCorpus.ts` | **`lib/readiness/characterization/seedCorpus.ts`** | Rev 1 path was wrong at every SHA |
| Stagnant dashboard consumer | `dashboard/projectOverview.ts` | **`routes/projects/projectOverviewRoute.ts:132`, `:209`** | Rev 1 file does not exist |

### 0.6 The E1 production status inventory — the query the orchestrator runs

`[ER-B1]` makes this a **hard precondition of E1**, not a follow-up. It is read-only, runs against Railway production, and follows the classifier pattern: the orchestrator runs it, pastes the output into the E1 PR body, and the disposition rule in §4.1.1 is applied to every row before any repoint merges.

```sql
-- E1-Q1: the actual status vocabulary, with the two nullable columns
-- the alert predicate depends on. READ ONLY.
SELECT hp.status,
       (hp.scheduled_date     IS NULL) AS no_scheduled_date,
       (hp.notification_sent_at IS NULL) AS never_notified,
       (hp.notification_sent_to IS NULL) AS no_recipient_recorded,
       COUNT(*)               AS rows,
       MIN(hp.scheduled_date) AS oldest_scheduled,
       MAX(hp.scheduled_date) AS newest_scheduled
FROM hold_points hp
GROUP BY 1, 2, 3, 4
ORDER BY rows DESC;

-- E1-Q2: what E1 would light up, per project, with and without the horizon.
-- This is the number §4.1.2's caps must be sized against.
SELECT l.project_id,
       COUNT(*) FILTER (WHERE hp.scheduled_date > now() - interval '30 days') AS within_horizon,
       COUNT(*)                                                               AS all_time
FROM hold_points hp
JOIN lots l ON l.id = hp.lot_id
WHERE hp.status = 'notified'
  AND hp.scheduled_date < now() - interval '1 day'
GROUP BY 1
ORDER BY all_time DESC;

-- E1-Q3: existing active stale_hold_point alerts joined to current status.
-- Any row whose status is NOT in the new predicate is one the repointed
-- resolver would close. Rev 1 had no answer for these.
SELECT hp.status, COUNT(*) AS active_alerts
FROM notification_alerts na
LEFT JOIN hold_points hp ON hp.id = na.entity_id
WHERE na.type = 'stale_hold_point'
  AND na.resolved_at IS NULL
GROUP BY 1
ORDER BY active_alerts DESC;

-- E1-Q4: the recipient fan-out multiplier for the worst-case arithmetic
-- in §4.1.2. One in-app Notification row is written per user per alert.
SELECT pu.project_id, COUNT(*) AS alert_recipients
FROM project_users pu
WHERE pu.status = 'active'
  AND pu.role IN ('project_manager','quality_manager','site_manager',
                  'site_engineer','superintendent')
GROUP BY 1
ORDER BY alert_recipients DESC
LIMIT 20;
```

### 0.7 The canary flag — the reviewer's argument, tested

`[ER-B2]` asked for a phase-specific flag. Verification says the argument holds and the build is small:

- The **only** rollback today is `NOTIFICATION_AUTOMATION_WORKER_ENABLED` (`runner.ts:107`), which is checked in `startNotificationAutomationWorker` (`:138-140`) and therefore kills **the entire hourly worker** — diary reminders, docket backlog, system alerts and escalations — not just the stale scan. Turning off a Wave E mistake would take three unrelated shipped features down with it.
- A project-scope mechanism **already exists and is already threaded**: `NotificationAutomationJobOptions.projectIds` (`notificationAutomation.ts:68`), applied at `:172-190`, reaching `systemAutomation.ts:43` and `:176`. Today only the admin route supplies it (`routes/notifications/systemAlerts.ts:48`).

So the flag is env plumbing onto an existing option, not a new subsystem. **Adopted** — §4.1.3.

---

## 1. Outcome, scope and non-goals

### 1.1 Outcome

Two sentences for this wave, each independently checkable. Rev 1's third outcome is now §4.3's, and this wave does not claim it.

1. **A hold point waiting on an external decision is visible as waiting, to the alert engine and not only to the screen.** The awaiting-release signal is one predicate, keyed on the status the code actually writes, read by the alert creator and its auto-resolver — bounded, canaried, and preceded by a production inventory that says what it will match before it matches it.
2. **A super who has not answered gets reminded, automatically, at most a bounded number of times per release request, and the reminder reaches the person who was actually asked** — including after the original 48-hour link has expired and been purged, and with a real human in the reply path.

Adoption dependency, stated up front rather than discovered later: outcome 2's value is proportional to how many release requests carry a `scheduledDate` and a real external email. `scheduledDate` is nullable (`schema.prisma:770`) and the Prisma `lt` filter excludes nulls, so a request with no scheduled date produces no reminder and never will. That is correct behaviour, and it means the reminder list starts smaller than the hold-point list. **E1-Q1 measures exactly how much smaller before either phase ships.**

### 1.2 Every clause of program line 95, disposed of

| Clause of line 95 | Disposition |
|---|---|
| *"Due dates + reminders + escalation on existing hold-point links (targets the measured ready→released gap)"* | **Due dates + reminders: BUILT** (E1, E2), using the existing `scheduledDate` — **no new due-date column**. **Escalation: NOT BUILT as new.** Internal escalation for `stale_hold_point` already ships at 4 h → level 1 and 8 h → level 2 (`notificationAlertConfig.ts:39-42`) with a bounded, paginated, idempotent engine (`alertEscalations.ts:207-310`, send cap 200 at `:32`). E1 is what makes it reachable at all — and per `[ER-B2]`, **E1 ships with escalation held off until the canary population has been bounded through a full escalation window** (§4.1.3). **External** escalation — mailing the super's manager — needs a contact CIVOS does not hold and is out (§1.3). |
| *"link opens a **recipient-scoped** pending queue (never general project visibility)"* | **DEFERRED out of Wave E** per `[ER-B8]`, `[ER-B9]`, `[ER-B10]`. §4.3 specifies the successor slice around an explicit project-scoped aggregate capability with per-lot evaluation. Rev 1's dynamic union-by-email design is withdrawn, not re-sequenced. |
| *"attendance-required/notice-period flags"* | **HALF ALREADY SHIPPED, HALF OUT.** The notice period ships: a per-project **working-days** minimum (`validation.ts:81-83`, `hpMinimumNoticeDays ?? holdPointMinimumNoticeDays ?? 1`), enforced on both request paths (`requestReleaseRoutes.ts:267-288`, `:654-676`), with an audited override carrying a reason printed in the email (`:797`, `holdPointTemplates.ts:338`). Per `[ER-B4]`, **E2 does not reuse it as a reminder clock** — it is a request-time gate and stays one (§4.2.1). An **attendance-required flag** is a new field on a form with no consumer in v1. Out; flip condition in §14.2. |
| *"identity + immutable history for Electronic Transactions Act reliability"* | **ALREADY SHIPPED — verified, not assumed** (§2.2). Wave E adds **no** identity mechanism. It adds the honest statement of what that evidence does and does not prove (§7.6). |
| *"**E2 release-package assembly** (MRWA 201 evidence network…)"* | **OUT of this wave, in full.** Depends on C5 survey acceptance (program line 79) and D1 readiness rollups (line 82), neither of which exists. Named as a successor wave, not deferred vaguely. |
| *"Out of v1: accounts, delegation (until a real reviewer asks)"* | **Honoured, and widened** — see §1.3. |

### 1.3 Non-goals — the over-build this wave explicitly forbids

Do not build any of the following in Wave E. Each has a flip condition; none is met today.

1. **No accounts of any kind for external reviewers.** Program line 110 lists external-reviewer accounts/portals as a deliberate non-build; line 17 records mandatory reviewer accounts as the known adoption risk. *Flip:* a design partner's super asks for one, in writing.
2. **No delegation.** No "forward to my colleague", no alternate-approver field, no acting-for. *Flip:* a real reviewer asks (program line 95's own condition).
3. **No per-super dashboard, and in Rev 2 no queue at all.** §4.3 is deferred.
4. **No e-signature product.** No CA, no PKI, no signing ceremony, no tamper-evident PDF sealing, no third-party integration. §7.6 states the shipped evidence's limits rather than dressing it up.
5. **No reject / decline / return-for-information action.** The public page's only mutation is release (`PublicHoldPointReleasePage.tsx:203-214`). *Flip:* a pilot super declines by replying to the email and the site team asks for it — its own S, its own spec.
6. **No new public page and no new public route in E1 or E2.** Neither phase touches a public surface at all.
7. **No new due-date column.** §5.1.
8. **No new reminder-state columns.** §4.2.2 defines the generation identifier from data that already exists; §5.1.
9. **No cross-project anything.** §7.2.
10. **No change to the release decision itself.** `recordDecision`, the token claim, the serializable guards, the 410 TOKEN_USED / TOKEN_EXPIRED contract and the snapshot behaviour are untouched by every phase. §6 makes this an invariant with a test.
11. **No dynamic capability union by email, in any phase, ever** — `[E-B8]`, folded from `[ER-B8]`. Even the deferred slice may not build one.

---

## 2. Current-state map (read at `470b0422`)

### 2.1 The link machinery that ships

Two public doors, both unauthenticated, both mounted under `/api/holdpoints` at **`server.ts:159`**.

| Door | Routes | File |
|---|---|---|
| Single hold point | `GET /public/:token`, `POST /public/:token/release`, `GET /public/:token/documents/:documentId` | `holdpoints.ts:105-116`, `:119-265`, `:69-102` |
| Batch ("review room") | `GET /public/batch/:batchToken`, `GET .../holdpoints/:holdPointId`, `GET .../documents/:documentId`, `POST .../release` | `publicBatchRoutes.ts:92-154`, `:158-180`, `:183-228`, `:234-429` |

Tokens are 32 random bytes rendered hex — `crypto.randomBytes(32).toString('hex')` (`requestReleaseRoutes.ts:203`, `:757`) — stored as a `sha256:`-prefixed digest (`tokens.ts:20-22`), with a raw-SQL `CHECK ("token" ~ '^sha256:[0-9a-f]{64}$')` on both token tables (`prisma/migrations/20260619143000_require_hashed_one_time_tokens/migration.sql:14-16`). Lookup re-hashes whatever is presented (`tokens.ts:24-28`), so a database leak yields no usable link. Expiry is **48 hours**, one constant, both paths: `SECURE_LINK_EXPIRY_HOURS = 48` (`tokens.ts:17`), applied at `requestReleaseRoutes.ts:199` and `:753`, pinned by `tokens.test.ts:27`.

Route params are length-capped before any DB hit — `MAX_RELEASE_TOKEN_LENGTH = 512` (`validation.ts:100`), applied at `holdpoints.ts:72, 108, 122` and `publicBatchRoutes.ts:95-99, 161-165, 187-190, 237-241`.

### 2.2 The decision record that ships

Both public release doors route through the same `recordDecision` (`lib/readiness/recordDecision.ts:497-568`): one `prisma.$transaction` at `Serializable` isolation (`:515`, `:547`), up to five attempts with full-jitter backoff (`:157`, `:193-199`), 409 `DECISION_CONFLICT` on exhaustion (`:557-562`). Inside it, `executeHoldPointTokenRelease` claims the token as a guarded `updateMany({ where: { id, usedAt: null, expiresAt: { gt: releasedAt } } })` (`publicReleaseExecution.ts:76-89`) — the double-spend and post-expiry guards are one predicate, not a pre-check.

What the audit row carries, all inside that transaction:

- actor `{ kind: 'external_token', tokenId, label: recipientName }` (`holdpoints.ts:216-220`, `publicBatchRoutes.ts:329-337`, columns at `recordDecision.ts:355-361`);
- `ipAddress` and `userAgent` (`holdpoints.ts:220`/`publicBatchRoutes.ts:355` → `recordDecision.ts:450` → `auditLog.ts:78-79`);
- the identity override `effectiveReleasedByName = token.recipientName || submitted name` (`holdpoints.ts:176-177`);
- a **mandatory** signature (`validation.ts:263-268`, guarded again at `PublicHoldPointReleasePage.tsx:197`);
- `RequirementEvaluation` snapshots when `READINESS_SNAPSHOTS_ENABLED` (`recordDecision.ts:234-237`);
- rollback proven including the token claim (`holdPointReleaseDecision.db.test.ts:465-495`, `holdPointBatchReleaseDecision.db.test.ts:408-443`); double-spend proven (`:532-549`, `:475-504`).

**The actor model already supports a non-user actor.** `recordDecision.ts:78-84` types the union as `{kind:'user'}` | `{kind:'external_token'}` | `{kind:'system', label}`, mapped to `actorKind/actorUserId/actorTokenId/actorLabel` at `:351-368`, with `userId: actor.kind === 'user' ? actor.userId : undefined` at `:441`. The `system` arm has **no production caller yet** — it is exercised only at `recordDecision.db.test.ts:559`. That matters for `[ER-A5]`; see §4.2.7.

### 2.3 What a super sees today when several releases are pending

- **Single link** (`/hp-release/:token`, `App.tsx:241`): exactly one hold point (`PublicHoldPointReleasePage.tsx:277-463`).
- **Batch link** (`/hp-release/batch/:token`, `App.tsx:246`): N hold points — but the batch is created against **one `lotId`** and **one recipient** (`requestReleaseRoutes.ts:356-367`), so it is a per-lot, per-request room, not a queue.
- **Anything else**: nothing. A super with pending items on four lots receives four emails and holds four links, each expiring independently.

This is the pain §4.3 is deferred against. It is real, and Wave E does not fix it.

### 2.4 Recipients — and where the recipient identity actually lives

Configured per project as `hpRecipients: [{ role, email }]` (`ProjectSettingsPage.tsx:137`, validated `projectSettingsValidation.ts:141-161`, read by `parseHPDefaultRecipients`, `validation.ts:59-67`). The single-request modal pre-fills free-text `notificationSentTo` (`RequestReleaseModal.tsx:112-117`); the batch modal takes one email and name (`BatchRequestReleaseModal.tsx:229-247`). Fallback: project users with role `superintendent`, else `project_manager` (`requestReleaseRoutes.ts:706-735`).

**Four stores, four lifetimes.** Rev 1 listed three and missed the one that matters most for `[ER-B7]`.

| Store | Field | Lifetime |
|---|---|---|
| `HoldPointReleaseToken` | `recipientEmail`, `recipientName` (`schema.prisma:808-809`) | **48 h**, then retention deletes any token with `expiresAt < now` (`dataRetention.ts:43-53`, applied `:110-114`), daily (`dataRetentionWorker.ts:10`) — **and only when enabled, which outside production it is not by default** (`dataRetentionWorker.ts:29`). |
| `HoldPointReleaseBatch` | `recipientEmail`, `recipientName` (`schema.prisma:836-837`), **`requestedByUserId` (`:843`)** | **Forever** — not in the retention client type (`dataRetention.ts:66-75`). Batch path only. |
| `HoldPoint.notificationSentTo` | comma-joined **recipient** email list, normalised `requestReleaseRoutes.ts:568-569`, written `:825` | **Forever**, both paths. Emails only, no names, no FK (`schema.prisma:769`, `String?`). |
| **`AuditLog` `HP_RELEASE_REQUESTED`** | `userId` = **the requester** (`auditLog.ts:209`; written `requestReleaseRoutes.ts:486-501` batch, `:916-935` single) | **Forever.** `dataRetention.ts:80-81` states it: *"Project, audit, NCR, lot and test data are never auto-deleted."* `applyRetentionPolicies` never touches `auditLog`. |

That fourth row is the one Rev 1 missed and `[ER-B7]` half-missed. It is why §4.2.4 needs no new column.

**And the manual chase resolves recipients from the first store, with no expiry filter.** `loadHoldPointChaseTargets` reads `holdPointReleaseToken` where `{ holdPointId, usedAt: null }` (`actionRoutes.ts:200-211`) — **`expiresAt` appears nowhere in that query**; the only `expiresAt` in the file is the write at `:124`. It falls back to project users when the query returns nothing (`:219` → `loadProjectChaseTargets`, `:165-198`). So today: an **expired** token still seeds the chase until retention removes it, and once retention does, chasing an unreleased hold point silently stops emailing the external super and starts emailing internal staff, with no signal. Both are pre-existing defects of the manual path; automating on top of them would industrialise them. E2 fixes both in the shared resolver (§4.2.3).

### 2.5 Reminders — the manual chase, and the automatic one that cannot fire

**Manual.** `POST /api/holdpoints/:id/chase` (`actionRoutes.ts:714-840`, `requireAuth`, `HP_REQUEST_ROLES`). Its guards are exactly three: existence (`:731-733`), authorization (`:735-742`), and `status === 'released'` (`:744-746`) — note that leaves `'completed'` chaseable, unlike the release paths which guard `notIn: ['released','completed']`. It then increments `chaseCount` and stamps `lastChasedAt` via a bare `prisma.holdPoint.update({ where: { id } })` (`:749-755`; columns `schema.prisma:779-780`), resolves targets (§2.4), mints a **fresh** token per target and revokes the superseded one on success (`:813-817`) or the fresh one on failure (`:147-163`). The email is already reminder-shaped: subject `[CIVOS] REMINDER: Hold Point Awaiting Release - <lot> (Chase #N)` (`holdPointTemplates.ts:372`), body *"This is reminder #N"* (`:476`). Audited as `HP_CHASED` (`:827-836`).

**There is no cap.** An exhaustive grep of `chaseCount|lastChasedAt` across non-test `backend/src` returns 15 hits — 8 in email templates, 4 in `chaseNotifications.ts`, and 3 in `actionRoutes.ts` (`:752` increment, `:788` email context, `:834` audit payload). **No comparison operator is applied to `chaseCount` anywhere in the codebase.** Rev 1's "at most three times" described a cap that does not exist.

**Nothing calls it on a schedule.** There is no cron; every background job is an in-process `setInterval` started at **`server.ts:209-210`**. The relevant one is the notification-automation worker: hourly by default (`runner.ts:10`), guarded by PostgreSQL advisory lock `731_452_021` (`runner.ts:12, 73-93`), running four jobs in order (`notificationAutomation.ts:413-418`).

**Automatic — and dead.** The third job contains the stale-hold-point scan (`systemAutomation.ts:277-359`), filtering on the inline literal `status: { in: ['requested','scheduled'] }, scheduledDate: { lt: now - 1 day }` (`:279-283`). Its auto-resolver carries a private copy of the same list (`systemAlertResolution.ts:32`). Per §3, no production path writes either status with a `scheduledDate`.

**The fan-out per eligible hold point, measured for `[ER-B2]`:** one `notificationAlert` row assigned to a single `alertOwnerId` (`systemAutomation.ts:317-327`), plus **one in-app `Notification` row per user** in the five `STALE_HOLD_POINT_ALERT_ROLES` (`:331-346`; roles at `notificationAlertConfig.ts:16-23`). Escalation later adds `admin` (`:25`) and fires twice, at 4 h and 8 h (`:39-42`). The dedupe check is a `findFirst` **inside the loop** (`:290-297`), so an unbounded scan is also N+1 queries.

### 2.6 Due dates — what already exists

- `HoldPoint.scheduledDate DateTime?` (`schema.prisma:770`) and `scheduledTime String?` (`:771`). **`scheduledTime` is free text, not part of the timestamp.**
- An index that already supports a due-date sweep: `@@index([status, scheduledDate])` (`schema.prisma:799`).
- A per-project **working-days** minimum notice, default 1 (`validation.ts:81-83`), enforced **forward from today to `scheduledDate`** via `calculateWorkingDays(today, scheduledDateValue, lot.project.workingDays || '1,2,3,4,5')` on both request paths (`requestReleaseRoutes.ts:267-288`, `:654-676`), with an audited override + reason surfaced in the email (`:797`, `holdPointTemplates.ts:338`).
- The frontend computes two signals, and per `[ER-B4]` **they disagree by construction**: `isOverdue` (`holdPointTableUtils.ts:14-23`) keys on `status === 'notified'` ∧ `scheduledDate < today`; `isNoticeExpired` (`:42-50`) keys on `status === 'notified'` ∧ `getCalendarDaysSince(notificationSentAt) >= minimumNoticeDays` — **calendar days, backward from the notification, `scheduledDate` never referenced**, and with no project override at any of its three call sites (`HoldPointsMobileList.tsx:175`, `HoldPointsTable.tsx:311`, `holdPointsPageData.ts:65`), as its own docstring admits (`:26-32`).

There is no `dueDate`, `requiredDate` or `respondBy` column anywhere on the hold-point models. **NOT FOUND**, and §5.1 argues that is correct.

### 2.7 What is not there

- **No automated external reminder.** §2.5.
- **No cap on the manual chase.** §2.5.
- **No expiry filter on the chase recipient resolver.** §2.4.
- **No recipient-scoped anything.** `HoldPointReleaseToken` has exactly one secondary index, `@@index([batchId])` (`schema.prisma:826`) — none on `recipientEmail`, none on `holdPointId` despite `deleteMany({ where: { holdPointId, usedAt: null } })` running on every release request (`requestReleaseRoutes.ts:392-397`, `:865-870`) and every chase (`actionRoutes.ts:137-144`, `:155-162`). `HoldPointReleaseBatch` has **no `projectId`** (`:833-851`), and chase-minted tokens carry `batchId = null` (`actionRoutes.ts:118-126`).
- **No dedicated rate limit on the public token routes.** Only the global per-IP limiter: `app.use(rateLimiter)` at **`server.ts:115`**, 60-second window, `API_RATE_LIMIT_MAX` default **1000** (`rateLimiter.ts:47-48`). Narrow limiters exist for auth (`server.ts:140`), support (`:162-163`), chat and telemetry — none is applied at `server.ts:159`. **No test asserts a rate limit on these routes.**
- **No explicit revocation endpoint.** Revocation is implicit: re-requesting deletes unused tokens, chasing supersedes them, retention purges expired ones.
- **The N-fold notification volley is STILL OPEN**, self-documented at `publicBatchRoutes.ts:398-415`. Each `runHoldPointReleasePostCommit` independently reloads every active project user (`publicReleaseExecution.ts:289-300`), `createMany`s in-app notifications for all of them (`:302-321`), and loops them again for emails (`:334-348`). Releasing N hold points in one signed click produces **N×U notifications and N×U emails**. No follow-up fix commit; no test pins either behaviour.
- **No email unsubscribe of any kind.** `NotificationEmailPreference` is keyed on `userId` with a hard FK to `User` (`schema.prisma:283-309`); the chase email goes straight to `recipientEmail` with no preference check (`actionRoutes.ts:793-821`). `List-Unsubscribe`: **NOT FOUND**. `EmailOptions` has no `replyTo` (`email.ts:51-58`), and a repo-wide case-insensitive grep for `replyto|reply_to` across `backend/src` returns **zero hits**.
- **No test asserting any public payload field is absent** — and two tests asserting the opposite (§7.1 item 4).
- **No unit test for `PublicHoldPointReleasePage.tsx`**.

---

## 3. The finding this wave turns on — the dead status vocabulary `[E-B1]`

### 3.1 What the repository can prove, and what it cannot

Rev 1 claimed *"exactly three live values in production code"*. `[ER-B1]` is right that the claim overreached and that "the reminder has never fired" is not provable from a repository. Rev 2 claims only this:

**Provable from the repository.** Every writer of a `HoldPoint` `status` value in non-test `backend/src`, established by grepping every `holdPoint.(create|update|updateMany|upsert|createMany)` call and reading each hit to confirm the model it writes:

| Value | Written by | Reachable in production? |
|---|---|---|
| `pending` | `schema.prisma:767` (`@default("pending")`) — the **only** producer | yes, by default |
| `notified` | `requestReleaseRoutes.ts:349` (batch), `:823` (single) | yes |
| `released` | `publicReleaseExecution.ts:124` (both public doors), `actionRoutes.ts:470` (authenticated door) | yes |
| `requested` | `sampleProjectRoute.ts:197` — **`status: released ? 'released' : 'requested'`** | **yes** — this is an authenticated production route, not a test fixture |
| `completed` | `lib/readiness/characterization/seedCorpus.ts:128-146`, applied `:365` | no — sole importer is `characterization.test.ts:10` |
| `scheduled` | **nothing** | no writer anywhere |

Rulings on the near-misses: `evidenceAttachments.ts:86` and `actionRoutes.ts:510` and `publicReleaseExecution.ts:180` write **`ITPCompletion`**, not `HoldPoint`; `readRoutes.ts:531` is a literal inside an evidence-package **preview** whose `id` is the string `'preview'`; `escalationRoutes.ts:73`/`:166` and `actionRoutes.ts:749` call `holdPoint.update` but never touch `status`. There are no raw-SQL writes to `hold_points` (the only raw SQL is a read at `portfolio.ts:242`).

**Provable, and decisive.** `sampleProjectRoute.ts:191-207` writes `'requested'` but **sets no `scheduledDate` at all** — `grep -n scheduledDate backend/src/routes/projects/sampleProjectRoute.ts` returns nothing, so the column stays NULL. The alert query filters `scheduledDate: { lt: staleThreshold }`, which excludes NULLs, and `holdPointOverdue` short-circuits on null (`predicates.ts:109-110`). **No code path in this repository creates a hold point that the stale scan can match.**

**Not provable from the repository, and therefore not claimed.** That no production row has ever matched. `HoldPoint.status` is unconstrained `String` with no enum and no CHECK — `schema.prisma:767`, `migrations/20260508000000_initial/migration.sql:406`, and a grep of every migration `.sql` for `CHECK|CREATE TYPE|ENUM` finds only sha256 token-format checks (`20260619143000_require_hashed_one_time_tokens/migration.sql:7-16`, `20260629103000_add_revoked_auth_tokens/migration.sql:13`, `20260704185738_hold_point_release_batch/migration.sql:38`). Nothing in the database prevents a historical row from carrying `requested` or `scheduled` **with** a past `scheduledDate` — from an earlier code version, a manual fix, an import, or a support script. §0.6's **E1-Q1 and E1-Q3 answer this question with data before E1 merges**, and §4.1.1 says what to do with each answer.

### 3.2 The definitions of "waiting", and which one is right

| # | Definition | Site | Verdict against §3.1 |
|---|---|---|---|
| 1 | `status ∈ ['requested','scheduled'] ∧ scheduledDate < now − 1 d` | **inline literal** at `systemAutomation.ts:281`; **private copy** at `systemAlertResolution.ts:32`; **separately** named `holdPointOverdue` + `OVERDUE_HOLD_POINT_STATUSES` at `predicates.ts:91`, `:105-112`, consumed by `statsRoute.ts:89` and `actionAssignments.ts:135` | **Dead in the alert engine; live in two dashboards.** The three copies are not one definition — the alert engine imports neither symbol. |
| 2 | `status ∈ ['pending','scheduled','requested'] ∧ createdAt < now − 7 d` | `predicates.ts:115`, `:125-131`; **eight** consuming sites, only two via the constant — see §0.3 | **Live but inverted.** `pending` matches, so the dashboards' "stagnant" count measures hold points **nobody has asked about yet** and structurally excludes every hold point actually waiting on a super. |
| 3 | `status === 'notified' ∧ scheduledDate < today` | `holdPointTableUtils.ts:14-23` | **Correct**, and it is in the browser. |
| 4 | `status === 'notified' ∧ notificationSentAt ≥ N AEST calendar days old` | `holdPointTableUtils.ts:42-50` | **Wrong for this purpose**, per `[ER-B4]` — see §4.2.1. It is a *notice-elapsed* signal, not a *due* signal, and it disagrees with #3 by construction. |

`predicates.ts:1-20` states the library's charter: it *"NAMES the existing behaviour, it does not unify it"*, and `:100-103` documents that #1 and #2 diverge on all three axes — pinned with exact inputs at `predicates.test.ts:97-118`. That was the right call when the library was written. §4.1 is a narrow correction to the *alert engine*, not a re-unification of the library.

### 3.3 Why this is a Wave E blocker and not a Wave A bug

Building reminders on top of a predicate that matches nothing would produce a feature that passes every test and sends nothing in production. **`[E-B1]`: no Wave E phase may introduce a fifth definition of "awaiting release", and E1 may not repoint a definition without first knowing, from production, what its new form will match** (§4.1.1).

---

## 4. The design

### 4.1 Phase E1 — the signal that fires (S, no migration)

#### 4.1.1 Precondition: the production status inventory `[ER-B1]`

**E1 does not begin until §0.6's four queries have been run against production by the orchestrator and their output pasted into the E1 PR body.** The disposition rule, applied to every row of E1-Q1 and E1-Q3 before the repoint merges:

| Observed | Disposition | Owner |
|---|---|---|
| `notified` rows, any `scheduledDate` | Expected. Feeds the cap sizing in §4.1.2. | build agent |
| `pending` / `released` rows | Expected. Not eligible under the new predicate. | build agent |
| `requested` rows **with `scheduledDate` NULL** | Expected — sample-project seeder (§3.1). No action; not eligible before or after. | build agent |
| `requested` or `scheduled` rows **with a non-NULL past `scheduledDate`** | **BLOCK.** These are rows the current predicate matches and the new one does not. Each must be classified (legacy code version / import / manual fix) and given an explicit rule — normalize to `notified` where there is credible send evidence (`notificationSentAt` non-null), else to `pending` — as a **data-migration PR that merges before E1**. | Jay decides the rule; build agent writes the migration |
| Any status value **not** in the six of §3.1 | **BLOCK.** Unknown vocabulary; classify before proceeding. | Jay |
| Active `stale_hold_point` alerts (E1-Q3) whose hold point's status is **not** `notified` | **BLOCK until decided.** The repointed resolver would close these on its next pass. Either resolve them deliberately in the data-migration PR or exclude pre-E1 alerts from the resolver by `createdAt`. | Jay |

**Exit condition (testable):** the E1 PR body contains all four query outputs, every row falls in a non-BLOCK bucket or its blocking PR is merged and linked, and AT-98 is green.

**After the inventory, and only then:** add a database `CHECK` constraint or enum on `hold_points.status` — proposed as a **follow-up PR in the same sequence, not inside E1**, because a constraint added in the same PR as an alert-behaviour change mixes two reverts. Recorded as `[E-i]` in §14.2.

#### 4.1.2 The repoint — corrected per `[ER-B3]`

**One predicate**, added to `backend/src/lib/readiness/predicates.ts` beside its siblings and documented the same way:

- `AWAITING_RELEASE_HOLD_POINT_STATUSES = ['notified'] as const` — the status the request paths actually write (`requestReleaseRoutes.ts:349`, `:823`).
- `holdPointAwaitingRelease(hp)` — `status ∈ AWAITING_RELEASE_HOLD_POINT_STATUSES`.
- `holdPointReleaseOverdue(hp, now)` — awaiting release **∧** `scheduledDate` present **∧** `scheduledDate < now − 1 day`. Same shape and same one-day threshold as `holdPointOverdue` (`predicates.ts:105-112`).

**Two consumers repointed — and they are inline literals, not the shared symbols:**

1. `systemAutomation.ts:281` — the inline `status: { in: ['requested', 'scheduled'] }` becomes `{ in: [...AWAITING_RELEASE_HOLD_POINT_STATUSES] }`, **imported**. The threshold arithmetic at `:277` and the severity ladder at `:309-313` are untouched.
2. `systemAlertResolution.ts:32` — the private `STALE_HOLD_POINT_STATUSES` is deleted and the shared constant imported at `:89`, so creator and resolver can never disagree again.

**Explicitly NOT touched in E1** — this is the `[ER-B3]` correction:

- **`OVERDUE_HOLD_POINT_STATUSES` and `holdPointOverdue` keep their current values.** They have two live production consumers — `statsRoute.ts:9`, `:89` and `actionAssignments.ts:18`, `:135` — and changing them would silently move `/api/dashboard/stats`, the My Work `hold_point_overdue` reason code, and the "Review hold point" vs "Release hold point" button label. Rev 1's claim that they had no consumer is **withdrawn**. They are annotated with a comment pointing at §3.2 and at the fact that the alert engine never used them.
- **The dashboards' stagnant definition** (all eight sites, §0.3). Wrong, but a *counting* change with no bearing on reminders. `[E-c]`, §14.2.

#### 4.1.3 The storm control — numeric, global, and canaried `[ER-B2]`

**The worst-case arithmetic, stated.** Per eligible hold point the scan writes 1 `notificationAlert` row plus 1 `Notification` row per user in the five alert roles (`systemAutomation.ts:317-346`), and runs 1 dedupe `findFirst` (`:290-297`). For `E` eligible hold points across all active projects and `U` alert-role users per project, one pass costs `E` dedupe queries, `E` alert rows and `Σ E_p × U_p` notification rows — and, at 4 h and 8 h, escalation to six roles, twice (`notificationAlertConfig.ts:25`, `:39-42`). **E1-Q2 and E1-Q4 supply `E` and `U`; the PR body shows the product.**

E1 ships **all four** of the following. None is a follow-up.

1. **A per-project `take`** on the stale scan — `STALE_HOLD_POINT_SCAN_TAKE`, one constant, one place. The scan is currently an unbounded `findMany` (`systemAutomation.ts:278-288`).
2. **A global per-pass alert-creation cap** — `STALE_HOLD_POINT_ALERTS_PER_PASS`, decremented across projects inside one pass, so the bound survives the runner's deliberate no-project-cap policy (`notificationAutomation.ts:177-186`). This is the bound Rev 1 was missing: a per-project `take` × every active project is not a global bound.
3. **A deterministic deferred-work cursor.** When either cap is hit, the pass records the deferred count and the `(projectId, scheduledDate, id)` high-water mark and logs it exactly as the escalation engine already does (`alertEscalations.ts:273-276`, `:295-307`), so the next pass resumes rather than re-scanning from the top. Ordering is `scheduledDate ASC, id ASC` — oldest first, stable.
4. **A horizon**: only hold points whose `scheduledDate` falls within the last `STALE_HOLD_POINT_HORIZON_DAYS` (= 30) are eligible. E1-Q2 reports the within-horizon and all-time counts side by side so the horizon's effect is measured, not asserted.

**The canary flag** — adopted per §0.7. `WAVE_E_STALE_ALERT_PROJECT_IDS`, a comma-separated allowlist read once at job start and passed into the **existing** `NotificationAutomationJobOptions.projectIds` (`notificationAutomation.ts:68`, applied `:172-190`, reaching `systemAutomation.ts:43`, `:176`). Empty or unset = the stale-hold-point job is **skipped entirely**, so the deploy is inert until Jay names projects. This exists because the only rollback today is `NOTIFICATION_AUTOMATION_WORKER_ENABLED` (`runner.ts:107`, checked at `:138-140`), which would also take diary reminders, docket backlog and escalations down.

**Escalation is held off during the canary.** Per `[ER-B2]`: the `stale_hold_point` type is excluded from `alertEscalations` until the canary population has stayed inside the caps for **one full escalation window (≥ 8 h, `notificationAlertConfig.ts:42`) plus one reporting day**, then re-enabled in a one-line follow-up PR. Exit item 3.

#### 4.1.4 Provenance, corrected

`REASON_CODE_PROVENANCE.hold_point_overdue` records `predicate: 'holdPointOverdue'` and `source: 'systemAutomation stale_hold_point pass (systemAutomation.ts:277-279)'` (`reasonCodes.ts:214-223`), with a NAMING TRAP comment. That source line becomes **false** the moment E1 repoints the scan. It is pinned twice: `contracts.test.ts:68-73` asserts the predicate string, and `:59-66` asserts every provenance predicate names a real export.

**E1 updates the provenance record in the same PR as the repoint** — `predicate: 'holdPointAwaitingRelease'`, source updated to the new line, the NAMING TRAP comment rewritten to record that the alert engine never consumed `holdPointOverdue` and that the two dashboard consumers still do. Both tests are updated with it. AT-99.

#### 4.1.5 Independently shippable

After E1, on the canary projects, a quality manager gets an in-app alert when an external release goes past its scheduled date — via the shipped alert engine and the shipped `holdPointReminder` preference key (`notificationAlertConfig.ts:63-65`). **No external email has changed.** That is the whole point of shipping E1 alone.

### 4.2 Phase E2 — the reminder that sends itself (S, one migration)

**A fifth job in the existing hourly pass**, registered beside the four at `notificationAutomation.ts:413-418`, inside the same advisory lock. Not a new worker, not a new interval, not a new lock. It inherits E1's canary allowlist and its own per-pass cap.

#### 4.2.1 Reminder timing — anchored to `scheduledDate` `[ER-B4]`

Rev 1 used `minimumNoticeDays` as a reminder age. That is wrong on three axes (§2.6): it is a **forward** working-day lead time validated once at request time, not a **backward** age; it counts **working** days against the project calendar while the frontend helper counts **calendar** days; and it produces the reviewer's failure case — a hold point requested 14 days ahead with `minimumNoticeDays = 1` would be chased 13 days before it is due.

**E2's clock is `scheduledDate`, in the project's working calendar, and `minimumNoticeDays` is not consulted at all.** Two thresholds, two constants:

- `REMINDER_DUE_LEAD_WORKING_DAYS` = 1 — the first reminder fires when `scheduledDate` is one working day away, computed with the same `calculateWorkingDays` and the same `project.workingDays || '1,2,3,4,5'` the request path uses (`requestReleaseRoutes.ts:658-662`), so a Friday-due hold point is reminded on Thursday, not Saturday.
- `REMINDER_OVERDUE_INTERVAL_WORKING_DAYS` = 2 — subsequent reminders while `scheduledDate` is past.

Dates are compared on **whole days in `APP_TIMEZONE`** (the constant the automation code already reads), never on raw UTC timestamps, so a near-midnight UTC value cannot land on the wrong day. `scheduledTime` is free text (`schema.prisma:771`) and is never parsed — `[E-h]`.

**No reminder is ever generated where `scheduledDate` is null.** That is not a gap; it is the same nullability the Prisma `lt` filter already enforces, stated so nobody "fixes" it later.

Required tests (AT-102): far-future scheduled date produces no reminder; a weekend-adjacent due date reminds on the working day; a project with a non-default `workingDays` string shifts the threshold; a date-only value near midnight in `APP_TIMEZONE` lands on the intended day.

#### 4.2.2 The cap — atomic, shared, and per request generation `[ER-B5]`

Rev 1 advertised a cap of three. **No cap exists in the codebase** (§2.5), and the manual chase's guard is a read-then-write (`actionRoutes.ts:721` findUnique → `:744` status check → `:749` bare `update({ where: { id } })`), so two concurrent chases both pass and both send. The release paths already use the correct pattern (`actionRoutes.ts:464-467`, `publicReleaseExecution.ts:118-121`); the chase path does not.

**One shared atomic reservation, used by the route and by the job.** A single exported `reserveHoldPointChase(holdPointId, now)` performing a conditional `updateMany`:

```
where: {
  id: holdPointId,
  status: { in: [...AWAITING_RELEASE_HOLD_POINT_STATUSES] },   // excludes released AND completed
  chaseCount: { lt: MAX_CHASES_PER_REQUEST },
  OR: [{ lastChasedAt: null }, { lastChasedAt: { lt: cooldownCutoff } }],
  notificationSentAt: { equals: currentGenerationStart },       // §4.2.3 — identity, not a floor
},
data: { chaseCount: { increment: 1 }, lastChasedAt: now }
```

**Only a reserver whose `count === 1` may send.** `count === 0` means another caller won, the cap is spent, the cooldown is live, or the hold point left the awaiting state — all four are correct reasons not to send, and the caller distinguishes them with one follow-up read for logging only.

**The generation identifier, without a new column.** `[ER-B5]` correctly notes that `chaseCount` accumulates across the row's whole lifetime — `HoldPointRequestStateData` (`requestReleaseRoutes.ts:68-75`) is the complete set of fields written on a re-request and contains neither counter, and the row is unique per `[lotId, itpChecklistItemId]` (`schema.prisma:800`) so it is never replaced. **The generation is `notificationSentAt`**, which *is* rewritten on every request (`requestReleaseRoutes.ts:69`, written `:824`). E2 therefore resets `chaseCount = 0` and `lastChasedAt = null` **inside the existing request transaction**, alongside the `notificationSentAt` write — two fields added to a write that already happens, no migration, no new column, and the reservation predicate's `notificationSentAt: { equals: currentGenerationStart }` makes a stale in-flight reservation from the previous generation fail closed.

**Corrected 2026-07-28** (deep review L1, `docs/reviews/fable-deep-review-2026-07-28.md`). This paragraph originally specified `{ gte: currentGenerationStart }`, and that shipped — but a floor is not an identity and it did **not** fail closed. A re-request writes a *newer* `notificationSentAt` with `chaseCount = 0` and `lastChasedAt = null`, so every clause of the predicate passed and a reservation carried from the superseded generation succeeded, billed as chase #1 of a generation it was never about. The bound is now an equality; `notification_sent_at` is `TIMESTAMP(3)`, so the read-back value round-trips exactly. Pinned by *"L1: a reservation from generation A does not succeed once a re-request opens generation B"* (`holdPointChaseAutomation.db.test.ts`), which fails on the `gte` shape.

**Decided:** a **failed send does not consume an attempt** — the reservation is rolled back by decrementing `chaseCount` and restoring `lastChasedAt` on send failure, mirroring the existing `revokeFreshChaseReleaseToken` failure path (`actionRoutes.ts:147-163`). A **suppressed** send (§4.2.6) *does* consume it, because suppression is a delivery decision, not a delivery failure. `[E-j]`, §14.2.

Required test (AT-114): a real database concurrency test driving the manual route and the job against one hold point simultaneously, asserting exactly one send; plus a re-request-after-`MAX_CHASES_PER_REQUEST` test asserting the new generation qualifies again.

#### 4.2.3 The recipient fix — root cause, in the shared resolver `[ER-B6]`

`loadHoldPointChaseTargets` (`actionRoutes.ts:200-220`) is changed in two ways, both of which fix the manual path at the same time:

1. **Tier 1 gains the missing expiry predicate.** The query becomes `{ holdPointId, usedAt: null, expiresAt: { gt: now } }`. Today `expiresAt` is absent from it entirely (§2.4), so an expired token seeds the chase until retention removes it — daily in production, **never** in an environment where `DATA_RETENTION_WORKER_ENABLED` is off, which is the default outside production (`dataRetentionWorker.ts:29`). This is `[ER-B6]`'s "not genuinely live" point and it is a one-clause fix.
2. **A middle tier is inserted** — `notificationSentTo` parsed with the existing `parseNotificationEmailList` (`requestReleaseRoutes.ts:568`), minting fresh tokens for those addresses. This is the durable record of who was actually asked and it survives the retention purge (§2.4).

Order: live token → `notificationSentTo` → project users (`:219`, unchanged).

**Reissuance authority is not settled here.** `[ER-B6]` is right that minting a fresh 48-hour capability from a purged one, repeatedly, is a policy question and not a code detail. It is **E.0 item 11** (§7.1), it must be answered `Accept`/`Mitigate`/`Block` before E2 builds, and the answer must cover: who may reissue, for how long after the original request, and which events terminate reissuance. The spec's own position, offered to E.0 as a starting proposal rather than a decision: reissuance is bounded by the same `MAX_CHASES_PER_REQUEST` and the same generation as §4.2.2, and is terminated by release, by a new release request (new generation), by project closure, and by the recipient list changing — because in every one of those cases the ask that justified the capability no longer exists.

`notificationSentTo` stores emails only, so tier-2 recipients get the existing `'Superintendent'` name fallback (`chaseNotifications.ts:74`) — which means the token-bound identity override (`holdpoints.ts:176-177`) does not apply to a tier-2 link and the recipient types their own name. That is a **weaker** evidence position than a tier-1 link and it is stated in §7.6, not hidden.

#### 4.2.4 The durable requester — audit-event lookup, not a column `[ER-B7]`

The reminder must say who asked, and `replyTo` must reach them. Rev 1 said the requesting user was "already loaded"; `[ER-B7]` is right that this is false for an hourly job — `requestReleaseRoutes.ts:686-689` loads it into a request-scoped variable used only for the outbound email at `:796`, and the commit at `:821-829` persists the *recipient* list, not the requester.

But `[ER-B7]`'s premise that there is no durable requester is **partially wrong**, and the difference decides the design. Two durable records already exist:

- `HoldPointReleaseBatch.requestedByUserId` (`schema.prisma:843`), written at `requestReleaseRoutes.ts:365` and already read by the public batch summary (`publicBatchRoutes.ts:104-109`) — but **batch path only**.
- An `HP_RELEASE_REQUESTED` audit row (`auditLog.ts:209`) written on **both** paths with `userId: req.user!.userId` — `requestReleaseRoutes.ts:486-501` (batch) and `:916-935` (single) — with `entityType: 'hold_point'`, `entityId` = the hold point.

**E2 resolves the requester by audit lookup.** For a hold point being reminded: the most recent `AuditLog` row with `entityType = 'hold_point'`, `entityId = <id>`, `action = 'hp_release_requested'`, `createdAt >= notificationSentAt` (the generation bound from §4.2.2), then its `userId` → `User`. Fallbacks, in order: the user is missing or inactive → the project's company support address; no audit row found (a hold point requested before the audit action existed) → the company support address. Both fallbacks are logged, and `[E-B8b]` requires the reminder body to name the fallback rather than silently attributing the request to support.

#### 4.2.5 Why the lookup and not a column — the argument `[ER-B7]`

| | Audit lookup | New `HoldPoint.requestedByUserId` |
|---|---|---|
| Migration | **none** | one column + a backfill |
| History | **complete** — every past request is already recorded, on both paths | only requests made after the migration; the backfill's only possible source is… the audit log |
| Query cost | `@@index([entityType, entityId])` on `AuditLog` covers the predicate; per-hold-point row count is a handful of lifecycle events, so it is an index scan plus an in-memory `action`/`createdAt` filter, run once per eligible hold point per pass — inside E2's per-pass cap | one join |
| Generation-correct | **yes**, by construction — the `createdAt >= notificationSentAt` bound ties the requester to the current generation | no — a single column is overwritten and cannot express "who asked *this* time" without also being rewritten, which is a second write to get right |
| Deleted user | `AuditLog.user` is `onDelete: SetNull`, so `userId` can go null — handled by the fallback | same problem, same fallback needed |
| Retention risk | **none** — `dataRetention.ts:80-81` states audit data is never auto-deleted, and `applyRetentionPolicies` (`:86-146`) never touches `auditLog` | n/a |

The column wins on nothing except a marginal query cost that the per-pass cap already bounds, and it loses on history, which is the entire point. **Decision: audit lookup.** `[E-k]`, §14.2. *Flip:* the audit query shows up as a measurable cost in §10's numbers — then it becomes a **denormalized cache** of the audit answer, not a new source of truth.

#### 4.2.6 Mail safety — digest, daily limit, suppression `[ER-A3]`

`[ER-A3]` is right that a per-item cap is bookkeeping, not a mail-safety control: three chases across 100 hold points is 300 automated messages to one address before any manual send. J2 is reframed accordingly (§14.1). E2 ships three controls, not one:

1. **A consolidated per-recipient digest.** The job groups eligible hold points by `(projectId, normalized recipientEmail)` and sends **one** email listing every hold point due or overdue for that recipient on that project, each with its own link — reusing the existing chase template's reminder framing (`holdPointTemplates.ts:372`, `:476`) with a multi-item body. Per-item token minting, supersession and the per-item reservation (§4.2.2) are unchanged; only the *envelope* is consolidated. This is what turns 300 messages into at most one per project per recipient per day.
2. **A per-project-and-normalized-recipient daily limit** — `MAX_REMINDER_EMAILS_PER_RECIPIENT_PER_PROJECT_PER_DAY` = 1, enforced by a reservation on the same shape as §4.2.2 and keyed on **`recipientEmail.toLowerCase()`**. Normalization matters: the dedup at `actionRoutes.ts:91-103` and `requestReleaseRoutes.ts:744-761` normalizes for the map key but **stores the first-seen casing**, so `Sam@x.com` and `sam@x.com` are two stored values and one person.
3. **Suppression handling.** Resend reports hard bounces and complaints. E2 records a suppression on the normalized address and **skips** it thereafter, auditing the skip (§4.2.7). The minimum honest implementation is a suppression check at send time plus an audited skip; whether suppression is stored as a table or read from the provider is an E.0 item (§7.1 item 16) because it is a data-retention and PII question, not only an engineering one. Rev 1's "no reminder-suppression table" non-goal is **withdrawn**.

**The reachable human.** `replyTo?: string` is added to `EmailOptions` (`email.ts:51-58`) and passed to Resend (`email.ts:173-180`). Verified scope, so nobody discovers a second transport mid-build: there is **exactly one** real adapter — `new Resend(...)` at `email.ts:111-114` and `resend.emails.send` at `email.ts:173`, no nodemailer, no SMTP; the other paths are the disabled short-circuit (`:134-139`), the production fail-closed (`:214-220`) and a dev/test mock (`:222-231`) with an in-memory queue (`:70`, pushed `:142-144`). Four hold-point payload sites pass it: `email.ts:430` (`sendHPReleaseRequestEmail`), `:464` (`sendHPChaseEmail`), `:498` (`sendHPReleaseConfirmationEmail`), and **`requestReleaseRoutes.ts:457-462`**, which calls `sendEmail` directly rather than through a wrapper and is the one easy to miss. Its value is §4.2.4's resolved requester. AT-110.

Fix in the same PR: `chaseNotifications.ts:81` currently sets `requestedBy: context.notificationSentTo || 'Site Team'` from `existingHP.notificationSentTo` (`actionRoutes.ts:790`) — the **recipient** list. Today's chase email therefore tells the superintendent the request came from the superintendent's own address. §4.2.4's resolved requester replaces it.

#### 4.2.7 Audit attribution for automated sends `[ER-A5]`

`HP_CHASED` is written with `userId: req.user!.userId` (`actionRoutes.ts:827-836`) — a non-null assertion that would throw for a system caller. No change to the helper is needed: `AuditLogParams.userId` is already optional (`auditLog.ts:7-15`), the column is nullable with `onDelete: SetNull`, and non-user audit rows are already written in production by the `external_token` actor path (`publicBatchRoutes.ts:329-334` → `recordDecision.ts:441`). The `system` actor arm exists but has **no production caller yet** (`recordDecision.ts:78-84`; exercised only at `recordDecision.db.test.ts:559`) — E2 is its first.

Every automated send writes an audit row with `userId` omitted and `changes` carrying: `source: 'automation'`, the reservation id, the generation (`notificationSentAt`), `chaseCount` after reservation, the resolved recipient (**normalized**, and subject to the `/token/i` trap discipline of `[E-B7]`), the requester resolution outcome including which fallback fired, and the send result. **Failed and suppressed sends are audited too**, with distinct outcomes — a reminder that was deliberately not sent is an operational fact, and today nothing would record it. AT-117.

#### 4.2.8 The migration — one, and it is an index

`HoldPointReleaseToken` gains `@@index([holdPointId])`. It is missing today (`schema.prisma:826` has only `@@index([batchId])`) while `deleteMany({ where: { holdPointId, usedAt: null } })` runs on every release request and every chase (`requestReleaseRoutes.ts:392-397`, `:865-870`, `actionRoutes.ts:137-144`, `:155-162`). E2 turns those from user-triggered to hourly-and-automatic, which is what makes an existing gap load-bearing. Reviewed Prisma migration, additive, index-only, zero backfill, no data movement. §5.

**Explicitly not in E2:** no reminder to internal staff (that is E1's alert), no escalation to a second external contact, no SMS, no reminder after release, no reminder for a hold point with no `scheduledDate`, no public route change, and no queue.

### 4.3 E3 — DEFERRED. The successor slice, specified and unbuilt

**Nothing in this section ships in Wave E.** It is written down because the review found the Rev 1 design broken at three layers, and a successor agent should start from a design rather than rediscover the same three faults. Its size is **M**, not S.

#### 4.3.1 Why it was deferred

| Layer | Rev 1 design | Fault |
|---|---|---|
| Capability | union live tokens by `recipientEmail` from the presented token | `[ER-B8]` — a bearer of token A is not proven to control the inbox. Looking up token B by A's email and supplying B server-side lets a forwarded or leaked A reveal evidence and release items A was never issued for. Token identity is `recipientEmail` + optional name with no principal (`schema.prisma:805-828`), and dedup stores the first-seen casing (`actionRoutes.ts:91-103`), so two people or roles on one mailbox collide and A's stored name can become the signer for B's items. |
| Evidence | widen batch membership across lots | `[ER-B9]` — sufficiency resolves against `batch.lotId` alone (`publicBatchRoutes.ts:313-315`), `outstandingSiblings` counts a **single scalar `lotId`** (`releaseDecision.ts:98-110`), and the one `result` is stamped on **every** member's immutable snapshot (`:125-137`). The audit row's `projectId` also derives from the batch's lot (`publicBatchRoutes.ts:292`). A cross-lot selection would silently record the anchor lot's verdict and sibling count on every other lot. |
| Storage | measure `HoldPointReleaseBatch.recipientEmail`, index if needed | `[ER-B10]` — that column cannot answer the question. `HoldPointReleaseBatch` has no `projectId` (`schema.prisma:833-851`) and chase-minted tokens have `batchId = null` (`actionRoutes.ts:118-126`), so a batch-side query is blind to exactly the tokens a reminder just minted. |

#### 4.3.2 The capability model the successor must use `[ER-B8]`

**An explicit project-scoped aggregate capability. Never a dynamic union by email — `[E-B8]`.**

A new row (working name `HoldPointReviewQueue`) with: `projectId`, a hashed `token` on the shipped `sha256:` scheme (`tokens.ts:20-22`, with the same CHECK constraint), `recipientEmail` **stored normalized**, `recipientName`, `expiresAt`, `createdByUserId`, and an **explicit membership set** — materialized `holdPointId` rows written at issue time by an authorized internal user, not computed at read time. Its blast radius is a decided quantity, written down at issue time and accepted in E.0, rather than an emergent property of whatever tokens happen to be live when the link is opened.

Consequences that follow and must be built, not assumed:

- **Membership is frozen at issue.** A hold point requested after the queue token was minted is not in that queue; it gets its own ask, or a new queue token. This is the property Rev 1 traded away and it is the one that makes the capability inspectable.
- **Release still consumes the item's own `HoldPointReleaseToken`**, through the shipped guarded claim (`publicReleaseExecution.ts:76-89`). The queue token authorizes *reading the list*; it never authorizes a release on its own.
- **Recipient identity is normalized at write time**, everywhere — the first-seen-casing behaviour at `actionRoutes.ts:91-103` and `requestReleaseRoutes.ts:744-761` is fixed, with a backfill, before any recipient-keyed lookup exists.
- **Shared-mailbox behaviour is decided explicitly** in E.0 (item 12), not left to emerge.
- **Required negative tests:** a forwarded queue token cannot view or release a hold point outside its membership set; two recipients with the same normalized email but different names cannot cross-sign; casing variants resolve deterministically to one principal.

#### 4.3.3 Per-lot evaluation `[ER-B9]`

The successor **must not** call `evaluateHoldPointReleaseReadiness` once with a single anchor `lotId` across a multi-lot selection. Required shape: group the selected hold points by their own `lotId`, call `resolveHoldPointReleaseSufficiency` **per lot**, evaluate **per lot**, and build each item's snapshot from its own lot's evaluation — `holdPointReleaseSnapshots` (`releaseDecision.ts:125-137`) is currently written to stamp one shared `result` on every row and is the function that changes.

The `projectId` passed to `recordDecision` (`publicBatchRoutes.ts:292`, `:323`) must likewise come from a verified single project, with a guard that rejects a cross-project selection outright.

**Required test:** a DB test with two lots whose sufficiency verdicts and outstanding-sibling counts deliberately differ, asserting each hold point's snapshot carries **its own** lot's verdict. This test fails on today's code, which is the point.

Alternative, if the successor wants to stay small: **prohibit multi-lot selection in one release decision** — one signature per lot, N signatures for N lots. Cheaper, honest, and a worse user experience. The successor picks one and says which.

#### 4.3.4 The real query and its index `[ER-B10]`

With an explicit membership set the read is trivial (`queueId` → members) and no recipient-keyed index is needed at all — which is itself an argument for §4.3.2. If a future slice nonetheless needs "all live tokens for recipient R on project P", the query starts from `HoldPointReleaseToken` and is **three hops**:

```
HoldPointReleaseToken (recipientEmail normalized, usedAt IS NULL, expiresAt > now)
  → HoldPoint  (token.holdPointId, schema.prisma:807/:821)
  → Lot        (holdPoint.lotId,   schema.prisma:763/:792)
  → project    (lot.projectId)
```

The driving predicate sits on `HoldPointReleaseToken.recipientEmail`, `usedAt` and `expiresAt` — **none of which is indexed** (`schema.prisma:826`, `@@index([batchId])` only). The required index is a **token-side composite on the normalized email plus liveness**, in the same migration as `@@index([holdPointId])` — "one migration" is reasonable, "one index total" was not. The slice must ship: a normalized-email backfill, the composite index, a stated `EXPLAIN` plan threshold, and a p95 target measured on the reference dataset. The Rev 1 idea of indexing `HoldPointReleaseBatch.recipientEmail` is **withdrawn** — that path cannot see chase-minted tokens.

#### 4.3.5 Named preconditions of the successor slice

1. **The N-fold volley fix, as its own blocking PR** `[ER-A1]`. `publicBatchRoutes.ts:398-415` calls `runHoldPointReleasePostCommit` once per released hold point, and each call reloads every active project user (`publicReleaseExecution.ts:289-300`), `createMany`s notifications for all of them (`:302-321`) and loops them again for emails (`:334-348`) — N×U notifications and N×U emails. A slice whose purpose is to make multi-item release normal cannot ship on top of it. **Test:** N released hold points produce exactly one user-facing notification and one email per recipient, with per-hold-point webhooks and readiness updates preserved.
2. **A rate limit on `/api/holdpoints/public/*`** (§7.3). The first change that makes one bearer token worth more than one hold point.
3. **The two current disclosures cut** — see E.0a (§9), which E1/E2 do not depend on but the successor does.
4. **E.0 items 11–16 answered** (§7.1).

### 4.4 What does not change, in any phase

`recordDecision` and its transaction, isolation level, retry and conflict contract. The token hash scheme, the 48-hour constant, and the `CHECK` constraints. The guarded claim predicate and the 410 `TOKEN_USED` / `TOKEN_EXPIRED` responses. The requirement for a signature. Read-after-spend on the GET (`publicReleasePayload.ts:94-108` deliberately checks expiry and not `usedAt`; `holdpoints.test.ts:3390` pins it). The audit `/token/i` redaction traps and the deliberate naming of `tokenRecipient` / `releaseLinkIds` (`publicReleaseExecution.ts:215-226`, `publicBatchRoutes.ts:346-350`). Data retention windows. **Every public route** — E1 and E2 touch none.

---

## 5. Data model and migrations — **loud, and there is one**

**Total schema change across Wave E: one index.**

```prisma
model HoldPointReleaseToken {
  // ... unchanged, schema.prisma:805-828
  @@index([batchId])
  @@index([holdPointId])   // NEW — E2
  @@map("hold_point_release_tokens")
}
```

Reviewed Prisma migration (`npm run db:migrate -- --name holdpoint_release_token_holdpoint_index`), additive, index-only, no backfill, no data movement, no column added or dropped, safe to apply while serving. Production apply follows Wave 0 change management (program line 56). **Never `prisma db push`, never `--accept-data-loss`** (CLAUDE.md operational warnings).

**Two migrations Rev 1 implied and Rev 2 does not ship:**
- `HoldPointReleaseBatch.recipientEmail` index — **withdrawn** per `[ER-B10]`; that path cannot answer the query.
- Any reminder-state or requester column — **not needed** per §4.2.2 and §4.2.5.

**One migration that may become necessary and is not E1's:** the `[ER-B1]` data-migration PR, if and only if §0.6's E1-Q1/E1-Q3 return BLOCK-bucket rows. Its shape cannot be written before the data is seen, which is why the inventory is a precondition rather than an assumption. §4.1.1.

### 5.1 The columns this wave was expected to add, and did not

| Expected | Why not |
|---|---|
| `HoldPoint.dueAt` | `scheduledDate` (`schema.prisma:770`) is already the date the decision is needed by, is already indexed with status (`:799`), is already what §4.2.1's clock reads, and is already what the request modals collect. *Flip:* a pack or contract requires a response deadline that differs from the inspection date. |
| `HoldPoint.reminderCount` / `lastRemindedAt` | `chaseCount` / `lastChasedAt` are exactly these. A reminder is a chase CIVOS sent on your behalf. |
| A generation/version column | `notificationSentAt` is already rewritten on every request and already means "when this generation started" — §4.2.2. Adding a second monotonic value to express the same fact is how two sources of truth begin. |
| `HoldPoint.requestedByUserId` | §4.2.5's table. The audit log already has complete history on both paths and is retention-exempt. |
| A recipient-suppression table | §4.2.6 requires suppression *handling*; whether it needs a **table** is E.0 item 16, because it is a PII-retention question. Rev 1's flat "no suppression table" non-goal is withdrawn. |
| A durable "approval request" entity | The ask is recorded four ways (§2.4), and readiness in this program is **computed, never a stored flag** (program line 32). |

---

## 6. Invariants Wave E must not break

| Tag | Invariant | Asserted by |
|---|---|---|
| `[E-B1]` | **No fifth definition of "awaiting release", and no repoint without a production inventory first.** One predicate in `predicates.ts`; the alert creator and the alert resolver both import it; §0.6's queries are in the E1 PR body. | AT-98, AT-99 |
| `[E-B5]` | **No reminder ever fires for a hold point that is not awaiting release, more often than the cooldown, or more than `MAX_CHASES_PER_REQUEST` times per request generation** — enforced by one atomic reservation shared by the manual route and the job, never by a read-then-write. | AT-102, AT-114 |
| `[E-B6]` | **No expired capability is ever used as a live one.** Every token read that drives a send requires `expiresAt > now`. | AT-118 |
| `[E-B7]` | **Token redaction survives.** Any new or changed path shape is added to `logSanitization.ts` (`:58-60`, `:94-95`) and asserted, and no new audit key that could carry a recipient email escapes the `/token/i` trap (`auditLog.ts:20`). | AT-109 |
| `[E-B8]` | **No capability is ever derived by unioning other capabilities by email**, in any phase including deferred ones. Aggregate access is explicit, materialized and issued by an authorized internal user. | §4.3.2; enforced by review, and by AT-105 when the successor slice is built |
| `[E-B8b]` | **No email attributes a request to someone who did not make it.** The requester is resolved per §4.2.4, and a fallback is named as a fallback in the body. | AT-115 |
| `[E-B9]` | **A public GET never mutates.** No Wave E change makes any GET set `usedAt`, release a hold point, write a decision or trigger a notification. | AT-112 |
| `[E-B10]` | **`git diff` for the whole wave touches none of** `recordDecision.ts`, `publicReleaseExecution.ts`'s claim predicate, `tokens.ts`, `dataRetention.ts`, **any public route file**, or any migration that drops or alters an existing column. | Mechanical check, exit item 10 |

Rev 1's `[E-B2]`, `[E-B3]` and `[E-B4]` concerned the queue and move with it to §4.3; their tags are retired here rather than renumbered, so a reader of both revisions is not misled.

---

## 7. Security, tenancy and privacy

### 7.1 The threat-model gate — **E.0, BLOCKING, ships before any Wave E code**

Program §7 line 134 requires *"threat model as a gated artifact before A3, C2, D2, **E**"*. **NOT FOUND:** any threat-model artifact under `docs/` at this SHA — the only files mentioning the phrase are plan documents deferring it. C2 satisfied the gate **by scope** because it built no external link, while recording that the artifact becomes *"a hard precondition — a PR, not a paragraph"* the moment one is built (`wave-c2-test-lifecycle-spec-2026-07-28.md:530-532`). **Wave E is that moment** — E2 automates mail into the external channel even though it adds no route.

**E.0 is a docs-only PR merged before E1**, in the shape of C3.0 (`wave-c3-spatial-tests-lims-spec-2026-07-28.md:71-82`): a self-contained artifact at `docs/plans/wave-e-threat-model-2026-07-XX.md`, cited at a stated SHA.

**The change Rev 2 makes, folding `[ER-B11]`: a verdict is not an outcome.** Every item below **must** terminate in one of exactly three dispositions, each with a named owner and a **testable** exit condition:

- **Accept** — the risk is taken as-is. Exit condition: the accepting sentence appears in the artifact with the owner's name.
- **Mitigate before phase X** — exit condition names the PR and the test that proves it.
- **Block** — no Wave E phase proceeds until it is re-dispositioned.

**A current violation may not be dispositioned as "documented".** Any item whose *present* behaviour breaks the §7.4 rule and which E1 or E2 touches gets a **prerequisite remediation PR named in §9**, not a paragraph. Today exactly one such PR exists — **E.0a** (§9) — and it is required because two tests currently *lock the disclosures in*: `holdpoints.test.ts:311` asserts `notificationSentTo` is present, and `publicBatchRoutes.test.ts:269-273` asserts `requestedBy` and `recipient.email` are present. Removing a disclosure is therefore a test change, not only a code change, and it cannot be smuggled into a phase PR.

**Items 1–10** (carried from Rev 1, dispositions now mandatory):

1. **The capability model.** What one token grants today (one hold point, or one lot's batch). Since E3 is deferred, this item is now a **baseline** statement plus the written prohibition `[E-B8]`.
2. **Enumeration.** Token entropy (256 bits, `requestReleaseRoutes.ts:203`) versus the only limit that applies today: 1000 requests/minute/IP, global (`rateLimiter.ts:47-48`, `server.ts:115`), with **no test asserting any limit** at `server.ts:159`. Must specify the limiter (§7.3) and decide the **response oracle**: unknown token → 404 `Invalid or expired link` (`publicReleasePayload.ts:97-99`), known-but-expired → 410 `TOKEN_EXPIRED` (`:101-107`) — a distinguishable existence signal, practically worthless against 2²⁵⁶, but a decision that must be *recorded as taken*.
3. **Expiry, revocation and replay.** The 48-hour constant (`tokens.ts:17`); the three implicit revocation paths and the absence of an explicit one; the guarded claim as the replay defence (`publicReleaseExecution.ts:76-89`) and its tests (`holdPointReleaseDecision.db.test.ts:532-549`, `holdPointBatchReleaseDecision.db.test.ts:475-504`). Must answer: **should there be an explicit revoke endpoint?**
4. **The disclosure inventory, item by item.** Everything a bearer reaches today: `notificationSentTo` — every other recipient's email (`publicReleasePayload.ts:137`, rendered `holdPointEvidencePdf.ts:44-46`); `tokenInfo.recipientEmail` (`:149`); the batch summary's `requestedBy: requestedByUser?.fullName || requestedByUser?.email || null` (`publicBatchRoutes.ts:104-109`, `:142`) — **an internal staff email whenever `fullName` is null** — and `recipient: { email, name }` (`:145-148`); `project.company { name, abn, address, logoUrl }` with the logo as a data URL (`evidencePackage.ts:277-291`); the full names of every internal staff member who completed or verified each checklist item (`:137-171`); laboratory names and report numbers (`:173-195`); raw `project.id` and `lot.id` UUIDs. **No current test asserts any of them is absent; two assert the opposite.** Each needs its own disposition; those dispositioned Mitigate route to E.0a.
5. **Post-spend and post-decision read.** The GET stays readable after `usedAt` by design (`publicReleasePayload.ts:94-108`, pinned `holdpoints.test.ts:3390`). For how long should a spent link keep rendering a full evidence package?
6. **Email as the trust boundary.** Forwarded links, shared `info@` inboxes, mail-client prefetch. Must confirm no Wave E change makes any GET a mutation — now testable, `[E-B9]`/AT-112. Must state §7.6's claim limit.
7. **Automated mail to a non-user.** Cadence (§4.2.1), the per-generation cap (§4.2.2), the **digest and daily limit** (§4.2.6), the absence of `List-Unsubscribe` (**NOT FOUND**), the `replyTo` mitigation, domain-reputation risk to the entire passwordless channel, and a stated position on the Spam Act 2003 (Cth) transactional-versus-commercial question — **as a position to check with counsel, not as legal advice**.
8. **Tenancy.** E1 and E2 add no new query surface reachable by an external party; the artifact must state that and confirm the automation job cannot cross a project boundary (`notificationAutomation.ts:172-190`).
9. **Logging and redaction.** `[E-B7]`: existing path traps (`logSanitization.ts:58-60`, `:94-95`) and the audit-key trap (`auditLog.ts:20`) extended to any new shape. Must restate the naming hazard at `publicReleaseExecution.ts:215-226` — renaming `tokenRecipient` to anything without "token" in it would silently start persisting recipient emails to the audit log. **New in Rev 2:** §4.2.7's automated-send audit rows carry a resolved recipient email and are the first automation-written rows to do so.
10. **Blast radius.** One sentence per phase: the worst outcome of one leaked link, and whether it is accepted.

**Items 11–16 — the six `[ER-B11]` named as missing.** All six are **Block by default** until dispositioned.

11. **Capability reissuance after expiry.** Who may reissue, for how long after the original request, and which events terminate reissuance. Drives §4.2.3. **Blocks E2.** Owner: Jay. Exit: the rule is written and AT-118 encodes it.
12. **Shared mailbox, name and case collision.** What CIVOS does when two humans share `info@`, when the same normalized email carries two stored names, and when casing differs (`actionRoutes.ts:91-103`, `requestReleaseRoutes.ts:744-761` store first-seen casing). **Blocks E2** for the daily-limit key (§4.2.6) and blocks any successor slice entirely.
13. **Chase reservation concurrency and cap grain.** Whether the cap is per hold point per lifetime or per request generation, and whether a failed send consumes an attempt. §4.2.2 proposes generation-scoped and no-consume-on-failure; E.0 ratifies or overrides. **Blocks E2.**
14. **Durable requester authority for `replyTo`.** Whether a `replyTo` may address a user who has since left the company, and what the fallback is. §4.2.4 proposes company support. **Blocks E2.**
15. **Cross-lot immutable-evidence correctness.** `[ER-B9]`. Nothing in E1/E2 touches it. **Blocks the successor slice**, recorded here so it is not rediscovered.
16. **Suppression storage and retention.** Whether bounce/complaint suppression is a CIVOS table or a provider read, and if a table, its retention policy — an external individual's email held for a negative reason is a PII decision. **Blocks E2's suppression handling** (§4.2.6), not the rest of E2.

### 7.2 Tenancy

E1 and E2 add **no external-facing query surface**. The automation job is scoped by the runner's project loop and the canary allowlist (`notificationAutomation.ts:172-190`), and every recipient it resolves comes from a record already attached to the hold point's own project. The cross-project question is a property of the deferred slice; §14.1 J1 keeps the answer on record so the successor does not relitigate it, labelled per `[ER-A2]` as **scope, not authorization**.

### 7.3 Rate limits — required before the successor slice, not before E1/E2

Today: global only, 1000/min/IP (`rateLimiter.ts:47-48`), nothing narrower at `server.ts:159`. The codebase has the pattern — `authRateLimiter` (`server.ts:140`), `supportRateLimiter` (`:162-163`), and `consumeRateLimit(bucket, key, window, max)` (`rateLimiter.ts:229`) taking an arbitrary bucket and key. A public hold-point limiter is ~10 lines beside its four siblings.

Two dimensions, both decided in E.0 item 2 and implemented **with the successor slice**, since E1 and E2 change no public route: per IP on `/api/holdpoints/public/*` (the enumeration control), and per token on the release POSTs (the abuse control for a leaked link). The limiter must key on the **hashed** token, never the raw one.

### 7.4 What the link must never reveal

> A hold-point release link may reveal the evidence for the hold points its recipient has been asked to decide, plus the minimum context needed to know what is being signed (project name and number, lot number and activity, scheduled date, expiry, who asked). It may not reveal **any other person's contact details**, **any address the request was also sent to**, **any internal identifier that is not needed to render the page**, or **anything about a lot or hold point the recipient has not been asked about**.

Measured against that rule at this SHA, §7.1 item 4 lists the current exceptions. Rev 1 cut two of them inside E3; with E3 deferred they are **E.0's call**, and any it dispositions Mitigate go to **E.0a** (§9).

### 7.5 Data sensitivity

The wave adds no new personal-data field and no new external egress destination. It does *increase the rate* at which one existing category — an external individual's email address — is used, by automating mail to it; §4.2.6's digest and daily limit are what bound that increase. `recipientEmail` remains protected from the audit log by the `/token/i` trap (`auditLog.ts:20`, `publicReleaseExecution.ts:215-226`) and from request logs by the path traps (`logSanitization.ts:58-60`). No Wave E change may weaken either; `[E-B7]`.

### 7.6 Identity and the Electronic Transactions Act — the claim, and its limit

The program's research register records, verbatim (`CIVOS-Research-Appendix-2026-07-24.md:66`):

> *Electronic Transactions Act 1999 (Cth) + state mirrors: e-approvals valid if identity + intent + reliability* — sources: `https://www.ag.gov.au/legal-system/electronic-signatures-documents-and-transactions` (grade **A**) and `https://kreisson.com.au/esignatures/` (secondary, grade **C**); decision supported: *"Link approvals are defensible with identity capture + immutable history"*; caveat: ***"Some head contracts still mandate wet-ink — contract check per pilot; this register is not legal advice."***

That row is reproduced here and **nothing is added to it**. This spec does not claim CIVOS releases are legally binding, does not claim compliance with any state mirror, and does not restate the caveat in weaker words.

What CIVOS actually records at the moment of an external release, all inside one serializable transaction (§2.2): the token row as actor, the recipient name the site team addressed the link to, the name the person typed, their organisation, a hand-drawn signature, the IP address, the user agent, the timestamp, the readiness snapshot, and a `HP_PUBLIC_RELEASED` audit row no later edit rewrites.

What it does **not** prove, in the same words program §7 line 135 uses: *"possession of an emailed link does not by itself prove who made a contractual decision."* A forwarded link signed by a colleague produces a record that is complete, immutable and attributed to the wrong human. **CIVOS records strong, tamper-evident evidence of a decision made through a link addressed to a named person; it does not verify that person's identity, and any contract requiring stronger assurance needs a control CIVOS does not ship.**

**Tier-2 chase links are weaker still**, and E2 is what makes them common. A tier-2 link (§4.2.3) is minted against an address parsed from `notificationSentTo`, which stores emails without names, so the token carries no `recipientName` and the identity override at `holdpoints.ts:176-177` does not apply — the recipient types whatever name they like. E.0 item 6 must say so, and §14.2 `[E-l]` records that a tier-2 release is a materially weaker evidence artifact than a tier-1 one.

Program line 17's instruction stands: *"validate the strength of this with CIVOS design partners"*. Wave E does not close that question; it makes it askable with something real to show.

---

## 8. API and UI surface

### 8.1 Backend

| Phase | Change | File |
|---|---|---|
| E1 | New shared predicate + status constant | `lib/readiness/predicates.ts` |
| E1 | **Inline** status literal repointed; per-project `take`; global per-pass cap; deferred cursor; horizon | `lib/notificationAutomation/systemAutomation.ts:277-288` |
| E1 | Private status list deleted, shared constant imported | `lib/notificationAutomation/systemAlertResolution.ts:32`, `:89` |
| E1 | Canary allowlist env → existing `projectIds` option | `lib/notificationAutomation.ts:68`, `:172-190` |
| E1 | Provenance record + its two pinning tests updated | `lib/readiness/contracts/reasonCodes.ts:214-223`, `contracts/contracts.test.ts:59-73` |
| E2 | Chase send sequence extracted to one exported function; route and job both call it | `routes/holdpoints/actionRoutes.ts:759-822` |
| E2 | Atomic `reserveHoldPointChase`; generation reset in the request transaction | `actionRoutes.ts:744-755`, `requestReleaseRoutes.ts:68-75`, `:821-829` |
| E2 | Shared recipient resolver: `expiresAt` predicate added, middle tier added | `actionRoutes.ts:200-220` |
| E2 | Requester resolved by audit lookup | `lib/auditLog.ts:209`; reads `AuditLog` `@@index([entityType, entityId])` |
| E2 | Fifth job registered in the existing hourly pass; digest grouping; daily limit; suppression check | `lib/notificationAutomation/notificationAutomation.ts:413-418` |
| E2 | `replyTo` added to `EmailOptions` and passed to Resend | `lib/email.ts:51-58`, `:173-180` |
| E2 | `replyTo` passed at four hold-point payload sites | `email.ts:430`, `:464`, `:498`, `requestReleaseRoutes.ts:457-462` |
| E2 | `requestedBy` corrected from recipient list to resolved requester | `lib/notificationAutomation/chaseNotifications.ts:81` |
| E2 | System-actor audit rows for automated, failed and suppressed sends | `actionRoutes.ts:827-836` pattern, `userId` omitted |

**No new route path and no public-route change in either phase.** The only authenticated route whose internals change is the chase route, which must be behaviour-identical apart from the newly-enforced cap (AT-100).

### 8.2 Frontend

| Phase | Change |
|---|---|
| E1 | None. |
| E2 | None. |

Wave E ships **zero frontend diff**. Existing E2E coverage stays green unchanged: `holdpoints.spec.ts:796-940` and `productionReadiness.spec.ts:987-1004`.

### 8.3 Permission matrix

| Action | Who | Enforced by |
|---|---|---|
| Request a release (issue links) | `HP_REQUEST_ROLES`, project writable | `requestReleaseRoutes.ts:600-606`, `:324`, `:738` |
| Chase manually | `HP_REQUEST_ROLES`, project writable, **awaiting release**, cap not spent, cooldown elapsed | `actionRoutes.ts:735-746` + §4.2.2's reservation |
| Reminder sent automatically | **no user** — actor is the automation worker (§4.2.7); no permission check, because it sends only to recipients an authorised user already chose, on projects an operator explicitly allowlisted (§4.1.3) | §4.2 |
| Open a link / read evidence | anyone holding a live token | `publicReleasePayload.ts:94-108` — **unchanged by this wave** |
| Release | the holder of that item's own live token | `publicReleaseExecution.ts:76-89` — **unchanged by this wave** |
| Receive the internal stale alert | `STALE_HOLD_POINT_ALERT_ROLES` (5 roles) | `notificationAlertConfig.ts:16-23` |

---

## 9. Phases and PR slicing

The wave is **E.0 → E1 → E2**. Each code phase is independently shippable and independently valuable. No phase depends on a later one.

**E.0 — Threat model artifact (docs only). BLOCKING.** §7.1, sixteen items, each `Accept` / `Mitigate before phase X` / `Block` with owner and testable exit condition. Merges before E1. No code.

**E.0a — Disclosure remediation (code). BLOCKING only for whatever E.0 dispositions "Mitigate before E1/E2".** Its scope is whichever of §7.1 item 4's fields E.0 rules must go. It exists as a named PR slot because two current tests assert the disclosures are **present** (`holdpoints.test.ts:311`, `publicBatchRoutes.test.ts:269-273`), so removing one is a test change and cannot ride inside a phase PR. **If E.0 dispositions every item Accept or Mitigate-before-successor-slice, E.0a is empty and is closed with that sentence in its place.** It is not permitted to be silently skipped.

**E1 — The signal that fires (S, no migration).** §4.1. **Precondition: §0.6's four production queries, run and dispositioned (§4.1.1).** Predicate, two inline-literal consumers repointed, provenance corrected, four bounds, canary allowlist, escalation held off. **Exit:** AT-98, AT-99, AT-103, AT-112, AT-113. **Ships alone:** on the canary projects, internal alerts for overdue external releases start working for the first time. No external email changes.

**E1a — `hold_points.status` CHECK or enum (S, one migration).** Follows E1 once the inventory is clean. Separate PR so a constraint and an alert-behaviour change never share a revert. `[E-i]`.

**E2 — The reminder that sends itself (S, one index migration).** §4.2. **Depends on E1** (uses its predicate and its canary allowlist) **and on E.0 items 11, 12, 13, 14** being dispositioned non-Block. Chase extraction, atomic reservation, generation reset, resolver fixes, hourly job, digest, daily limit, suppression, `replyTo`, system-actor audit. **Exit:** AT-100, AT-101, AT-102, AT-110, AT-114 … AT-118. **Ships alone:** supers get chased automatically, once per project per day at most, and the manual chase stops silently swapping recipients and stops being uncapped.

**Deliberately outside Wave E:** the recipient-scoped queue (§4.3, deferred — M); the N-fold volley fix (a precondition of that slice, `[ER-A1]`); the public-route rate limiter (§7.3); E2 release-package assembly (§1.2); the dashboards' stagnant correction (`[E-c]`); an attendance-required flag; any reject flow; any account, delegation or portal.

---

## 10. Scale and performance

Measured against the program's reference dataset (§8 line 138: 5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers), with percentile, device and network stated per program line 137.

| Target | Why |
|---|---|
| **E1's stale scan is bounded and its per-pass cost is stated in the PR body**, measured on the reference dataset, with the deferred-count log line shown and the §4.1.3 worst-case arithmetic filled in from E1-Q2 and E1-Q4. | It is currently an unbounded `findMany` with no `take` and an N+1 dedupe `findFirst` inside the loop (`systemAutomation.ts:278-297`). |
| **E2's job adds no more than a constant number of queries per pass, plus one reservation and one audit-log requester lookup per eligible hold point**, and the whole hourly pass still completes inside the advisory-lock transaction's timeout (`runner.ts:73-93`). | The pass holds a single global lock; a slow new job blocks diary reminders, docket alerts and escalations. The requester lookup is the §4.2.5 cost that must be measured, not assumed. |
| **The digest reduces message count measurably**: the PR body states messages-per-recipient-per-day before and after §4.2.6, on the canary population. | `[ER-A3]`'s 300-message arithmetic is the thing being disproved. |
| **`@@index([holdPointId])` measurably improves the `deleteMany` on the reference dataset**, or the PR says it did not and keeps it anyway with that sentence. | An index nobody measured is an index nobody can remove. |

---

## 11. Rollback and recovery

| Phase | Rollback | Recovery from a bad outcome |
|---|---|---|
| E.0 / E.0a | Revert. E.0 is docs. E.0a restores a disclosure and its two tests. | n/a |
| E1 | **Empty the canary allowlist** — one env change, no deploy, and the stale job stops entirely without touching diary reminders, docket backlog or escalations (§4.1.3). Then revert the PR: the predicate is additive and the repointed filters return to their dead values. | If alerts still storm inside the allowlist, the global kill switch `NOTIFICATION_AUTOMATION_WORKER_ENABLED` (`runner.ts:107`) remains as the blunt instrument. Alerts created in error are resolvable by the existing auto-resolver once the condition clears (`systemAlertResolution.ts:80-95`) and by the existing bulk paths. |
| E1a | Drop the constraint. | n/a — additive constraint on already-clean data. |
| E2 | Empty the allowlist (stops reminder mail within one hour, same as E1), then revert; the index migration stays. The manual chase returns to its previous behaviour — **including its lack of a cap**, which is worth stating: E2's revert re-opens `[ER-B5]`. | Mail already sent cannot be recalled. The bound on the worst case is the digest plus the daily limit (§4.2.6), which is why they are `[E-B5]`-adjacent controls and not settings. |

No phase writes a column that a rollback would strand. No phase changes an existing column's meaning. The single migration is additive and reversible without data loss.

---

## 12. Acceptance tests

Continuing the shared series; AT-97 was C3's last (`wave-c3-spatial-tests-lims-spec-2026-07-28.md:618`). **AT-104 … AT-109 and AT-111 are retained at their Rev 1 numbers but move with §4.3 to the deferred slice** — the numbers are not reused, so a reader of both revisions is not misled.

| # | Phase | Assertion | Kind |
|---|---|---|---|
| **AT-98** | E1 | **The signal matches what the code writes.** A hold point put into the awaiting state by the real `request-release` route (not a fixture literal) is matched by `holdPointAwaitingRelease`, and the alert scan creates a `stale_hold_point` alert for it once its `scheduledDate` is more than a day past. This is the test that would have caught `[E-B1]`. | DB-backed |
| **AT-99** | E1 | **Creator, resolver and provenance agree.** The scan and `systemAlertResolution` read the same exported constant; when the hold point is released the alert auto-resolves in the next pass; `REASON_CODE_PROVENANCE.hold_point_overdue` names the new predicate and source, with `contracts.test.ts:59-73` updated. A grep assertion pins that no second status list exists in either automation file. | DB-backed + grep |
| **AT-103** | E1 | **The backlog does not detonate.** With more eligible hold points than the bounds, one pass creates exactly the **global** per-pass cap (not the per-project `take` × projects), logs the deferred count and cursor, and the next pass resumes from the cursor with no duplicates (partial unique index `notification_alerts_active_type_entity_key`) and no unbounded fan-out. Hold points outside the horizon are never eligible. | DB-backed |
| **AT-112** | E1 | **`[E-B9]` GET purity — the regression test `[ER-A4]` asked for.** Repeated GET and HEAD requests against every public hold-point and batch route leave `usedAt` null, release nothing, write no audit decision row and trigger no notification — asserted by re-reading the database after the requests, not by inspecting the response. | DB-backed |
| **AT-113** | E1 | **The canary gate holds.** With the allowlist unset the stale job creates zero alerts; with one project listed it creates alerts for that project only and none for a second eligible project. | DB-backed |
| **AT-100** | E2 | **The chase extraction changed nothing it should not have.** Characterization: `POST /:id/chase` produces identical emails, identical token minting/supersession, identical `chaseCount`/`lastChasedAt` writes and an identical `HP_CHASED` audit row before and after the extraction — **except** the newly-enforced cap, cooldown and `completed`-status guard, each asserted as an intended change. | route test |
| **AT-101** | E2 | **The reminder reaches the person who was asked, after the tokens are gone.** Awaiting-release hold point, due per §4.2.1, **all tokens deleted by the retention sweep**: the job emails the address in `notificationSentTo`, mints a fresh token, and does **not** fall through to project users. The pre-fix behaviour is asserted to be the fall-through, so the test fails if the middle tier is removed. | DB-backed |
| **AT-102** | E2 | **Timing and the guards hold `[ER-B4]`.** No reminder before the due lead time; a far-future `scheduledDate` with `minimumNoticeDays = 1` produces **none** (the Rev 1 bug); a weekend-adjacent due date reminds on the working day; a non-default `project.workingDays` shifts it; a near-midnight `APP_TIMEZONE` value lands on the intended day; none for a released, completed or terminal hold point; none where `scheduledDate` is null; none within the cooldown; none past the per-generation cap. | DB-backed |
| **AT-114** | E2 | **The reservation is atomic `[ER-B5]`.** A real database concurrency test drives the manual chase route and the automation job against one hold point simultaneously and asserts **exactly one** send. Separately: after `MAX_CHASES_PER_REQUEST` sends, a new release request resets the generation and the hold point qualifies again; a failed send does not consume an attempt; a suppressed send does. | DB-backed |
| **AT-115** | E2 | **The requester is durable and correct `[E-B8b]`.** The reminder's `replyTo` and "Requested By" resolve to the user who made the current request generation, via the audit lookup — asserted on the **single**-request path, which has no `requestedByUserId`. A deleted requester (`userId` null via `onDelete: SetNull`) falls back to company support **and the body names it as a fallback**. A hold point with no `HP_RELEASE_REQUESTED` row also falls back rather than throwing. | DB-backed |
| **AT-116** | E2 | **Mail is bounded `[ER-A3]`.** A recipient with N eligible hold points on one project receives **one** digest listing all N with N distinct links — not N emails. A second pass the same day sends nothing to that recipient on that project. Casing variants of one address (`Sam@x.com` / `sam@x.com`) count as **one** recipient against the daily limit. A suppressed address receives nothing and the skip is audited. | DB-backed |
| **AT-117** | E2 | **System-actor audit attribution `[ER-A5]`.** An automated send writes an audit row with `userId` null and `changes` carrying source, reservation id, generation, chase count, resolved recipient, requester-resolution outcome and send result. **A failed send and a suppressed send each write a row too**, with distinct outcomes. | DB-backed |
| **AT-118** | E2 | **No expired capability is treated as live `[E-B6]`.** With only an expired unused token present, the resolver does **not** select its recipient from tier 1; it falls to `notificationSentTo`. Asserted with the retention worker **disabled**, which is its default outside production (`dataRetentionWorker.ts:29`) and the case Rev 1 missed. | DB-backed |
| **AT-109** | E2 | **Redaction survives `[E-B7]`.** No audit key added by this wave escapes the `/token/i` trap, and the automated-send rows (§4.2.7) do not persist a bare recipient email under a non-trapped key. | unit |

**Retained for the deferred slice, not built in Wave E:** AT-104 (ETA evidence pinned), AT-105 (`[E-B8]` the aggregate capability grants nothing outside its membership set — now including the forwarded-token and cross-signing negative tests), AT-106 (release consumes the item's own token), AT-107 (recipient and project come from the capability, never from input), AT-108 (one signature, one audit row, N snapshots — **and each snapshot carries its own lot's evaluation**, `[ER-B9]`), AT-111 (the disclosures are gone — asserted as absence).

---

## 13. Exit gate

1. **E.0 merged before any Wave E code**, all sixteen items dispositioned `Accept` / `Mitigate before phase X` / `Block`, each with owner and testable exit condition. Stated in every subsequent Wave E PR body. **E.0a merged or explicitly closed as empty.**
2. **The production status inventory is in the E1 PR body** — all four §0.6 queries, with every row dispositioned per §4.1.1 and any BLOCK-bucket rows cleared by a merged data-migration PR. `[ER-B1]`.
3. **`[E-B1]` proven, not asserted** — AT-98 green, and the PR body shows the before/after match count for the stale scan on a real project.
4. **The storm did not happen** — AT-103 and AT-113 green; the first 24 hours of production alert-creation counts on the canary projects are reported in the PR body, not assumed; and the §4.1.3 worst-case arithmetic is filled in with real `E` and `U`. **Escalation re-enabled only after one full escalation window inside the caps.**
5. **A real hold point is chased automatically end to end**, on a canary project, after its original link has expired and been purged, and the email lands with a working link and a `replyTo` that reaches the requester. Owner **Jay**.
6. **Mail volume is measured, not assumed** — AT-116 green, and the PR body states messages-per-recipient-per-day before and after the digest. `[ER-A3]`.
7. **The cap is real** — AT-114 green, including the concurrency test. The PR body notes that before E2 the manual chase had **no cap at all**, so this is a new control rather than a preserved one. `[ER-B5]`.
8. **GET purity is pinned** — AT-112 green, the first test asserting non-mutation on these routes. `[ER-A4]`.
9. **Automated sends are auditable** — AT-117 green, including a failed and a suppressed send. `[ER-A5]`.
10. **`[E-B10]` checked mechanically** — `git diff` across the wave touches none of the named files **and no public route file**, and the PR body shows the check.
11. **§10 numbers measured, not estimated**, including the audit-lookup cost per pass.
12. **`npm run fallow:audit` verdict recorded in every PR body.**
13. **Docs and the Clancy knowledge mirror updated** with: the live hold-point status vocabulary, the automatic-reminder cadence, the digest and daily limit, and the fact that the recipient-scoped queue is **not** built.

**Not in this gate, deliberately:** anything about accounts, delegation, rejection, release-package assembly, or the queue. Wave E turns none of those on, and an exit gate that mentioned them would imply it might.

---

## 14. Decisions

### 14.1 Jay's decisions

**J1 — If and when the queue is built, cross-project or per-project?**
**Recommendation: per project — and per `[ER-A2]`, this is scope, not authorization.**
*One-line why:* the same super can hold two different principals' contracts, and one bearer token should never span two clients' projects.
**Stated explicitly, folding `[ER-A2]`:** per-project scope **limits blast radius; it does not authorize anything**. It does not solve the token-A-to-token-B escalation and it does not solve shared-mailbox collision. Those are solved by §4.3.2's explicit aggregate capability or they are not solved. Anyone reading "per-project" as a security control has misread this decision.
*Flip:* a design partner's super says the project split is the annoying part → a per-recipient union with per-project headings, **still built on explicit capabilities**, and an E.0 amendment.
**Blocks nothing in Wave E. The queue is deferred (§4.3).**

**J2 — REFRAMED per `[ER-A3]`. Rev 1 asked "is a cap of three enough?"; the answer is that a per-item cap was never a mail-safety control at all.**
Three chases across 100 hold points is 300 automated messages to one address, and a per-item counter cannot see that. **Recommendation: all three of** (a) a **consolidated per-recipient digest** — one email per project per recipient listing every due item with its own link; (b) a **per-project-and-normalized-recipient daily limit** of 1; (c) **suppression handling** on bounces and complaints.
*One-line why:* the risk being managed is not "one super is annoyed", it is CIVOS mail being marked as spam and the entire passwordless channel dying with it — and only (a) and (b) bound that, while (c) is what stops CIVOS mailing an address that has already rejected it.
**What Rev 1 got right and is kept:** the per-item atomic counter (§4.2.2) — as **bookkeeping and per-hold-point fairness**, not as the mail-safety control. And `replyTo`, which is a courtesy, not a bound.
**What Rev 1 got wrong and is withdrawn:** the non-goal "no reminder-suppression table". Whether suppression needs a table is E.0 item 16.
**Decide before E2 ships. E.0 item 16 blocks (c) only.**

### 14.2 The spec's own decisions

- **`[E-a]` — `scheduledDate` is the due date; no new column.** §5.1. *Flip:* a contract or pack requires a response deadline distinct from the inspection date.
- **`[E-b]` — `chaseCount` / `lastChasedAt` are the reminder state.** *Flip:* a report needs to distinguish human chases from automatic ones — then it is a `chaseSource` enum, still not a second counter.
- **`[E-c]` — the dashboards' stagnant definition stays wrong in Wave E.** §0.3 shows it lives at **eight** sites, only two via the shared constant. Correcting it changes five dashboard surfaces' numbers and belongs with A2 alert hygiene. *Flip:* Jay asks why the dashboard and the alerts disagree — then it is its own S with a before/after count diff, and its first task is to collapse the six inline literals onto the constant.
- **`[E-d]` — REVISED per `[ER-B3]`. `holdPointOverdue` / `OVERDUE_HOLD_POINT_STATUSES` are neither deleted nor repointed, because they have two live production consumers** (`statsRoute.ts:89`, `actionAssignments.ts:135`). Rev 1's "no production consumer" claim is withdrawn. They are annotated to record that the alert engine never used them.
- **`[E-e]` — RETIRED.** It concerned the queue's page reuse; §4.3 is deferred.
- **`[E-f]` — the volley fix ships outside Wave E**, and per `[ER-A1]` is now a precondition of the deferred slice rather than a mid-wave interleave. §4.3.5.
- **`[E-g]` — `ponytail:` the machinery mostly exists, and Rev 2 makes it exist more.** Wave E is one status value, four bounds, one env allowlist, one middle tier and one expiry clause in a resolver, one atomic reservation, one job in an existing pass, one index, one optional email field, and an audit lookup that needs no schema at all. The over-build available here — an approval-request entity, a due-date column, a reminder-state table, a requester column, a recipient-preferences model, an external portal, an e-signature integration, a reject/comment thread — is roughly fifteen times the code for zero additional answered questions in v1. **Rev 2's largest single act of laziness is deferring E3**: the review showed it needed a new capability table, a normalization backfill, a composite index, a per-lot evaluation rewrite and a volley fix — an M wearing an S's clothes.
- **`[E-h]` — reminders are whole-day, not time-of-day.** `scheduledTime` is a free-text `String?` (`schema.prisma:771`). *Flip:* `scheduledTime` becomes a real time.
- **`[E-i]` — NEW. The `hold_points.status` CHECK/enum is E1a, not E1.** Folding `[ER-B1]`'s final bullet: the constraint is right, but adding it in the same PR that changes alert behaviour mixes two reverts, and it cannot be written before the inventory says what values exist.
- **`[E-j]` — NEW. A failed send does not consume a chase attempt; a suppressed send does.** §4.2.2. Failure is a transport problem and re-trying is correct; suppression is a decision and re-trying is not.
- **`[E-k]` — NEW. The durable requester is an audit-event lookup, not a column.** §4.2.5's table is the argument. *Flip:* §10's measurement shows the lookup costs real time — then it becomes a denormalized **cache** of the audit answer, not a second source of truth.
- **`[E-l]` — NEW. A tier-2 chase release is a weaker evidence artifact than a tier-1 one**, because a tier-2 token carries no `recipientName` and so no identity override (`holdpoints.ts:176-177`). E2 makes tier-2 links common, so this must be in E.0 item 6 and in §7.6 rather than discovered by a lawyer.

---

## 15. Research: settled, and what must not be invented

### 15.1 Settled — do NOT commission another pass

| Claim | Source and grade | Used for |
|---|---|---|
| Passwordless external approval is the adopted pattern; mandatory reviewer accounts are a **known adoption risk** | Program line 17; `CIVOS-Research-Appendix-2026-07-24.md:67` — CivilPro's no-account emailed approval links, grade **B, weakened by a 403 on automated fetch, flagged "human-verify before external citation"** | §1.3 items 1–2 |
| A competitor sells no-account external sign-off | Appendix `:69` — holdpoint.co, grade **B** | Table-stakes framing; not a claim CIVOS makes publicly |
| ETA 1999 + state mirrors: e-approvals valid given identity + intent + reliability | Appendix `:66` — grade **A** (AG) / **C** (law firm), reproduced verbatim in §7.6 **with its caveat** | §7.6 only. Not restated, not strengthened, not used in any public copy. |
| CivilPro ships chainage lot mapping; the moat is modality | Appendix `:76`, grade **B** | Nothing in Wave E; noted so no one re-derives it |

**Explicitly not settled, and never to be asserted:** that a CIVOS link release satisfies any particular head contract; that any state ETA mirror has been checked for this workflow; that a reminder email is or is not a "commercial electronic message" under the Spam Act 2003 — §7.1 item 7 requires a *stated position to check*, not a conclusion.

### 15.2 Must be researched before it is encoded — never inferred

- **Whether design partners' supers accept passwordless links at all** — program line 17's own instruction. This wave makes the question askable; it does not answer it.
- **Whether any head contract in a pilot mandates wet-ink** — appendix `:66` caveat. Per pilot, a contract check, not a research pass.
- **What a real superintendent does with three pending links today** — the assumption behind the deferred queue is that four emails is the pain. It is a plausible inference from §2.3's mechanics, not an observed behaviour. **Rev 2 makes this cheaper to answer**: with the queue deferred, the question can be asked of a design partner *before* the M-sized slice is built rather than after. Program line 69 (A6) requires observed, moderated sessions each major wave.

---

## 16. Verification notes

Every `file:line` in this document was opened in this worktree at `470b0422e23865b5207d59b8984a674cb050acb4`. Rev 2 additionally re-verified every one of the review's seventeen findings before folding it. The findings most likely to be doubted, and how each was established:

1. **The alert engine consumes neither shared predicate symbol** (§0.3, `[ER-B3]`) — established by grepping `OVERDUE_HOLD_POINT_STATUSES|holdPointOverdue` across all of `backend/src` and classifying every hit. Production consumers: `statsRoute.ts:9`,`:89` and `actionAssignments.ts:18`,`:135`, plus the provenance **string** at `reasonCodes.ts:221`. `systemAutomation.ts:1-6` imports only `daysOverdue`; its filter at `:281` is an inline literal; `systemAlertResolution.ts:32` declares a private copy. Everything else is tests or comments. **This inverts Rev 1's §4.1 premise and is the single largest correction in Rev 2.**
2. **There is no cap on the manual chase** (§2.5, `[ER-B5]`) — established by grepping `chaseCount|lastChasedAt` across non-test `backend/src`: 15 hits, all display, context or the `:752` increment. **No comparison operator is applied to `chaseCount` anywhere in the codebase.** Rev 1 described a cap that does not exist.
3. **A durable requester already exists on both paths** (§4.2.4, `[ER-B7]` partially refuted) — `HoldPointReleaseBatch.requestedByUserId` at `schema.prisma:843`, written `requestReleaseRoutes.ts:365`, read `publicBatchRoutes.ts:104-109`; and `HP_RELEASE_REQUESTED` audit rows carrying `userId` on **both** paths at `requestReleaseRoutes.ts:486-501` and `:916-935`. Retention exemption established by reading `RetentionPrismaClient` (`dataRetention.ts:66-75`), which does not list `auditLog`, and `applyRetentionPolicies` (`:86-146`), which never touches it — stated outright at `:80-81`.
4. **The sample-project seeder cannot fire the alert** (§3.1, `[ER-B1]`) — `sampleProjectRoute.ts:191-207` writes `'requested'` but `grep -n scheduledDate` on that file returns nothing, so the column stays NULL, and both the Prisma `lt` filter and `predicates.ts:109-110` exclude nulls. This is what makes "no code path creates the queried state" provable while "it has never fired in production" remains unprovable from the repo — hence §0.6.
5. **Two tests currently lock the disclosures in** (§7.1, `[ER-B11]`) — `holdpoints.test.ts:311` (`toHaveProperty('notificationSentTo')`) and `publicBatchRoutes.test.ts:269-273` (`requestedBy`, `recipient.email`). This is why E.0a is a named PR slot rather than a paragraph.
6. **The citation drift is narrow** (`[ER-A6]`) — `git diff --name-only a22d2026 470b0422 -- backend/src backend/prisma frontend/src` returns 12 files, of which one (`server.ts`) is cited here. §0.5 is the complete move list.

**NOT FOUND, stated so no one re-searches:** any threat-model artifact under `docs/`; any enum or CHECK constraint on `hold_points.status` in any migration; any comparison against `chaseCount`; any `expiresAt` predicate in the chase recipient resolver; any explicit token-revocation endpoint; any rate limit or rate-limit test specific to `/api/holdpoints/public/*`; any `List-Unsubscribe` header or unsubscribe mechanism; any `replyTo` or `reply_to` anywhere in `backend/src`; any second email transport; any `dueDate`/`requiredDate`/`respondBy` column on the hold-point models; any `projectId` on `HoldPointReleaseBatch`; any index on `HoldPointReleaseToken.recipientEmail` or `.holdPointId`; any generation/version column on `HoldPoint` or its tokens; any production caller of the `system` actor arm; any cross-lot or recipient-scoped public query; any unit test for `PublicHoldPointReleasePage.tsx`; any test asserting a public payload field is **absent**; any test asserting a public GET does not mutate; and the files `backend/src/lib/readiness/seedCorpus.ts` and `backend/src/routes/dashboard/projectOverview.ts`, both of which Rev 1 cited and neither of which exists.
