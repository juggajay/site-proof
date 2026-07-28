# Wave E Execution Specification — the approvals thin slice: the reminder that never fired, and the link that shows one thing

**Date:** 28 July 2026 · **Rev 1** · **Size:** S (three code phases, one of them zero-migration)

**Status:** implementation-ready for Phases E1–E3 **behind one blocking pre-build gate (E.0, §7.1)**. No Wave E code PR may merge before the E.0 threat-model artifact merges. Two Jay decisions are open (§14.1); neither blocks E1.

**All `file:line` citations were opened in this worktree at HEAD `a22d2026e2f8757ad58187e1c94207a37a78cb3a`** (= `origin/master`, `fix(e2e): lots spec catches up with the register importer UI (#1631) (#1643)`). Nothing in this document is quoted from memory or from another spec's citation; every line number below was read at that SHA.

**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md`
- **§3 line 95** — Wave E's scope sentence, disposed of clause by clause in §1.2.
- **§1 line 17** — the belief this wave rests on: *"passwordless links (**mandatory reviewer accounts are a known adoption risk** — CivilPro's no-account link won in market; validate the strength of this with CIVOS design partners); v1 = due dates + reminders + link-opened pending queue; hold points only; accounts/delegation deferred until demanded."*
- **§4 line 110** — deliberate non-build: *"external-reviewer accounts/portals"*.
- **§6 line 127** — the External collaboration standard, which is this wave's definition of done.
- **§7 lines 134–135** — the threat-model gate and the standing security requirements. §7.1 here is that gate.
- **§9 line 149** — the execution-specification requirement this document satisfies.

**Parent specs, read not remembered:**
- `docs/plans/f0-execution-spec-2026-07-24.md` — **line 142**: *"The batch's N-fold duplicate notification volleys are a known pre-existing defect fixed separately, NOT in F0.4b."* That defect is still open at this SHA (§2.7) and it is a precondition of E3 (§9).
- `docs/plans/wave-c2-test-lifecycle-spec-2026-07-28.md` — **§7.3 line 530–532**, the precedent this spec follows for the threat-model gate: *"**NOT FOUND:** any threat-model artifact under `docs/`. The gate is satisfied for v1 **by scope** … The moment J4 flips and an external lab upload link is built, the threat-model artifact becomes a hard precondition — a PR, not a paragraph."* **Wave E is that moment.** C2 could satisfy the gate by scope because it built no external link. E *is* the external link. There is no scope in which E satisfies §7 line 134 by abstention.
- `docs/plans/wave-c3-spatial-tests-lims-spec-2026-07-28.md` — the **C3.0** pattern: a blocking, docs-only, pre-build research PR that discharges a gate before any code (`:3`, `:71-82`). E.0 is the same shape, for security instead of research.
- `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` — **line 66** (Electronic Transactions Act 1999) and **lines 67, 69** (CivilPro / HoldPoint no-account links). Quoted verbatim in §15.1; nothing is added to them.

**House style** matches the C1, C2, C3, D14, F1 and sync-centre specs: numbered sections, an explicit clause-by-clause disposal of the program line, a current-state map with citations, migrations called out loud, independently shippable phases, a named acceptance-test series continuing the shared numbering (this wave starts at **AT-98**; AT-97 is C3's last, `wave-c3-spatial-tests-lims-spec-2026-07-28.md:618`), an exit gate, and a decision register with flip conditions.

---

## 0. What this slice is, what it deliberately is not

### 0.1 The one-paragraph version

A superintendent already receives a passwordless CIVOS link, opens a full evidence package without an account, types their name, signs, and releases a hold point — and CIVOS already records that decision as one serializable transaction with an immutable audit row carrying the actor token, the recipient's name, the signature, the IP address and the user agent. That half is shipped and is not rebuilt. What is missing is everything *around* the decision: **nothing ever reminds the super**, because the one automated reminder CIVOS has is keyed on two hold-point statuses that no code writes (§3); **nothing survives the link**, because the only durable record of who was asked is a 48-hour bearer token that the retention worker deletes on expiry (§2.4); and **the link shows one ask**, so a super sitting on four lots gets four emails and four links (§2.3). Wave E fixes those three things in that order, adds no accounts, adds no delegation, adds no new page, and adds **one** database migration in total.

### 0.2 The scope cut, stated honestly

The program's Wave E line (line 95) names six things. This spec builds **three** and disposes of the other three in §1.2 with reasons. The cut is deliberate and it is what makes this an S: two of the three built phases have no migration, and the third reuses a table and a page that already ship.

The wave's one genuinely new risk is not code volume. It is that **E1 turns on an alert that has never fired on production data**, and E2 then puts an automated email on top of it. Program line 64 already records what happens when an alert path is uncapped against a historic backlog (*"never a raw uncap over the 3,669-alert backlog — storm risk"*). §4.1 and §11 treat that as the wave's principal operational hazard, not as a detail.

### 0.3 The finding that reframes the wave

`HoldPoint.status` has exactly three live values in production code: `pending` (the schema default, `schema.prisma:767`), `notified` (set when a release is requested, `requestReleaseRoutes.ts:349` and `:823`) and `released` (`publicReleaseExecution.ts:124`, `actionRoutes.ts:470`). The alert engine's stale-hold-point scan filters on `status: { in: ['requested', 'scheduled'] }` (`systemAutomation.ts:281`). **Neither value is ever written to a hold point by production code.** §3 has the full evidence and the four divergent definitions it produced.

So "reminders" is not a feature Wave E invents. It is a shipped feature that has been silently unable to fire, plus an external limb it never had.

---

## 1. Outcome, scope and non-goals

### 1.1 Outcome

Three sentences, each independently checkable:

1. **A hold point waiting on an external decision is visible as waiting, to the system and not only to the screen.** The awaiting-release signal is one predicate, keyed on the status the code actually writes, consumed by the alert engine, its auto-resolver and the dashboards.
2. **A super who has not answered gets reminded, automatically, at most three times, and the reminder reaches the person who was actually asked** — including after the original 48-hour link has expired and been purged.
3. **Opening any of a super's live links shows every hold point that super currently holds a live link for on that project, in one list, and releasing any of them consumes that item's own token.** The link grants no capability the recipient did not already hold.

Adoption dependency, stated up front rather than discovered later: outcome 2's value is proportional to how many release requests carry a `scheduledDate` and a real external email. `scheduledDate` is nullable (`schema.prisma:770`) and the Prisma `lt` filter excludes nulls, so a request with no scheduled date produces no reminder and never will. That is correct behaviour, and it means the reminder list starts smaller than the hold-point list.

### 1.2 Every clause of program line 95, disposed of

| Clause of line 95 | Disposition |
|---|---|
| *"Due dates + reminders + escalation on existing hold-point links (targets the measured ready→released gap)"* | **Due dates + reminders: BUILT** (E1, E2), using the existing `scheduledDate` and the existing working-days minimum-notice setting (§2.6) — **no new due-date column**. **Escalation: NOT BUILT as new.** Internal escalation for `stale_hold_point` already ships at 4 h → level 1 and 8 h → level 2 (`notificationAlertConfig.ts:38-42`) with a bounded, paginated, idempotent engine (`alertEscalations.ts:207-310`, send cap 200 at `:32`). E1 is what makes it reachable at all. **External** escalation — mailing the super's manager — needs a contact CIVOS does not hold and is out (§1.3). |
| *"link opens a **recipient-scoped** pending queue (never general project visibility)"* | **BUILT** (E3), and "recipient-scoped" is given a precise, enforceable meaning in §7.2: the queue is the set of hold points for which *this recipient currently holds a live, unspent, unexpired token on this project*. It is a view over capabilities the recipient already has, never a new capability, and the recipient is derived from the presented token — never from a query parameter. |
| *"attendance-required/notice-period flags"* | **HALF ALREADY SHIPPED, HALF OUT.** The notice period ships: a per-project working-days minimum (`validation.ts:82`, `hpMinimumNoticeDays ?? holdPointMinimumNoticeDays ?? 1`), enforced on both request paths (`requestReleaseRoutes.ts:267-289`, `:654-676`), with an audited override carrying a reason that is printed in the email (`:797`, `holdPointTemplates.ts:338`). E2 consumes it. An **attendance-required flag** is a new field on a form with no consumer in v1 — the reminder does not behave differently for it and no report reads it. Out; flip condition in §14.2. |
| *"identity + immutable history for Electronic Transactions Act reliability"* | **ALREADY SHIPPED — verified, not assumed** (§2.2). The public release records actor `{kind:'external_token', tokenId, label: recipientName}` (`holdpoints.ts:216-220`), a mandatory signature (`validation.ts:263-268`), an identity bound to the token rather than to free text (`holdpoints.ts:176-177`), and an audit row written **inside** the release transaction with `ipAddress` and `userAgent` from the request (`recordDecision.ts:439-451` → `auditLog.ts:78-79`). Wave E adds **no** identity mechanism. It adds the honest statement of what that evidence does and does not prove (§7.6) and one test that pins it (AT-104). |
| *"**E2 release-package assembly** (MRWA 201 evidence network: underlying lots, adjacent interfaces, NCR close-outs, survey acceptance — auto-assembled, missing dependencies highlighted, full decision timeline recorded)"* | **OUT of this wave, in full.** The per-hold-point evidence package already assembles checklist, tests, photos and attachments up to the hold point (`evidencePackage.ts:318-355`). Extending it across *underlying lots, adjacent interfaces, NCR close-outs and survey acceptance* is an M–L piece that depends on C5 survey acceptance (program line 79) and on D1 readiness rollups (line 82), neither of which exists. Building the cross-lot dependency graph inside an S-sized approvals wave would be the single largest over-build available here. Named as a successor wave, not deferred vaguely. |
| *"Out of v1: accounts, delegation (until a real reviewer asks)"* | **Honoured, and widened** — see §1.3. |

### 1.3 Non-goals — the over-build this wave explicitly forbids

Do not build any of the following in Wave E. Each has a flip condition; none is met today.

1. **No accounts of any kind for external reviewers.** No signup, no magic-link session, no password, no "claim your account". Program line 110 lists external-reviewer accounts/portals as a deliberate non-build, and line 17 records that mandatory reviewer accounts are the known adoption risk. *Flip:* a design partner's super asks for one, in writing.
2. **No delegation.** No "forward to my colleague", no alternate-approver field, no acting-for. *Flip:* a real reviewer asks (program line 95's own condition).
3. **No per-super dashboard.** The queue is a list rendered by an existing page from an existing token. It is not a persistent home, has no login, no saved views, no filters, no history tab, no profile, no notification preferences.
4. **No e-signature product.** No certificate authority, no PKI, no signing ceremony, no tamper-evident PDF sealing, no third-party e-signature integration. The shipped signature pad plus the audited actor/IP/user-agent record is the evidence, and §7.6 states its limits rather than dressing it up.
5. **No reject / decline / return-for-information action.** There is none today on the public surface (verified: the public page's only mutation is release, `PublicHoldPointReleasePage.tsx:203-214`). A reject introduces a second decision kind, a second notification path, a second status and a conversation that has no home. *Flip:* a pilot super declines a hold point by replying to the email and the site team asks for it — at which point it is its own S, with its own spec.
6. **No new public page.** E3 widens the membership of the batch page that already ships (`App.tsx:246`, `PublicHoldPointBatchReleasePage.tsx`). It does not add a route.
7. **No new due-date column.** §5 explains why `scheduledDate` is the due date.
8. **No reminder-suppression table.** The control is a hard cap plus a reachable human (§4.2). *Flip:* a real recipient asks to stop and the cap is not enough.
9. **No cross-project queue.** §7.2 explains why per-project is the safe scope.
10. **No change to the release decision itself.** `recordDecision`, the token claim, the serializable guards, the 410 TOKEN_USED / TOKEN_EXPIRED contract and the snapshot behaviour are untouched by every phase. §6 makes this an invariant with a test.

---

## 2. Current-state map (read at `a22d2026`)

### 2.1 The link machinery that ships

Two public doors, both unauthenticated, both mounted under `/api/holdpoints` at `server.ts:157`.

| Door | Routes | File |
|---|---|---|
| Single hold point | `GET /public/:token`, `POST /public/:token/release`, `GET /public/:token/documents/:documentId` | `holdpoints.ts:105-116`, `:119-265`, `:69-102` |
| Batch ("review room") | `GET /public/batch/:batchToken`, `GET .../holdpoints/:holdPointId`, `GET .../documents/:documentId`, `POST .../release` | `publicBatchRoutes.ts:92-154`, `:158-180`, `:183-228`, `:234-429` |

Tokens are 32 random bytes rendered hex — `crypto.randomBytes(32).toString('hex')` (`requestReleaseRoutes.ts:203`, `:757`) — stored as a `sha256:`-prefixed digest (`tokens.ts:20-22`), with a raw-SQL `CHECK ("token" ~ '^sha256:[0-9a-f]{64}$')` on both token tables (`prisma/migrations/20260619143000_require_hashed_one_time_tokens/migration.sql:14-16`). Lookup re-hashes whatever is presented (`tokens.ts:24-28`), so a database leak yields no usable link. Expiry is **48 hours**, one constant, both paths: `SECURE_LINK_EXPIRY_HOURS = 48` (`tokens.ts:17`), applied at `requestReleaseRoutes.ts:199` and `:753`, pinned by `tokens.test.ts:27`.

Route params are length-capped before any DB hit — `MAX_RELEASE_TOKEN_LENGTH = 512` (`validation.ts:100`), applied at `holdpoints.ts:72, 108, 122` and `publicBatchRoutes.ts:95-99, 161-165, 187-190, 237-241`.

### 2.2 The decision record that ships — and why §1.2's ETA row says "already shipped"

Both public release doors route through the same `recordDecision` (`lib/readiness/recordDecision.ts:497-568`): one `prisma.$transaction` at `Serializable` isolation (`:515`, `:547`), up to five attempts with full-jitter backoff (`:157`, `:193-199`), 409 `DECISION_CONFLICT` on exhaustion (`:557-562`). Inside it, `executeHoldPointTokenRelease` claims the token as a guarded `updateMany({ where: { id, usedAt: null, expiresAt: { gt: releasedAt } } })` (`publicReleaseExecution.ts:76-89`) — the double-spend and post-expiry guards are one predicate, not a pre-check.

What the audit row carries, all of it inside that transaction:

- actor `{ kind: 'external_token', tokenId, label: recipientName }` — the token **row**, labelled with the name the site team addressed the link to, never the submitted free text and never an email (`holdpoints.ts:216-220`, `publicBatchRoutes.ts:333-337`, columns at `recordDecision.ts:355-361`);
- `ipAddress` and `userAgent`, because `req` is threaded through (`holdpoints.ts:220`/`publicBatchRoutes.ts:355` → `recordDecision.ts:450` → `auditLog.ts:78-79`);
- the identity override: `effectiveReleasedByName = token.recipientName || submitted name` (`holdpoints.ts:176-177`), so a link addressed to a named person cannot be signed under someone else's name;
- a **mandatory** signature — `signatureDataUrl` is required by the schema (`validation.ts:263-268`), guarded again client-side at `PublicHoldPointReleasePage.tsx:197`;
- `RequirementEvaluation` snapshots of the readiness at the moment of decision, when `READINESS_SNAPSHOTS_ENABLED` (`recordDecision.ts:234-237`);
- rollback proven, including the token claim: `holdPointReleaseDecision.db.test.ts:465-495`, `holdPointBatchReleaseDecision.db.test.ts:408-443`; double-spend proven: `:532-549` and `:475-504`.

**This is the identity-and-immutable-history limb of program line 95, and it is done.** Wave E's contribution is §7.6 — saying precisely what it proves.

### 2.3 What a super sees today when several releases are pending

Three separate answers, none of them a queue:

- **Single link** (`/hp-release/:token`, `App.tsx:241`): exactly one hold point. Project name and number, lot number and activity, scheduled date, expiry, checklist progress, the full evidence card with per-item attachments, tests, photos and a client-side PDF, then a name / organisation / notes / signature form (`PublicHoldPointReleasePage.tsx:277-463`).
- **Batch link** (`/hp-release/batch/:token`, `App.tsx:246`): N hold points — but the batch is created against **one `lotId`** and **one recipient** (`requestReleaseRoutes.ts:356-367`), so it is a per-lot, per-request room, not a queue.
- **Anything else**: nothing. There is no query anywhere that assembles "what is outstanding for this email address". A super with pending items on four lots receives four emails and holds four links, each expiring independently.

The mechanical consequence: the measured ready→released gap that program line 95 targets is being fought with an inbox.

### 2.4 Recipients — and where the recipient identity actually lives

Configured per project, as `hpRecipients: [{ role, email }]` in project settings (`ProjectSettingsPage.tsx:137`, validated at `projectSettingsValidation.ts:141-161`, read by `parseHPDefaultRecipients`, `validation.ts:59-67`). The single-request modal pre-fills a free-text `notificationSentTo` from them (`RequestReleaseModal.tsx:112-117`); the batch modal takes one email and name (`BatchRequestReleaseModal.tsx:229-247`). Fallback when nothing is supplied: project users with role `superintendent`, else `project_manager` (`requestReleaseRoutes.ts:706-735`).

**Where the identity is durably stored is the load-bearing fact for E2.** Three places, with three different lifetimes:

| Store | Field | Lifetime |
|---|---|---|
| `HoldPointReleaseToken` | `recipientEmail`, `recipientName` (`schema.prisma:808-809`) | **48 h.** The retention worker deletes any token with `expiresAt < now` (`dataRetention.ts:43-53`, applied `:110-114`), running every 24 h (`dataRetentionWorker.ts:10`). |
| `HoldPointReleaseBatch` | `recipientEmail`, `recipientName` (`schema.prisma:836-837`) | **Forever** — the retention client type does not include this model (`dataRetention.ts:66-75`). Only created on the batch path. |
| `HoldPoint.notificationSentTo` | comma-joined email list, normalised at `requestReleaseRoutes.ts:568-569`, written at `:825` | **Forever**, on both paths. Emails only — no names. |

And the manual chase resolves its recipients from the *first* of those: `loadHoldPointChaseTargets` reads `holdPointReleaseToken` where `{ holdPointId, usedAt: null }` (`actionRoutes.ts:204-211`), and **falls back to project users when that returns nothing** (`:219` → `loadProjectChaseTargets`, `:165-198`). So 48 hours and one retention sweep after a request, chasing an unreleased hold point silently stops emailing the external super and starts emailing internal staff instead — with no signal that the recipient changed. That is a pre-existing defect of the manual path; automating reminders on top of it would industrialise it. E2 fixes it once, in the shared resolver, for both callers (§4.2).

### 2.5 Reminders — the manual chase, and the automatic one that cannot fire

**Manual.** `POST /api/holdpoints/:id/chase` (`actionRoutes.ts:715-840`, `requireAuth`, `HP_REQUEST_ROLES`, refuses released hold points at `:746-748`). It increments `chaseCount` and stamps `lastChasedAt` (`:750-756`; columns `schema.prisma:779-780`), resolves targets (§2.4), mints a **fresh** token per target and revokes the superseded one on success (`:812-818`, `revokeSupersededChaseReleaseTokens` `:129-145`) or the fresh one on failure (`revokeFreshChaseReleaseToken` `:147-163`) — so exactly one live link per recipient survives a chase either way. The email is already reminder-shaped: subject `[CIVOS] REMINDER: Hold Point Awaiting Release - <lot> (Chase #N)` (`holdPointTemplates.ts:372`), body *"This is reminder #N"* (`:476`). It is audited as `HP_CHASED` (`:833-840`).

**Nothing calls it on a schedule.** There is no cron anywhere in this codebase — every background job is an in-process `setInterval` started in `server.ts:206-209`. The relevant one is the notification-automation worker: hourly by default (`runner.ts:10`), guarded by PostgreSQL advisory lock `731_452_021` (`runner.ts:12, 73-93`), running four jobs in order — diary reminders, docket backlog, system alerts, alert escalations (`notificationAutomation.ts:413-418`).

**Automatic — and dead.** The third of those jobs contains the stale-hold-point scan (`systemAutomation.ts:277-359`). Its filter is `status: { in: ['requested','scheduled'] }, scheduledDate: { lt: now - 1 day }` (`:279-283`). Per §3, neither status is ever written. Its auto-resolver carries a third copy of the same dead list (`systemAlertResolution.ts:32`).

### 2.6 Due dates — what already exists

- `HoldPoint.scheduledDate DateTime?` (`schema.prisma:770`) and `scheduledTime String?` (`:771`). **`scheduledTime` is free text, not part of the timestamp** — any "remind me the morning before" feature would have to parse it, which is why §4.2 reminds on whole days only.
- An index that already supports a due-date sweep: `@@index([status, scheduledDate])` (`schema.prisma:799`).
- A per-project **working-days** minimum notice, default 1 (`validation.ts:82`), enforced on both request paths (`requestReleaseRoutes.ts:267-289`, `:654-676`) with an audited override + reason surfaced in the email (`:797`, `holdPointTemplates.ts:338`).
- The frontend already computes both signals correctly and only there: `isOverdue` (`holdPointTableUtils.ts:14-23`) and `isNoticeExpired` (`:42-50`), both keyed on `status === 'notified'`, the latter using AEST calendar days via `getCalendarDaysSince` (`lib/localDate.ts:85-105`) precisely so a near-midnight UTC timestamp does not land on the wrong day.

There is no `dueDate`, `requiredDate` or `respondBy` column anywhere on the hold-point models. **NOT FOUND**, and §5 argues that is correct.

### 2.7 What is not there

- **No automated external reminder.** §2.5.
- **No recipient-scoped anything.** `HoldPointReleaseToken` has exactly one secondary index, `@@index([batchId])` (`schema.prisma:826`) — no index on `recipientEmail`, and none on `holdPointId` despite `deleteMany({ where: { holdPointId, usedAt: null } })` running on every release request (`requestReleaseRoutes.ts:393-398`, `:865-870`).
- **No dedicated rate limit on the public token routes.** Only the global per-IP limiter: `app.use(rateLimiter)` at `server.ts:114`, 60-second window, `API_RATE_LIMIT_MAX` default **1000** (`rateLimiter.ts:47-48`). Narrow limiters exist for auth (`server.ts:139`), support (`:162`), chat and telemetry — none is applied at `server.ts:157`. **No test asserts a rate limit on these routes.**
- **No explicit revocation endpoint.** Revocation is implicit: re-requesting deletes unused tokens (`requestReleaseRoutes.ts:393-398`, `:865-870`), chasing supersedes them (`actionRoutes.ts:129-145`), retention purges expired ones (`dataRetention.ts:43-53`).
- **The N-fold notification volley is STILL OPEN**, in code, with a comment naming itself. `publicBatchRoutes.ts:398-415`: *"ponytail: still N calls, so the N-fold duplicate notification/email volley is unchanged. That is a pre-existing defect with its own fix (spec §11 F0.4b PR 4 explicitly scopes it out)."* Each `runHoldPointReleasePostCommit` independently loads every active project user (`publicReleaseExecution.ts:289-299`) and fans out in-app notifications and emails (`:314-316`, `:334-340`). Releasing N hold points in one signed click therefore produces **N notifications and N emails per project user**. No follow-up fix commit exists; no test pins either the current or the desired behaviour.
- **No email unsubscribe of any kind, and no preference row an external recipient could own.** `NotificationEmailPreference` is keyed on `userId` with a hard FK to `User` (`schema.prisma:283-309`); the chase email goes straight to `recipientEmail` with no preference check (`actionRoutes.ts:793-821`). `List-Unsubscribe`: **NOT FOUND**. `EmailOptions` has no `replyTo` field at all (`email.ts:51-58`), so every CIVOS email is effectively one-way from `noreply@civos.com.au` (`email.ts:73-77`).
- **No unit test for `PublicHoldPointReleasePage.tsx`** (the batch page has one, `PublicHoldPointBatchReleasePage.test.tsx`).

---

## 3. The finding this wave turns on — the dead status vocabulary `[E-B1]`

### 3.1 The evidence

Every production writer of `HoldPoint.status`, at this SHA:

| Value | Written by |
|---|---|
| `pending` | `schema.prisma:767` (`@default("pending")`) |
| `notified` | `requestReleaseRoutes.ts:349` (batch), `:823` (single) — and the route's own type literal at `:69` |
| `released` | `publicReleaseExecution.ts:124` (both public doors), `actionRoutes.ts:470` (authenticated door) |

`'requested'` appears on a hold point in exactly one place in the whole backend, and it is the demo-data seeder: `sampleProjectRoute.ts:197`, `status: released ? 'released' : 'requested'`. `'scheduled'` is never written to a hold point at all. `'completed'` — the second half of `holdPointTerminal` (`predicates.ts:86-88`) — is written only by the readiness characterization corpus (`seedCorpus.ts`), never by a route.

(The other `status: 'pending'` hits near the hold-point code are not hold points: `evidenceAttachments.ts:86` creates an `ITPCompletion`, and `readRoutes.ts:531` is a literal inside an evidence-package **preview** whose `id` is the string `'preview'`.)

### 3.2 The four definitions of "waiting", and which one is right

| # | Definition | Site | Verdict against §3.1 |
|---|---|---|---|
| 1 | `status ∈ ['requested','scheduled'] && scheduledDate < now − 1 d` | `systemAutomation.ts:279-283`; named `holdPointOverdue` + `OVERDUE_HOLD_POINT_STATUSES` at `predicates.ts:91`, `:105-112`; third copy at `systemAlertResolution.ts:32` | **Dead.** Matches nothing. The `stale_hold_point` alert has never fired on a real awaiting-release hold point, and its auto-resolver has never had anything to resolve. |
| 2 | `status ∈ ['pending','scheduled','requested'] && createdAt < now − 7 d` | `predicates.ts:115`, `:125-132`; bound at `statsRoute.ts:81-93`, `portfolio.ts:245`, `projectOverviewRoute.ts:132`, `roleDashboards.ts:378` | **Live but inverted.** `pending` matches, so the dashboards' "stagnant" count measures hold points **nobody has asked about yet** and structurally excludes every hold point actually waiting on a super. |
| 3 | `status === 'notified' && scheduledDate < today` | `holdPointTableUtils.ts:14-23` | **Correct.** The only correct definition in the codebase, and it is in the browser. |
| 4 | `status === 'notified' && notificationSentAt is ≥ N AEST calendar days old` | `holdPointTableUtils.ts:42-50` | **Correct**, and it is the "chase now" signal E2 wants. Also in the browser. |

`predicates.ts:1-20` states the library's own charter: it *"NAMES the existing behaviour, it does not unify it"*, and `:100-103` documents that definitions 1 and 2 diverge on all three axes. That was the right call when the library was written — naming a divergence is not the same as blessing it. §4.1 is the correction it was waiting for, and the correction is one status value, not a re-unification.

### 3.3 Why this is a Wave E blocker and not a Wave A bug

It could be filed as alert hygiene (program line 64, A2). It is not, because Wave E's entire first outcome is the awaiting-release signal, and building reminders on top of a predicate that matches nothing would produce a feature that passes every test and sends nothing in production. **`[E-B1]`: no Wave E phase may introduce a fifth definition of "awaiting release". E1 lands one shared predicate and every consumer reads it.**

---

## 4. The design

### 4.1 Phase E1 — the signal that fires (S, no migration)

**One predicate.** Add to `backend/src/lib/readiness/predicates.ts`, beside its siblings and documented the same way:

- `AWAITING_RELEASE_HOLD_POINT_STATUSES = ['notified'] as const` — the status the request paths actually write (`requestReleaseRoutes.ts:349`, `:823`).
- `holdPointAwaitingRelease(hp)` — `status ∈ AWAITING_RELEASE_HOLD_POINT_STATUSES`.
- `holdPointReleaseOverdue(hp, now)` — awaiting release **and** `scheduledDate` present **and** `scheduledDate < now − 1 day`. Same shape and same one-day threshold as the definition it replaces (`predicates.ts:105-112`), so the only thing that changes is which rows match.

**Three consumers repointed, and no more:**

1. `systemAutomation.ts:281` — the scan's status filter becomes `{ in: [...AWAITING_RELEASE_HOLD_POINT_STATUSES] }`, imported, not re-typed. The threshold arithmetic at `:277` and the severity ladder at `:309-313` are untouched.
2. `systemAlertResolution.ts:32` — its local `STALE_HOLD_POINT_STATUSES` is deleted and the shared constant imported, so the resolver and the creator can never disagree again.
3. `predicates.ts` — `OVERDUE_HOLD_POINT_STATUSES` / `holdPointOverdue` are **kept and marked dead** with a comment pointing at §3, not deleted. They have no production consumer beyond the two sites above once repointed, and deleting an exported predicate in the same PR that changes alert behaviour mixes two risks.

**Deliberately NOT repointed in E1:** the dashboards' `STAGNANT_HOLD_POINT_STATUSES` (definition 2). It is wrong, but it is a *counting* change on five surfaces (`statsRoute.ts`, `portfolio.ts`, `projectOverviewRoute.ts`, `roleDashboards.ts`, `operationalRoutes.ts:305`) with no bearing on reminders. Recorded as `[E-c]` in §14.2 with a flip condition, not smuggled into an alert PR.

**The storm control — this is the part that must not be skipped.** E1 makes a previously-empty scan match every historic `notified` hold point whose `scheduledDate` passed more than a day ago. The scan creates one `NotificationAlert` per hold point (`systemAutomation.ts:291-297` dedupe, partial unique index `notification_alerts_active_type_entity_key WHERE resolved_at IS NULL`, `schema.prisma:353-356`) and notifies five roles (`notificationAlertConfig.ts:16-24`). Program line 64's rule applies verbatim: bounded, never a raw uncap.

E1 therefore ships with **both** of:

- a **creation bound per pass** — an explicit `take` on the stale scan and a per-project cap on alerts created in one pass, with the deferred count logged exactly as the escalation engine already does (`alertEscalations.ts:273-276`, `:295-307`). The scan is currently an unbounded `findMany` with no `take` (`systemAutomation.ts:278-288`); adding the bound is a precondition of turning it on, not a follow-up;
- a **horizon**: only hold points whose `scheduledDate` is within the last N days are eligible (N = 30, a constant, one place). A hold point notified in March does not generate a March alert in July. This is what stops the backlog detonating, and it is why E1 is safe to ship before E2.

**Independently shippable, and worth shipping alone:** after E1, a quality manager gets an in-app alert and an email when an external release goes past its scheduled date — via the shipped alert engine, the shipped escalation ladder (4 h / 8 h, `notificationAlertConfig.ts:38-42`) and the shipped `holdPointReminder` preference key (`notificationAlertConfig.ts:63-65`). No external email has changed yet.

### 4.2 Phase E2 — the reminder that sends itself (S, one migration)

**A fifth job in the existing hourly pass**, registered beside the four at `notificationAutomation.ts:413-418`, inside the same advisory lock. Not a new worker, not a new interval, not a new lock.

**Selection.** Hold points that are `holdPointAwaitingRelease`, whose notice window has elapsed — the backend equivalent of `isNoticeExpired` (`holdPointTableUtils.ts:42-50`): `notificationSentAt` at least `minimumNoticeDays` AEST calendar days old, reading the same per-project setting the request path enforces (`validation.ts:82`) — and where `chaseCount < 3` and `lastChasedAt` is null or older than 24 h. Same horizon constant as E1.

**Every one of those counters already exists.** `chaseCount` and `lastChasedAt` (`schema.prisma:779-780`) are the reminder state, they are already written by the manual chase (`actionRoutes.ts:750-756`), and they are already displayed. **No reminder-state migration.**

**The send path is the shipped one.** The job calls the same recipient resolution, token minting, supersession and `sendHPChaseEmail` sequence the manual chase uses (`actionRoutes.ts:759-822`), extracted into one exported function that both the route and the job call. The route's behaviour must not change: the extraction is a move, characterization-tested (AT-100).

**The recipient fix — the root cause, in the shared resolver.** `loadHoldPointChaseTargets` (`actionRoutes.ts:200-220`) gains one middle tier:

1. live unused tokens for this hold point → the external recipients (unchanged, `:204-217`);
2. **else** parse `HoldPoint.notificationSentTo` with the existing `parseNotificationEmailList` (`requestReleaseRoutes.ts:568`) and mint fresh tokens for those addresses — the durable record of who was actually asked, which survives the retention purge (§2.4);
3. else project users (unchanged, `:219`).

This is a root-cause fix in the one function both callers route through, and it repairs the manual chase's silent recipient swap at the same time. `notificationSentTo` stores emails only, so tier 2 recipients get the existing `'Superintendent'` name fallback (`chaseNotifications.ts:74`) — which also means the token-bound identity override (`holdpoints.ts:176-177`) does not apply to a tier-2 link and the recipient types their own name. That is honest and it is stated in §7.6, not hidden.

**The migration — one, and it is an index, not a column.** `HoldPointReleaseToken` gains `@@index([holdPointId])`. It is missing today (`schema.prisma:826` has only `@@index([batchId])`) while `deleteMany({ where: { holdPointId, usedAt: null } })` runs on every release request and every chase (`requestReleaseRoutes.ts:393-398`, `:865-870`, `actionRoutes.ts:137-144`, `:155-162`). E2 turns those from user-triggered to hourly-and-automatic across every project, which is what makes an existing gap load-bearing. Reviewed Prisma migration, additive, index-only, zero backfill, no data movement, applied per Wave 0 change management (program line 56).

**The reachable human, instead of an unsubscribe store.** Automated mail to a non-user from `noreply@` with no reply path is how a domain earns a spam reputation, and the whole passwordless channel depends on CIVOS mail arriving. The cheap control: add `replyTo?: string` to `EmailOptions` (`email.ts:51-58`) and pass it through to Resend (`email.ts:173-181`) — Resend accepts it, the interface does not have it today — and set it on hold-point release and chase mail to the requesting user's email (already loaded: `requestReleaseRoutes.ts:766` uses that user for `requestedBy`). Three lines of plumbing, one field per call site. A super who wants it to stop hits Reply and reaches the person who asked. **No suppression table** — the hard cap of 3 is the systemic control, and §14.1 J2 asks Jay whether that is enough.

**Explicitly not in E2:** no reminder to internal staff (that is E1's alert), no escalation to a second external contact, no SMS, no reminder after release, no reminder for a hold point with no `scheduledDate`, and no change to the reminder email's content beyond `replyTo`.

### 4.3 Phase E3 — the link opens the queue (S/M, no migration)

**The rule, before the mechanism.** The queue is a **view over capabilities the recipient already holds**. It never creates one. Concretely, opening any live link for recipient R on project P lists the hold points for which R currently holds a token that is unspent, unexpired and attached to a non-terminal hold point on P — and releasing item X consumes **X's own token row**, re-validated server-side by the shipped in-transaction guard (`publicReleaseExecution.ts:76-89`). If X's link expired, was superseded by a chase or was revoked by a re-request, X is not in the queue and cannot be released from it. Nothing about the token lifetime, the 48-hour expiry, the claim predicate or the audit shape changes.

**Why that phrasing matters:** the naive version — "one link, everything pending" — silently upgrades a 48-hour single-purpose bearer token into a standing project-wide approval capability, which is precisely what program §7 line 135 forbids (*"public-link scope/expiry/revocation/replay protection; recipient-scoped external queues"*). The capability-view rule is the difference, and it is `[E-B2]` in §6.

**The mechanism, reusing what ships.** `HoldPointReleaseBatch` is already "one recipient, one ask, N hold points, durable" (`schema.prisma:833-851`) and the batch page already renders exactly the required interaction: a list, per-row lazy evidence loading, multi-select, and one signed release across the selection (`PublicHoldPointBatchReleasePage.tsx:266-303`, `BatchHoldPointRow.tsx:62-98`, `BatchReleaseIdentityPanel.tsx`). E3 therefore:

1. **Widens membership only.** `loadPublicHoldPointReleaseBatch` (`publicBatchRoutes.ts:64-71`) keeps resolving the presented batch token; the hold-point list it returns becomes the union described above, computed with one query keyed on `recipientEmail` (from the batch row, never from input) scoped to the batch's project. Items from the presented batch keep their existing position; items from other asks are visually grouped as "also waiting on you", with their own lot number, because a super needs to know which lot they are signing.
2. **Keeps release per-item-token.** `loadBatchScopedHoldPointReleaseToken` (`publicReleasePayload.ts:84-92`) is joined by a sibling that resolves a hold point's live token for **this recipient on this project** rather than `{batchId, holdPointId}`. Same guarded claim, same 410s, same one-audit-row-per-signature grain (`publicBatchRoutes.ts:232-233`).
3. **Sends the single-link holder to the same place.** A `/hp-release/:token` link whose recipient has other live items shows "you have N more waiting" with a link that resolves through that token — not a redirect to a different token, and not a second capability.

**Two hard prerequisites, both outside E3's own diff:**

- **The N-fold volley must be fixed first** (§2.7). E3 exists to make multi-item release the normal case; on today's code a super releasing six items sends six in-app notifications and six emails to every active project user. Fixing it inside E3 would hide a notification behaviour change inside a scoping PR — the exact objection `publicBatchRoutes.ts:400-405` already records. It ships as its own PR, before E3 merges, following the C2 precedent for the reject-notification lie (`wave-c2-test-lifecycle-spec-2026-07-28.md:653`).
- **A rate limit on the public token routes** (§7.3). E3 is the first change that makes one bearer token worth more than one hold point.

**Also in E3, because it is the same review surface — the two disclosures that should not be there:**

- `notificationSentTo` is returned on the public payload (`publicReleasePayload.ts:137`) and printed in the PDF as *"Recipient of Record"* (`holdPointEvidencePdf.ts:44-46`). It is the comma-joined list of **every** address the request went to, handed to any holder of any one of those links. Replace it with the presented token's own recipient — the page already has that identity, so nothing user-visible is lost and one address stops being three.
- `tokenInfo.recipientEmail` (`publicReleasePayload.ts:149`) is echoed to whoever holds the link. The page's "assigned to" hint uses `recipientName`, not the email (`holdpoints.spec.ts:832`), and no frontend site reads `recipientEmail` from this payload. Cut it from the response.

### 4.4 What does not change, in any phase

`recordDecision` and its transaction, isolation level, retry and conflict contract. The token hash scheme, the 48-hour constant, and the `CHECK` constraints. The guarded claim predicate and the 410 `TOKEN_USED` / `TOKEN_EXPIRED` responses. The requirement for a signature. Read-after-spend on the GET (`publicReleasePayload.ts:94-108` deliberately checks expiry and not `usedAt`; `holdpoints.test.ts:3390` pins it). The audit `/token/i` redaction traps and the deliberate naming of `tokenRecipient` / `releaseLinkIds` (`publicReleaseExecution.ts:215-226`, `publicBatchRoutes.ts:346-350`). Data retention windows. Any authenticated route.

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

**E3 note, decided rather than deferred:** the queue query keys on `HoldPointReleaseBatch.recipientEmail`, and that table has only `@@index([lotId])` (`schema.prisma:849`). E3 adds `@@index([recipientEmail])` **only if** §10's measurement on the reference dataset shows it is needed; a batch table with tens of thousands of rows and a query already narrowed by project may not need it, and an index nobody measured is an index nobody can remove. The measurement is an exit-gate item, not an assumption.

### 5.1 The four columns this wave was expected to add, and did not

| Expected | Why not |
|---|---|
| `HoldPoint.dueAt` | `scheduledDate` (`schema.prisma:770`) is already the date the decision is needed by, is already indexed with status (`:799`), is already what both correct frontend predicates read, and is already what the request modals collect. A second date column would immediately raise "which one is the real one" on every screen and every export. *Flip:* a pack or a contract requires a response deadline that differs from the inspection date. |
| `HoldPoint.reminderCount` / `lastRemindedAt` | `chaseCount` / `lastChasedAt` are exactly these, already written by the manual chase, already displayed. A reminder is a chase CIVOS sent on your behalf, and counting them separately would make "how many times have we asked?" ambiguous. |
| A recipient-suppression table | §4.2. The cap is the control; the reply path is the escape hatch. *Flip:* J2. |
| A durable "approval request" entity | The ask is already recorded three ways (§2.4), and readiness in this program is **computed, never a stored flag** (program line 32). "Still outstanding" is derivable from `HoldPoint.status` in one join; storing it would create a value that can go stale exactly when it matters. |

---

## 6. Invariants Wave E must not break

| Tag | Invariant | Asserted by |
|---|---|---|
| `[E-B1]` | **No fifth definition of "awaiting release".** One predicate in `predicates.ts`; the alert creator, the alert resolver and the reminder job all import it. | AT-98, AT-99 |
| `[E-B2]` | **The queue grants no capability the recipient does not already hold.** Membership is the set of live tokens for that recipient; every release consumes that item's own token row through the shipped guarded claim. | AT-105, AT-106 |
| `[E-B3]` | **The recipient is always derived from the presented token, never from input.** No route in Wave E accepts an email, a recipient id or a project id from the client on a public surface. | AT-107 |
| `[E-B4]` | **One signature = one decision = one audit row + N hold-point snapshots.** The grain established at `publicBatchRoutes.ts:232-233` survives the widened queue. | AT-108 |
| `[E-B5]` | **No reminder ever fires for a released or terminal hold point, and never more than 3 times per hold point.** | AT-101, AT-102 |
| `[E-B6]` | **`git diff` for the whole wave touches none of** `recordDecision.ts`, `publicReleaseExecution.ts`'s claim predicate, `tokens.ts`, `dataRetention.ts`, or any migration that drops or alters an existing column. | Mechanical check, exit item 9 |
| `[E-B7]` | **Token redaction survives.** Every new or changed public path shape is added to `logSanitization.ts` (`:58-60`, `:94-95`) and asserted, and no new audit key that could carry a recipient email escapes the `/token/i` trap (`auditLog.ts:20`). | AT-109 |

---

## 7. Security, tenancy and privacy — the public-link surface is the whole risk

### 7.1 The threat-model gate — **E.0, BLOCKING, ships before any Wave E code**

Program §7 line 134 requires *"threat model as a gated artifact before A3, C2, D2, **E**"*. **NOT FOUND:** any threat-model artifact under `docs/` at this SHA — the only files mentioning the phrase are four plan documents deferring it (`d14-q6-pack-spec-2026-07-27.md`, `wave-b-migration-importer-spec-2026-07-26.md`, `wave-c2-test-lifecycle-spec-2026-07-28.md`, `wave-c3-spatial-tests-lims-spec-2026-07-28.md`).

C2 satisfied the gate **by scope** because it built no external link and said so explicitly, while recording that the artifact becomes *"a hard precondition — a PR, not a paragraph"* the moment one is built (`wave-c2-test-lifecycle-spec-2026-07-28.md:530-532`). **Wave E is that moment**, and no scope reduction inside Wave E can avoid it: the public link is the wave.

**E.0 is a docs-only PR, merged before E1**, in the shape of C3.0 (`wave-c3-spatial-tests-lims-spec-2026-07-28.md:71-82`): a self-contained artifact at `docs/plans/wave-e-threat-model-2026-07-XX.md`, cited at a stated SHA, with a verdict per item. It is a blocking pre-build item, listed as exit item 1. **It must cover, at minimum:**

1. **The capability model, before and after E3.** What exactly one token grants today (one hold point, or one lot's batch), what E3 makes it grant, and the written argument that the union is a view over existing capabilities and not an escalation (`[E-B2]`).
2. **Enumeration.** Token entropy (256 bits, `requestReleaseRoutes.ts:203`) versus the **only** limit that applies today: 1000 requests/minute/IP, global (`rateLimiter.ts:47-48`, `server.ts:114`), with **no test asserting any limit on these routes**. Must specify the limiter to add (§7.3) and must decide the **response oracle**: an unknown token returns 404 `Invalid or expired link` (`publicReleasePayload.ts:97-99`) while a known-but-expired token returns 410 `TOKEN_EXPIRED` (`:101-107`) — a distinguishable existence signal. Practically worthless against 2²⁵⁶, but it is a decision that must be *recorded as taken*, not discovered.
3. **Expiry, revocation and replay.** The 48-hour constant (`tokens.ts:17`); the three implicit revocation paths (§2.7) and the absence of an explicit one; the guarded claim as the replay defence (`publicReleaseExecution.ts:76-89`) and the tests that prove it (`holdPointReleaseDecision.db.test.ts:532-549`, `holdPointBatchReleaseDecision.db.test.ts:475-504`); what E3 changes about each. Must answer: **should there be an explicit revoke, and what happens to a queue when one member is revoked mid-session?**
4. **The disclosure inventory — the full field list, decided item by item.** Everything a bearer reaches today: `notificationSentTo`, i.e. every other recipient's email (`publicReleasePayload.ts:137`, rendered `holdPointEvidencePdf.ts:44-46`); `tokenInfo.recipientEmail` (`:149`); `project.company { name, abn, address, logoUrl }` with the logo embedded as a data URL (`evidencePackage.ts:277-291`); the full names of every internal staff member who completed or verified each checklist item (`evidencePackage.ts:137-171`); laboratory names and report numbers (`:173-195`); raw `project.id` and `lot.id` UUIDs; and on the batch summary, the requesting staff member's full name **falling back to their email address** (`publicBatchRoutes.ts:104-109`, `:142`). §4.3 cuts two of these; the artifact must rule on **all** of them, and note that **no current test asserts any of them is absent** — the existing tests assert they are *present*.
5. **Post-spend and post-decision read.** The GET stays readable after `usedAt` by design (`publicReleasePayload.ts:94-108`, pinned `holdpoints.test.ts:3390`). For how long should a spent link keep rendering a full evidence package, and does a released item stay visible in the queue?
6. **Email as the trust boundary.** Forwarded links, shared `info@` inboxes, mail-client link prefetching (a scanner that follows a link performs a GET — harmless today because release is a POST; the artifact must confirm no Wave E change makes any GET a mutation). What identity CIVOS actually captures, and §7.6's claim limit.
7. **Automated mail to a non-user.** Cadence, the hard cap of 3, the absence of any unsubscribe or `List-Unsubscribe` header (**NOT FOUND**, §2.7), the `replyTo` mitigation, domain-reputation risk to the entire passwordless channel, and a stated position on the Spam Act 2003 (Cth) transactional-versus-commercial question — **as a position to check with counsel, not as legal advice**.
8. **Tenancy on the new query surface.** The queue keys on `recipientEmail` from the token; must confirm the project scope (§7.2), and that no Wave E query can return a hold point from a project the presented token does not belong to. Program §7 line 135 requires tenant-isolation tests on every new query surface.
9. **Logging and redaction.** `[E-B7]`: the existing path traps (`logSanitization.ts:58-60`, `:94-95`) and audit-key trap (`auditLog.ts:20`) must be extended to any new shape, and the artifact must restate the naming hazard recorded at `publicReleaseExecution.ts:215-226` — renaming `tokenRecipient` to anything without "token" in it would silently start persisting recipient emails to the audit log.
10. **Blast radius.** One sentence per phase: what the worst outcome of one leaked link is before E3 and after E3, and whether the delta is accepted.

### 7.2 Tenancy and the scope of "recipient-scoped"

The queue is scoped by **(recipient email from the presented token) × (the presented token's project) × (live token) × (non-terminal hold point)**. Four predicates, all server-side, none client-supplied.

**Per project, not cross project.** A super's authority is contract-bound; the same person may superintend for two principals whose head contractors both use CIVOS. Unioning across projects would join two clients' work under one bearer token and would breach *"never general project visibility"* in spirit even while satisfying it literally. Per-project still delivers the whole win — the multi-lot super, which is the actual complaint.

Every hold point in a project belongs to a lot in that project (`schema.prisma:764`, `HoldPoint.lotId`), and the batch carries `lotId` (`:835`), so the project is derivable from the token without trusting anything. `[E-B3]` requires it be derived, and AT-107 asserts a crafted request cannot widen it.

### 7.3 Rate limits — what must exist before E3

Today: global only, 1000/min/IP (`rateLimiter.ts:47-48`), and nothing narrower at `server.ts:157`. The codebase already has the pattern for a narrow limiter — `authRateLimiter` (`server.ts:139`), `supportRateLimiter` (`:162`), and `consumeRateLimit(bucket, key, window, max)` (`rateLimiter.ts:229`) takes an arbitrary bucket and key. A public hold-point limiter is therefore ~10 lines beside its four siblings, not a new subsystem.

Two dimensions, both decided in E.0 and implemented with E3:
- **Per IP on `/api/holdpoints/public/*`** — an order of magnitude below the global limit. This is the enumeration control.
- **Per token on the release POSTs** — a small number per token per minute. This is the abuse control for a leaked link, and it is cheap because the token hash is already computed on the way in.

The limiter must key on the **hashed** token, never the raw one, so no limiter store holds a usable capability.

### 7.4 What the link must never reveal

Restated as a rule the reviewer can apply to any future change, not as a list that ages:

> A hold-point release link may reveal the evidence for the hold points its recipient has been asked to decide, plus the minimum context needed to know what is being signed (project name and number, lot number and activity, scheduled date, expiry, who asked). It may not reveal **any other person's contact details**, **any address the request was also sent to**, **any internal identifier that is not needed to render the page**, or **anything about a lot or hold point the recipient has not been asked about**.

Measured against that rule at this SHA, §7.1 item 4 lists the current exceptions. Two are cut in E3; the rest are E.0's call.

### 7.5 Data sensitivity

The wave adds no new personal-data field and no new external egress destination. It does *increase the rate* at which one existing category — an external individual's email address — is used, by automating mail to it. `recipientEmail` remains protected from the audit log by the `/token/i` trap (`auditLog.ts:20`, `publicReleaseExecution.ts:215-226`) and from request logs by the path traps (`logSanitization.ts:58-60`). No Wave E change may weaken either; `[E-B7]`.

### 7.6 Identity and the Electronic Transactions Act — the claim, and its limit

The program's research register records, verbatim (`CIVOS-Research-Appendix-2026-07-24.md:66`):

> *Electronic Transactions Act 1999 (Cth) + state mirrors: e-approvals valid if identity + intent + reliability* — sources: `https://www.ag.gov.au/legal-system/electronic-signatures-documents-and-transactions` (grade **A**) and `https://kreisson.com.au/esignatures/` (secondary, grade **C**); decision supported: *"Link approvals are defensible with identity capture + immutable history"*; caveat: ***"Some head contracts still mandate wet-ink — contract check per pilot; this register is not legal advice."***

That row is reproduced here and **nothing is added to it**. In particular this spec does not claim that CIVOS releases are legally binding, does not claim compliance with any state mirror, and does not restate the caveat in weaker words.

What CIVOS actually records at the moment of an external release, all inside one serializable transaction (§2.2): the token row as actor, the recipient name the site team addressed the link to, the name the person typed, their organisation, a hand-drawn signature, the IP address, the user agent, the timestamp, the hold point's readiness snapshot, and a `HP_PUBLIC_RELEASED` audit row that no later edit rewrites.

What it does **not** prove, and what §7.1 item 6 must state in the same words that program §7 line 135 uses: *"possession of an emailed link does not by itself prove who made a contractual decision."* A forwarded link signed by a colleague produces a record that is complete, immutable and attributed to the wrong human. Wave E's honest position is therefore: **CIVOS records strong, tamper-evident evidence of a decision made through a link addressed to a named person; it does not verify that person's identity, and any contract requiring stronger assurance needs a control CIVOS does not ship.** Tier-2 chase links (§4.2) are weaker still, because they carry no `recipientName` and so no identity override — the artifact must say so.

Program line 17's own instruction stands: *"validate the strength of this with CIVOS design partners"*. Wave E does not close that question; it makes it askable with something real to show.

---

## 8. API and UI surface

### 8.1 Backend

| Phase | Change | File |
|---|---|---|
| E1 | New shared predicate + status constant | `lib/readiness/predicates.ts` |
| E1 | Status filter repointed; per-pass creation bound; horizon | `lib/notificationAutomation/systemAutomation.ts:277-288` |
| E1 | Local status list deleted, shared constant imported | `lib/notificationAutomation/systemAlertResolution.ts:32` |
| E2 | Chase send sequence extracted to one exported function; route and job both call it | `routes/holdpoints/actionRoutes.ts:759-822` |
| E2 | Middle tier added to the shared recipient resolver | `routes/holdpoints/actionRoutes.ts:200-220` |
| E2 | Fifth job registered in the existing hourly pass | `lib/notificationAutomation/notificationAutomation.ts:413-418` |
| E2 | `replyTo` added to `EmailOptions` and passed to Resend | `lib/email.ts:51-58`, `:173-181` |
| E3 | Batch summary membership widened; per-recipient live-token resolver added beside the batch-scoped one | `routes/holdpoints/publicBatchRoutes.ts:64-71`, `publicReleasePayload.ts:84-92` |
| E3 | `notificationSentTo` narrowed to the presented recipient; `tokenInfo.recipientEmail` removed | `publicReleasePayload.ts:137`, `:149` |
| E3 | Public-route rate limiter | `middleware/rateLimiter.ts`, `server.ts:157` |

**No new route path in any phase.** No authenticated route changes except the chase route's internals, which must be behaviour-identical (AT-100).

### 8.2 Frontend

| Phase | Change |
|---|---|
| E1 | None. |
| E2 | None. |
| E3 | `PublicHoldPointBatchReleasePage.tsx` renders the widened list with lot numbers per row and an "also waiting on you" grouping; `PublicHoldPointReleasePage.tsx` gains a "you have N more waiting" affordance; `holdPointEvidencePdf.ts:44-46` prints the presented recipient instead of the full list. |

`PublicHoldPointReleasePage.tsx` has **no unit test** today (§2.7). E3 adds one — the smallest that fails if the queue affordance or the recipient narrowing breaks. Existing E2E coverage stays green unchanged: `holdpoints.spec.ts:796-940` (six scenarios) and `productionReadiness.spec.ts:987-1004` (the source-text check that the emailed URL matches a real route).

### 8.3 Permission matrix

| Action | Who | Enforced by |
|---|---|---|
| Request a release (issue links) | `HP_REQUEST_ROLES`, project writable | `requestReleaseRoutes.ts:600-606`, `:324`, `:738` |
| Chase manually | `HP_REQUEST_ROLES`, project writable, not released | `actionRoutes.ts:741-748` |
| Reminder sent automatically | **no user** — actor is the automation worker; no permission check, because it sends only to recipients an authorised user already chose | §4.2 |
| Open a queue / read evidence | anyone holding a live token; scope per §7.2 | `publicBatchRoutes.ts:64-87`, `publicReleasePayload.ts:94-108` |
| Release from the queue | the holder of that item's own live token | `publicReleaseExecution.ts:76-89` |
| Receive the internal stale alert | `STALE_HOLD_POINT_ALERT_ROLES` (5 roles) | `notificationAlertConfig.ts:16-24` |

---

## 9. Phases and PR slicing

Each phase is independently shippable and independently valuable. No phase depends on a later one.

**E.0 — Threat model artifact (docs only). BLOCKING.** §7.1. Merges before E1. No code.

**E1 — The signal that fires (S, no migration).** §4.1. Predicate, three consumers, creation bound, horizon. **Exit:** AT-98, AT-99, AT-103. **Ships alone:** internal alerts and escalation for overdue external releases start working for the first time.

**E2 — The reminder that sends itself (S, one index migration).** §4.2. Chase extraction, recipient-resolver middle tier, hourly job, cap, `replyTo`. **Depends on E1** (uses its predicate). **Exit:** AT-100, AT-101, AT-102, AT-110. **Ships alone:** supers get chased automatically, and the manual chase stops silently swapping recipients.

**Between E2 and E3, outside Wave E's diff:** the **N-fold notification volley fix** (§2.7, `publicBatchRoutes.ts:398-415`), as its own PR with its own gate, following the C2 reject-notification precedent. E3 must not merge before it.

**E3 — The link opens the queue (S/M, no migration).** §4.3. Widened membership, per-item token release, two disclosure cuts, public rate limiter, one new frontend test. **Depends on** E.0, the volley fix, and §10's measurement. **Exit:** AT-104 … AT-109, AT-111.

**Deliberately outside Wave E:** E2 release-package assembly (§1.2); the dashboards' stagnant-count correction (`[E-c]`); an attendance-required flag; any reject flow; any account, delegation or portal.

---

## 10. Scale and performance

Measured against the program's reference dataset (§8 line 138: 5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers), with percentile, device and network stated per program line 137.

| Target | Why |
|---|---|
| **E1's stale scan is bounded and its per-pass cost is stated in the PR body**, measured on the reference dataset, with the deferred-count log line shown. | It is currently an unbounded `findMany` with no `take` (`systemAutomation.ts:278-288`) that has never matched a row. §4.1. |
| **E2's job adds no more than a constant number of queries per pass plus one per eligible hold point**, and the whole hourly pass still completes inside the advisory-lock transaction's 30-minute timeout (`runner.ts:73-93`). | The pass holds a single global lock; a slow new job blocks diary reminders, docket alerts and escalations. |
| **E3's queue query is one query, indexed, p95 < 200 ms server-side** on the reference dataset for a recipient with 50 outstanding items. | It runs on an unauthenticated route with no session cost to amortise. |
| **The queue is capped at a stated maximum item count** with an honest "showing the N oldest" line, reusing the existing `MAX_BATCH_RELEASE_ITEMS = 25` release cap (`validation.ts:270`) rather than inventing a second number. | An unbounded public list is both a performance and a disclosure surface. |
| **`HoldPointReleaseBatch.recipientEmail` index: measured, then added or not.** | §5. |

---

## 11. Rollback and recovery

| Phase | Rollback | Recovery from a bad outcome |
|---|---|---|
| E1 | Revert the PR. The predicate is additive; the two repointed filters return to their dead values and the scan stops matching. | If alerts still storm despite bound + horizon, the automation worker has an env kill switch: `NOTIFICATION_AUTOMATION_WORKER_ENABLED` (`runner.ts:106-116`). Alerts created in error are resolvable by the existing auto-resolver once the condition clears (`systemAlertResolution.ts:80-95`) and by the existing bulk paths. |
| E2 | Revert the PR; the index migration stays (dropping an index is never a rollback requirement). Reminders stop; the manual chase returns to its previous — defective — recipient behaviour. | The kill switch above stops all reminder mail within one hour. Mail already sent cannot be recalled; the cap of 3 is what bounds the worst case, which is why it is `[E-B5]` and not a setting. |
| E3 | Revert the PR. Links return to single-ask membership; no data was written differently, because E3 writes no new data. | A leaked link's blast radius returns to pre-E3 immediately on revert. Individual tokens can still be revoked the shipped way — re-request or chase (§2.7). |

No phase writes a column that a rollback would strand. No phase changes an existing column's meaning. The single migration is additive and reversible without data loss.

---

## 12. Acceptance tests

Continuing the shared series; AT-97 was C3's last (`wave-c3-spatial-tests-lims-spec-2026-07-28.md:618`).

| # | Phase | Assertion | Kind |
|---|---|---|---|
| **AT-98** | E1 | **The signal matches what the code writes.** A hold point put into the awaiting state by the real `request-release` route (not a fixture literal) is matched by `holdPointAwaitingRelease`, and the alert scan creates a `stale_hold_point` alert for it once its `scheduledDate` is more than a day past. This is the test that would have caught `[E-B1]`. | DB-backed |
| **AT-99** | E1 | **Creator and resolver agree.** The alert scan and `systemAlertResolution` read the same exported constant; when the hold point is released the alert auto-resolves in the next pass. A grep assertion pins that no second status list exists in either file. | DB-backed + grep |
| **AT-103** | E1 | **The backlog does not detonate.** With more eligible hold points than the per-pass bound, one pass creates exactly the bound, logs the deferred count, and the next pass continues — no duplicates (partial unique index) and no unbounded fan-out. Hold points outside the horizon are never eligible. | DB-backed |
| **AT-100** | E2 | **The chase extraction changed nothing.** Characterization: `POST /:id/chase` produces the identical emails, identical token minting/supersession, identical `chaseCount`/`lastChasedAt` writes and the identical `HP_CHASED` audit row before and after the extraction. | route test |
| **AT-101** | E2 | **The reminder reaches the person who was asked, after the tokens are gone.** Awaiting-release hold point, notice elapsed, **all tokens deleted by the retention sweep**: the job emails the address in `notificationSentTo`, mints a fresh token for it, and does **not** fall through to project users. The pre-fix behaviour is asserted to be the fall-through, so the test fails if the middle tier is removed. | DB-backed |
| **AT-102** | E2 | **The cap and the guards hold.** No fourth reminder after three; none within 24 h of the last; none for a released or terminal hold point; none where `scheduledDate` is null; none inside the notice window (per-project `minimumNoticeDays`, AEST calendar days). | DB-backed |
| **AT-110** | E2 | **`replyTo` reaches the provider** and is the requesting user's address on release and chase mail. | unit |
| **AT-104** | E3 | **The ETA evidence is intact and pinned.** A public release through the queue still writes one audit row carrying the external-token actor, the token-bound recipient name, the IP address and the user agent, with the signature stored — and never the recipient's email. | DB-backed |
| **AT-105** | E3 | **The queue grants nothing new** `[E-B2]`. A recipient holding live tokens for A and B and an **expired** token for C sees A and B only; a crafted release naming C returns the shipped 410 and C's hold point is untouched. | route test |
| **AT-106** | E3 | **Release consumes the item's own token.** Releasing B from A's link burns B's token row exactly once, leaves A's unspent, and produces one audit row. Concurrent double-release of B yields one 200 and one of 400/409/410. | DB-backed |
| **AT-107** | E3 | **Recipient and project come from the token** `[E-B3]`. A request carrying an email, a recipient id or a project id as a parameter cannot widen the queue by one row; a token for project P never returns a hold point from project Q. | route test |
| **AT-108** | E3 | **One signature, one audit row, N snapshots** `[E-B4]`, across a queue spanning more than one lot. | DB-backed |
| **AT-109** | E3 | **Redaction survives** `[E-B7]`. Every new/changed public path is redacted in request logs and metric paths; no audit key added by this wave escapes the `/token/i` trap. | unit |
| **AT-111** | E3 | **The two disclosures are gone.** The public payload no longer contains any address other than the presented recipient's, `tokenInfo.recipientEmail` is absent, and the PDF's "Recipient of Record" is the presented recipient. Asserted as absence — the first negative-disclosure test these routes have. | route + unit |

---

## 13. Exit gate

1. **E.0 merged before any Wave E code**, covering all ten items in §7.1, with a verdict recorded per item. Stated in every subsequent Wave E PR body.
2. **`[E-B1]` proven, not asserted** — AT-98 green, and the PR body shows the before/after match count for the stale scan on a real project. *The alert fires* is the claim E1 lives or dies on.
3. **The storm did not happen** — AT-103 green, and the first 24 hours of production alert-creation counts are reported in the PR body, not assumed.
4. **A real hold point is chased automatically end to end**, on a real project, after its original link has expired and been purged, and the email lands with a working link and a `replyTo` that reaches the requester. Owner **Jay**.
5. **The N-fold volley PR is merged** before E3, with a test pinning single-volley behaviour — the defect at `publicBatchRoutes.ts:398-415` is closed, not re-scoped.
6. **A super with items on three lots opens one link and sees three**, releases two in one signature, and the third's link still works independently. Owner **Jay**.
7. **Tenancy and capability green** — AT-105, AT-106, AT-107 green, and the PR body states the blast-radius delta E3 introduces and that E.0 accepted it.
8. **The rate limiter exists and is tested** — the first test asserting any limit on `/api/holdpoints/public/*`.
9. **`[E-B6]` checked mechanically** — `git diff` across the wave touches none of the named files, and the PR body shows the check.
10. **§10 numbers measured, not estimated**, including the `recipientEmail` index decision.
11. **`npm run fallow:audit` verdict recorded in every PR body.**
12. **Docs and the Clancy knowledge mirror updated** with: the live hold-point status vocabulary, the automatic-reminder cadence and cap, and what the queue does and does not show.

**Not in this gate, deliberately:** anything about accounts, delegation, rejection or release-package assembly. Wave E turns none of those on, and an exit gate that mentioned them would imply it might.

---

## 14. Decisions

### 14.1 Jay's decisions — two, with recommendations

**J1 — Cross-project queue, or per-project?**
**Recommendation: per project.** *One-line why:* the same super can hold two different principals' contracts, and one bearer token should never span two clients' projects — per-project still fixes the multi-lot super, which is the actual complaint. *Flip:* a design partner's super says the project split is the annoying part, at which point it becomes a per-recipient union with a per-project heading and an explicit E.0 amendment.
**Does not block E1 or E2.**

**J2 — Is a hard cap of three reminders enough, or does an external recipient need a "stop" control?**
**Recommendation: cap only for v1, plus `replyTo` so a human is reachable.** *One-line why:* a suppression store is a table, a route, a UI and a new public-write surface built for a complaint nobody has made yet, while the cap plus a reply path bounds the real risk — CIVOS mail being marked as spam and the whole passwordless channel dying with it. *Flip:* one real recipient asks to stop, or one deliverability incident. Then it is a nullable `remindersStoppedAt` on a durable row plus one token-scoped POST — an S, specified then.
**Blocks nothing; decide before E2 ships.**

### 14.2 The spec's own decisions

- **`[E-a]` — `scheduledDate` is the due date; no new column.** §5.1. *Flip:* a contract or pack requires a response deadline distinct from the inspection date.
- **`[E-b]` — `chaseCount` / `lastChasedAt` are the reminder state.** A CIVOS-sent reminder is a chase; two counters for one concept would make "how many times have we asked?" unanswerable. *Flip:* a report needs to distinguish human chases from automatic ones — then it is a `chaseSource` enum, still not a second counter.
- **`[E-c]` — the dashboards' `STAGNANT_HOLD_POINT_STATUSES` stays wrong in Wave E.** §4.1. It counts un-requested hold points and excludes waiting ones, but correcting it changes five dashboard surfaces' numbers and belongs with A2 alert hygiene, not inside an alert-behaviour PR. *Flip:* Jay asks why the dashboard and the alerts disagree — then it is its own S with a before/after count diff.
- **`[E-d]` — the dead `holdPointOverdue` / `OVERDUE_HOLD_POINT_STATUSES` are marked, not deleted.** Deleting an exported predicate in the same PR that changes alert behaviour mixes two risks in one revert.
- **`[E-e]` — the queue reuses the batch page; no new route, no new page.** §4.3. *Flip:* none foreseen; a new public page would need its own E.0 section.
- **`[E-f]` — the volley fix ships outside Wave E.** Following C2's reject-notification precedent (`wave-c2-test-lifecycle-spec-2026-07-28.md:653`) and the objection the code itself already records.
- **`[E-g]` — `ponytail:` the machinery mostly exists.** Wave E is one status value, one middle tier in a resolver, one job in an existing pass, one index, one widened query and two deleted fields. The over-build available here — an approval-request entity, a due-date column, a reminder-state table, a suppression store, a recipient-preferences model, an external portal, an e-signature integration, a reject/comment thread — is roughly fifteen times the code for zero additional answered questions in v1, and at least three of those answers would be wrong (readiness stored as a flag, a second due date, a second reminder counter).
- **`[E-h]` — reminders are whole-day, not time-of-day.** `scheduledTime` is a free-text `String?` (`schema.prisma:771`); parsing it to remind "the morning before" would invent precision the column does not carry. *Flip:* `scheduledTime` becomes a real time.

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

- **Whether design partners' supers accept passwordless links at all** — program line 17's own instruction (*"validate the strength of this with CIVOS design partners"*). This wave makes the question askable; it does not answer it, and no wave may treat the answer as known.
- **Whether any head contract in a pilot mandates wet-ink** — appendix `:66` caveat. Per pilot, a contract check, not a research pass.
- **What a real superintendent does with three pending links today** — the assumption behind E3 is that four emails is the pain. It is a plausible inference from §2.3's mechanics, not an observed behaviour. Program line 69 (A6) requires observed, moderated sessions each major wave; E3's value should be one of the things watched.

---

## 16. Verification notes

Every `file:line` in this document was opened in this worktree at `a22d2026e2f8757ad58187e1c94207a37a78cb3a`. The three findings most likely to be doubted, and how each was established:

1. **`'requested'` and `'scheduled'` are never written to a hold point** (§3.1) — established by enumerating every `status: '<literal>'` assignment in `backend/src`, then reading each hold-point-adjacent hit to confirm what model it writes: `evidenceAttachments.ts:86` writes `ITPCompletion`, `readRoutes.ts:531` is an evidence-package **preview** literal whose `id` is `'preview'`, and `sampleProjectRoute.ts:197` is the demo-data seeder. The three live writers are `schema.prisma:767`, `requestReleaseRoutes.ts:349`/`:823` and `publicReleaseExecution.ts:124`/`actionRoutes.ts:470`.
2. **The N-fold volley is still open** (§2.7) — the `ponytail:` comment at `publicBatchRoutes.ts:398-415` names itself and cites `f0-execution-spec-2026-07-24.md:142`, which scopes it out. No follow-up fix commit and no test pinning either behaviour were found.
3. **IP and user agent are already on the public-release audit row** (§2.2) — `req` is passed at `holdpoints.ts:220` and `publicBatchRoutes.ts:355`, threaded through `recordDecision.ts:450` into `writeAuditLogInTransaction`, which sets `ipAddress` and `userAgent` at `auditLog.ts:78-79` against the columns at `schema.prisma:1698-1699`. This is why §1.2's ETA row says "already shipped" rather than "to build".

**NOT FOUND, stated so no one re-searches:** any threat-model artifact under `docs/`; any explicit token-revocation endpoint; any rate limit or rate-limit test specific to `/api/holdpoints/public/*`; any `List-Unsubscribe` header or email unsubscribe mechanism; any `replyTo` support in `EmailOptions`; any `dueDate`/`requiredDate`/`respondBy` column on the hold-point models; any cross-lot or recipient-scoped public query; any unit test for `PublicHoldPointReleasePage.tsx`; any test asserting the public payload does **not** disclose `notificationSentTo` or `recipientEmail`; and the phrase "N-1 invariant" anywhere in the repository — the nearest real invariant is *one signed release = one decision = one audit row + N hold-point snapshots* (`publicBatchRoutes.ts:232-233`).
