# Wave E.0 — Threat model: the gate before any Wave E code

**Date:** 28 July 2026 · **Status:** the blocking pre-build gate required by
`CIVOS-Validated-Buildout-Plan-2026-07-24.md` §7 line 134 (*"threat model as a
gated artifact before A3, C2, D2, **E**"*) and by
`docs/plans/wave-e-approvals-spec-2026-07-28.md` Rev 2 §7.1. **Docs only. No
Wave E code PR may merge until this artifact merges.**

**Every `file:line` in this document was opened in this worktree at HEAD
`415af44aab2ff6d09a66a88c82202c0c3e1008ce`** (= `origin/master`,
`ci: full Frontend E2E on PRs touching the surfaces it exercises (#1650)`).
Nothing is quoted from memory, from the Wave E spec's citation list, or from
another document. §0.2 records which of the spec's citations moved at this SHA
and which one is materially wrong.

**Spec provenance, stated because it affects reproducibility.** Wave E spec
**Rev 2** is `docs/plans/wave-e-approvals-spec-2026-07-28.md` on PR **#1651**
(branch `docs/wave-e-spec-rev2`, head `7d1460b1`), which was **still open and
unmerged** when this artifact was written. `origin/master` carries **Rev 1** of
that file (573 lines) and Rev 2 is 894 lines, so the sixteen-item list this
document discharges exists **only** on the PR branch. Rev 2 was read from
`git show pr1651:docs/plans/wave-e-approvals-spec-2026-07-28.md`. **#1651 must
merge before or with this artifact**, or the two documents disagree about what
E.0 was asked to do.

**This artifact does not authorise any code.** It disposes of sixteen items.
Wave E code becomes buildable only for those phases whose blocking items are
dispositioned non-`Block` **and** whose named remediation PRs (§17) have merged.

---

## 0. How to read this

### 0.1 The disposition vocabulary — and the rule that makes it binding

Rev 2 §7.1 folds review blocker `[ER-B11]`: *"a gate whose output is a verdict
lets 'violated' become documentation."* Every item below therefore terminates in
exactly one of three dispositions, each with a named owner and a **testable**
exit condition:

| Disposition | What it means | What discharges it |
|---|---|---|
| **Accept** | The risk is taken as-is, in a named person's name. | The accepting sentence, with the owner's name, appears in this artifact. Nothing further is built. |
| **Mitigate before phase X** | The risk is real and phase X may not ship without the fix. | A named PR **and** a named test. Both must exist before phase X merges. |
| **Block** | No Wave E phase — or a named phase — proceeds until re-dispositioned. | A re-disposition, in a PR amending this artifact. |

**The rule Rev 2 §7.1 adds, applied literally here: a *current* violation may
not be dispositioned as "documented".** Where the shipped behaviour breaks the
§7.4 disclosure rule and E1 or E2 touches it, the disposition is
`Mitigate before phase X` and the fix is a **prerequisite remediation PR named
in §17 (`E.0a`)** — not a paragraph in this file. Where a current violation
exists that E1/E2 do **not** touch, it is dispositioned against the successor
slice and named, not softened.

**Scope reminder that shrinks several items:** E1 and E2 add **no public route
and no public payload field** (Rev 2 §8.1: *"No new route path and no
public-route change in either phase"*; §8.2: zero frontend diff). E3 — the
recipient-scoped queue — is **deferred out of the wave** (Rev 2 §0.2, §4.3).
Several items below are therefore `Accept` **for E1/E2 specifically** and
`Block` or `Mitigate` against the successor slice. Each says which.

### 0.2 Citation regeneration at `415af44a` — including one that is wrong

`git diff --name-only 470b0422 415af44a -- backend/src backend/prisma frontend/src`
returns nine files. Of the files this threat model cites, exactly **one** is in
that diff: `backend/prisma/schema.prisma`. Every other citation was re-opened
and holds.

| Citation | Rev 2 says | At `415af44a` | Note |
|---|---|---|---|
| Token `recipientEmail` / `recipientName` | `schema.prisma:808-809` | **`:809-810`** | one-line drift inside `HoldPointReleaseToken` (`:805-828`) |
| `@@index([batchId])`, the token model's only secondary index | `schema.prisma:826` | `:826` | holds |
| `HoldPointReleaseBatch`, no `projectId` | `schema.prisma:833-851` | `:833-851` | holds; `requestedByUserId` at `:843` |
| 48-hour expiry constant | `tokens.ts:17` | `routes/holdpoints/tokens.ts:17` | holds; path is under `routes/holdpoints/`, not `lib/` |
| `SECURE_LINK_EXPIRY_HOURS` pinned at 48 | `tokens.test.ts:27` | **`tokens.test.ts:28`** | one-line drift |
| Chase status guard | `actionRoutes.ts:744` | **`:745`** | one-line drift; `findUnique` `:721` and `update` `:749` hold |
| `notificationSentTo` disclosure test | **`holdpoints.test.ts:311`** | **WRONG — see below** | material |

**The material correction. `holdpoints.test.ts:311` does not lock a public
disclosure in.** Rev 2 states in three places (§0.4 `[ER-B11]`, §7.1, §9, §16.5)
that two tests lock the public disclosures in, naming `holdpoints.test.ts:311`
as one. Read at this SHA, that assertion is on the **authenticated** route:

```
backend/src/routes/holdpoints.test.ts:299-311
  const evidenceRes = await request(app)
    .get(`/api/holdpoints/${holdPoint.id}/evidence-package`)
    .set('Authorization', `Bearer ${authToken}`);
  ...
  expect(evidenceRes.body.evidencePackage.holdPoint).toHaveProperty('notificationSentTo');
```

The in-file comment at `:307-308` says so itself: *"plumbed on the **authed**
evidence-package payload (PR A)"*. Internal staff seeing the recipient list is
not a §7.4 violation — §7.4 governs what **the link** reveals.

The test that actually locks the **public** single-token disclosure in is
**`holdpoints.test.ts:2531-2554`**, `it('should get hold point by public token')`,
hitting `GET /api/holdpoints/public/${releaseToken}` with no auth header:

```
backend/src/routes/holdpoints.test.ts:2552-2554
  expect(res.body.evidencePackage.project.company?.name).toBeTruthy();
  expect(res.body.evidencePackage.holdPoint).toHaveProperty('releaseSignatureUrl');
  expect(res.body.evidencePackage.holdPoint).toHaveProperty('notificationSentTo');
```

**Why this matters and is not pedantry.** The two payloads are separable at the
call site, not inside a shared builder: `buildHoldPointEvidencePackage`
(`evidencePackage.ts:318`) has exactly three non-test callers — the public one
at `publicReleasePayload.ts:122` (which passes `notificationSentTo` at `:137`)
and two authenticated ones at `readRoutes.ts:353` and `:527`. The public caller
can stop passing the field **without touching the authed payload or the authed
test at `holdpoints.test.ts:311`**. E.0a's scope is therefore *different* from
what Rev 2 §9 describes, and correctly narrower: §17 states the real list.

**The count Rev 2 gives is also low.** Three public assertions lock disclosures
in, not two: `holdpoints.test.ts:2552` (company branding), `:2554`
(`notificationSentTo`), and `publicBatchRoutes.test.ts:269-273` (`requestedBy`
and `recipient.email`).

### 0.3 What this artifact found that Rev 2 did not

Three findings originate here, each verified at `415af44a`. All three carry a
disposition below rather than sitting in prose.

1. **The canary allowlist fails OPEN if its env parsing yields `undefined`.**
   `findActiveProjects` (`notificationAutomation.ts:169-191`) treats an **empty
   array** as "no projects" (`:173-175`, `return []`) but **`undefined`** as
   "**every** active project" (`:190`, `...(projectIds ? { id: { in: projectIds } } : {})`).
   Rev 2 §4.1.3 says *"Empty or unset = the stale-hold-point job is skipped
   entirely"* — that is a property of code not yet written, and the natural
   implementation (`process.env.X?.split(',')` → `undefined` when unset)
   produces the exact opposite. **Item 8.**
2. **Recipient emails are already persisted, un-redacted and indefinitely, in
   the audit log.** `HP_RELEASE_REQUESTED` writes `changes.notificationSentTo`
   on both paths — `requestReleaseRoutes.ts:495` (batch, `recipient.email`) and
   `:926` (single, `normalizedNotificationSentTo`). `sanitizeAuditChanges`
   (`auditLog.ts:53-58`, applied at `:77`) redacts only keys matching
   `auditLog.ts:18-27` — `/password/i`, `/token/i`, `/secret/i`,
   `/api[-_]?key/i`, `/key[-_]?hash/i`, `/^authorization$/i`,
   `/^credential$/i`, `/^signature$/i`. **`notificationSentTo` matches none of
   them.** Rev 2 §4.2.7's claim that automated-send rows would be *"the first
   automation-written rows to do so"* is true only of the word *automation*;
   user-initiated rows already do it. **Item 9.**
3. **`RETENTION_POLICIES.auditLogs` is declared and never read.**
   `dataRetention.ts:14` declares `auditLogs: 7 * 365` with the comment *"Audit
   trails (7 years for compliance)"*. A repo-wide grep for `auditLogs` in
   `dataRetention.ts` and `dataRetentionWorker.ts` returns **only that
   declaration**. `applyRetentionPolicies` (`:86-146`) never touches
   `auditLog`, and `:81` states it: *"Project, audit, NCR, lot and test data are
   never auto-deleted."* So the retention period for finding 2's emails is
   **forever**, not seven years. **Item 9.**

---

## 1. Item 1 — The capability model, before and after

### Current state, at `415af44a`

**Two public doors, both unauthenticated**, both mounted under
`/api/holdpoints` at `server.ts:159`:

| Door | Routes | Grants |
|---|---|---|
| Single hold point | `GET /public/:token`, `POST /public/:token/release`, `GET /public/:token/documents/:documentId` (`holdpoints.ts:108`, `:122`, `:72`) | **one hold point**, and its evidence documents |
| Batch "review room" | `GET /public/batch/:batchToken` and three subpaths (`publicBatchRoutes.ts:98`, `:164`, `:189`, `:240`) | **one lot's batch**, for **one recipient** |

A batch is created against **one `lotId`** and **one recipient**, so it is a
per-lot, per-request room and not a queue. Token identity is
`recipientEmail` + optional `recipientName` (`schema.prisma:809-810`) with **no
principal, no account, no FK to `User`**.

**After Wave E: unchanged.** E1 and E2 add no public route, no public payload
field and no new token kind (Rev 2 §8.1, §8.2). E2 mints *more* tokens of the
existing kind (the tier-2 chase links, Rev 2 §4.2.3) but does not change what
one grants.

### Ruling

The capability model is **not widened by Wave E**. The prohibition that keeps it
that way is `[E-B8]` (Rev 2 §6): *no capability is ever derived by unioning
other capabilities by email, in any phase including deferred ones.* That
prohibition is restated in item 2 of the successor-slice list and enforced by
review, because it cannot be tested for absence in code that does not exist.

- **Disposition: Accept.** Wave E takes the shipped one-token-one-hold-point (or
  one-token-one-lot-batch) model as-is. **Jay** accepts.
- **Owner:** Jay (acceptance); build agent (holding the line in review).
- **Exit condition (testable):** the mechanical `[E-B10]` check in Rev 2 exit
  item 10 — `git diff` across the whole wave touches **no public route file**
  (`holdpoints.ts`, `holdpoints/publicBatchRoutes.ts`,
  `holdpoints/publicReleasePayload.ts`, `holdpoints/publicReleaseExecution.ts`)
  and no new model in `schema.prisma`. Shown in every Wave E PR body.

---

## 2. Item 2 — Token enumeration, the rate limit, and the existence oracle

### 2.1 Entropy

Tokens are **32 random bytes rendered hex — 256 bits** — minted at three sites:
`requestReleaseRoutes.ts:203` (single), `:757` (batch), `actionRoutes.ts:100`
(chase). Stored as a `sha256:`-prefixed digest, so a database leak yields no
usable link. Route params are length-capped at `MAX_RELEASE_TOKEN_LENGTH = 512`
(`validation.ts:100`) before any DB hit, applied at `holdpoints.ts:72`, `:108`,
`:122` and `publicBatchRoutes.ts:98`, `:164`, `:189`, `:240`.

### 2.2 The only rate limit that applies — verified numbers

**There is no dedicated limiter on the public hold-point routes.** Verified
three ways:

- The **global** per-IP limiter is mounted at `server.ts:115`, `app.use(rateLimiter)`.
  Its numbers: `WINDOW_MS = 60 * 1000` (`rateLimiter.ts:47`) and
  `MAX_REQUESTS = readPositiveIntegerEnv('API_RATE_LIMIT_MAX', 1000)`
  (`rateLimiter.ts:48`). **60-second window, default 1000 requests per IP.**
- The hold-point router is mounted **bare** — `server.ts:159`,
  `app.use('/api/holdpoints', holdpointsRouter)`, with no limiter argument.
  Narrower limiters exist and are mounted this way elsewhere in the same
  block: `server.ts:140` (`authRateLimiter`, `AUTH_MAX_REQUESTS` = 10 in
  production / 50 otherwise, `rateLimiter.ts:50-53`) and `server.ts:162-163`
  (`supportRateLimiter`). `server.ts:159` has neither.
- **No test asserts any rate limit on these routes.** A grep for `rateLimit`
  across `src/routes/holdpoints.test.ts` and `src/routes/holdpoints/*.test.ts`
  returns **zero hits**, and a grep for `holdpoints/public` outside comments
  finds no limiter registration anywhere in `src/`.

The building block exists: `consumeRateLimit(bucket, key, window, max)`
(`rateLimiter.ts:215`) takes an arbitrary bucket and key, used at `:229`
(api), `:460` (auth), `:516`, `:545`, `:576` (chat), `:601`. A public
hold-point limiter is a handful of lines beside its five siblings.

### 2.3 Enumeration arithmetic, stated

Against 2²⁵⁶ tokens, 1000 requests/minute/IP is not the control that matters —
the entropy is. One IP exhausting the global budget for a full year makes
~5.3×10¹¹ attempts against a ~1.2×10⁷⁷ keyspace. **Enumeration of a hold-point
token is not a credible threat at this entropy.** What the *absence* of a
narrower limiter does buy an attacker is (a) cheap denial of service against
every other `/api/*` consumer sharing that IP bucket, and (b) unlimited replay
attempts against a **leaked** token's release POST, which is a different threat
and is bounded by the guarded claim (item 3), not by a limiter.

### 2.4 The existence oracle — ruled on

`assertPublicHoldPointTokenAvailable` (`publicReleasePayload.ts:94-107`) produces
two distinguishable responses:

- **unknown token → 404** `Invalid or expired link` (`:98`)
- **known but expired → 410 `TOKEN_EXPIRED`** with the text *"This secure
  release link has expired. Please contact the site team for a new link."*
  (`:100-106`)

That is a genuine existence oracle: 410 proves the presented token was once
issued. **Ruling: keep it.** Reasons, in order:

1. The oracle is only reachable by someone who already holds a valid 256-bit
   token, since guessing one is the precondition for learning anything. It leaks
   one bit about a secret the asker already has.
2. Collapsing 410 into 404 destroys the one message the shipped product depends
   on. A superintendent whose 48-hour link lapsed needs to be told *"expired,
   ask the site team"*, not *"invalid"* — and the frontend renders that
   distinction (`PublicHoldPointReleasePage.tsx` consumes the payload; the
   410's copy is written for a human, not a machine).
3. The same reasoning would force collapsing the 410 `TOKEN_USED` contract,
   which Rev 2 §1.3 item 10 and §4.4 declare untouchable.

**Recorded as taken, not as absent.** Rev 2 §7.1 item 2 requires the decision be
*recorded as taken*; this is that record.

### Disposition

| Sub-item | Disposition | Owner | Exit condition |
|---|---|---|---|
| Enumeration vs. the global limiter, **for E1/E2** | **Accept** — 256-bit entropy is the control; neither phase touches a public route, so neither changes the exposure. Jay accepts. | Jay | The `[E-B10]` mechanical check (item 1) shows no public route file in the wave's diff. |
| A dedicated `/api/holdpoints/public/*` limiter | **Mitigate before the successor slice** — required the moment one bearer token is worth more than one hold point. Must key on the **hashed** token, never the raw one. | build agent | A limiter registered at `server.ts:159` **plus** the first test asserting a limit on these routes (there is none today). Both in the successor slice's PR. |
| The 404/410 existence oracle | **Accept** — ruled on in §2.4, in Jay's name. | Jay | This section's ruling is the record. `publicReleasePayload.ts:94-107` unchanged across the wave (part of the `[E-B10]` check). |

---

## 3. Item 3 — Expiry, revocation and replay

### 3.1 Expiry

**One constant, both paths: 48 hours.** `SECURE_LINK_EXPIRY_HOURS = 48`
(`routes/holdpoints/tokens.ts:17`), applied at `requestReleaseRoutes.ts:199`,
`:753` and `actionRoutes.ts:116`, and pinned at `tokens.test.ts:28`
(`expect(SECURE_LINK_EXPIRY_HOURS).toBe(48)`).

### 3.2 Replay — the defence is a predicate, not a pre-check

`executeHoldPointTokenRelease` claims the token as **one guarded
`updateMany`** (`publicReleaseExecution.ts:76-89`):

```
where: { id: tokenId, usedAt: null, expiresAt: { gt: releasedAt } }
```

with `if (tokenUpdate.count !== 1)` at `:91`. Double-spend **and** post-expiry
release are the same predicate, evaluated inside the serializable transaction —
not a read-then-check. This is the correct pattern and Wave E must not touch it
(Rev 2 §4.4, `[E-B10]`).

### 3.3 The three implicit revocation paths, and the absence of a fourth

There is **no explicit revocation endpoint**. A grep for `revoke` across
`src/routes/holdpoints/` (non-test) returns only internal helpers —
`revokeSupersededChaseReleaseTokens` (`actionRoutes.ts:129`) and
`revokeFreshChaseReleaseToken` (`:147`), called at `:813`, `:815`, `:818`. No
route, no admin action, no UI. Revocation is therefore three side effects:

| Path | Mechanism | Trigger | Gap |
|---|---|---|---|
| **Re-request** | `deleteMany({ where: { holdPointId, usedAt: null } })` — `requestReleaseRoutes.ts:393-397` (batch), `:865-870` (single) | an authorised user re-requests release | deletes only **unused** tokens; a spent token row survives until retention |
| **Chase supersession** | `revokeSupersededChaseReleaseTokens` (`actionRoutes.ts:129`), called on send success at `:813` | a manual chase succeeds | on send **failure** the *fresh* token is revoked instead (`:815`, `:818`), so the old one stays live — correct, but it means a failed chase leaves the previous capability standing |
| **Retention purge** | `buildExpiredOrOldUsedHoldPointReleaseTokenWhere` (`dataRetention.ts:43-53`): `OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null, lt: usedCutoff } }]`, applied `:110-114` | the daily worker | **the worker defaults to OFF outside production** — `getDataRetentionWorkerEnabled` returns `process.env.NODE_ENV === 'production'` (`dataRetentionWorker.ts:29`). Outside prod, expired tokens accumulate forever |

**Should there be an explicit revoke endpoint? Ruling: no, not in Wave E.**
The reasons are evidential, not aesthetic:

1. The user-facing need it would serve — *"I sent that to the wrong person"* —
   is **already served** by re-requesting release, which deletes every unused
   token for that hold point (`requestReleaseRoutes.ts:392-397`, `:865-870`)
   and mints new ones. A revoke endpoint would be a second way to do a thing
   that already works.
2. Expiry is 48 hours (§3.1). The exposure window a revoke button would shorten
   is at most two days, and only for a link the site team has already decided
   was misaddressed — in which case they re-request.
3. Adding an endpoint whose only caller is a UI nobody asked for is precisely
   the over-build Rev 2 `[E-g]` names.

**What *is* wrong today and E2 does touch:** the chase recipient resolver
selects tokens on `{ holdPointId, usedAt: null }` with **no `expiresAt`
predicate at all** (`actionRoutes.ts:204-211`; `expiresAt` appears in that file
only as the *write* at `:124`). Combined with `dataRetentionWorker.ts:29`, an
**expired** token seeds chases indefinitely outside production. E2 automates
that path, so it industrialises the defect.

### Disposition

| Sub-item | Disposition | Owner | Exit condition |
|---|---|---|---|
| The 48-hour expiry constant | **Accept** — unchanged by the wave. Jay accepts. | Jay | `tokens.test.ts:28` stays green; `tokens.ts` in the `[E-B10]` untouched list. |
| The guarded claim as the replay defence | **Accept** — it is already the correct pattern. | Jay | `publicReleaseExecution.ts:76-89` untouched (`[E-B10]`), and the shipped double-spend tests stay green: `holdPointReleaseDecision.db.test.ts:549`, `holdPointBatchReleaseDecision.db.test.ts:499`. |
| The three implicit revocation paths, with no explicit endpoint | **Accept** — ruled in §3.3, in Jay's name. | Jay | This ruling is the record. No revoke route added in Wave E (`[E-B10]`). |
| **The missing `expiresAt` predicate in the chase resolver** | **Mitigate before E2** — `actionRoutes.ts:204-211` gains `expiresAt: { gt: now }`. This is a *current* defect on the manual path, so the fix lands in E2 with the resolver change, not later. | build agent | **AT-118** (Rev 2 §12): with only an expired unused token present, the resolver does not select its recipient from tier 1 — asserted with the retention worker **disabled**, its default outside production (`dataRetentionWorker.ts:29`). |

---

## 4. Item 4 — The disclosure inventory, item by item

### 4.1 The rule being measured against

Rev 2 §7.4, quoted:

> A hold-point release link may reveal the evidence for the hold points its
> recipient has been asked to decide, plus the minimum context needed to know
> what is being signed (project name and number, lot number and activity,
> scheduled date, expiry, who asked). It may not reveal **any other person's
> contact details**, **any address the request was also sent to**, **any
> internal identifier that is not needed to render the page**, or **anything
> about a lot or hold point the recipient has not been asked about**.

### 4.2 What a bearer reaches today — nine items, each dispositioned

Every field below was read at `415af44a`. "Public" means reachable with a token
and no authentication.

| # | Field | Where | Against §7.4 | Disposition | Owner | Exit condition |
|---|---|---|---|---|---|---|
| 4a | **`notificationSentTo`** — the comma-joined list of **every other address the request was sent to** | passed into the public payload at `publicReleasePayload.ts:137`; the column is `schema.prisma:769`, written normalised at `requestReleaseRoutes.ts:825` | **VIOLATION.** §7.4's second prohibition, verbatim: *"any address the request was also sent to"* | **Mitigate before E2 → `E.0a`** | build agent | The public caller stops passing it (`publicReleasePayload.ts:137`), the authed callers (`readRoutes.ts:353`, `:527`) are unchanged, and `holdpoints.test.ts:2554` is **inverted to an absence assertion**. `holdpoints.test.ts:311` is untouched (§0.2). |
| 4b | **`tokenInfo.recipientEmail`** — the bearer's own address | `publicReleasePayload.ts:149` | **Not a violation.** It is the bearer's own contact detail, echoed back. §7.4 forbids *"any other person's"*. | **Accept** | Jay | This sentence. Field unchanged. |
| 4c | **The PDF renders 4a too** — `Recipient of Record: <notificationSentTo>` | `frontend/src/lib/pdf/holdPointEvidencePdf.ts:44-45` | **VIOLATION**, same one as 4a, in a file the recipient can save and forward | **Mitigate before E2 → `E.0a`** | build agent | Cutting 4a at `publicReleasePayload.ts:137` starves this render, because the PDF reads `data.notificationSentTo`. `E.0a` must assert the row is **absent** from the public PDF, and must confirm the **authed** PDF still renders it (the field is legitimate for internal staff). |
| 4d | **`batch.requestedBy`** — `requestedByUser?.fullName \|\| requestedByUser?.email`, i.e. **an internal staff email whenever `fullName` is null** | `publicBatchRoutes.ts:104-109` (the lookup), `:142` (the emit) | **VIOLATION in the `email` arm only.** §7.4 explicitly permits *"who asked"* — a **name** is in-scope context. Falling back to an email address is not. | **Mitigate before E2 → `E.0a`** | build agent | The fallback chain drops the email arm: `fullName` or a non-identifying label, never `email`. `publicBatchRoutes.test.ts:269` currently asserts `requestedBy` **is** `'Batch Requester'` — it stays, and a **new** case with `fullName: null` asserts the response contains no `@`. |
| 4e | **`batch.recipient.email`** and `.name` | `publicBatchRoutes.ts:145-148`, from `schema.prisma:836-837` | **Not a violation** — same reasoning as 4b, the bearer's own details. | **Accept** | Jay | This sentence. `publicBatchRoutes.test.ts:270-273` unchanged. |
| 4f | **`project.company { name, abn, address, logoUrl }`**, logo embedded as a **data URL** | `evidencePackage.ts:287-292`; the data-URL embed at `:283` (`getCompanyLogoDataUrl`) | **Not a violation.** §7.4 permits *"the minimum context needed to know what is being signed"*, and the head contractor's identity is that context — a super signing a release must know whose project it is. ABN and address are **published business identifiers**, not personal data. The logo is deliberately embedded so the public PDF needs no live fetch (`:281-282` comment). | **Accept** | Jay | This sentence. `holdpoints.test.ts:2552` (`company?.name` truthy on the public payload) stays green **unchanged** — it is not an `E.0a` target. |
| 4g | **Internal staff full names** — every person who completed or verified each checklist item, and each test result's verifier | `evidencePackage.ts:156` (`completedBy`), `:159` (`verifiedBy`), `:192` (test `verifiedBy`) | **Not a violation, and cutting it would break the product.** The evidence package's purpose is to show *who did the work* so the super can decide whether to release. A name is not a contact detail; §7.4 forbids *"contact details"*. Removing it would make the artefact useless for its one job and would weaken the Electronic Transactions Act evidence position (§6, item 6). | **Accept** | Jay | This sentence. Fields unchanged; part of the `[E-B10]` untouched set for the wave. |
| 4h | **Laboratory names and report numbers** | `evidencePackage.ts:183-184` (`laboratoryName`, `laboratoryReportNumber`) | **Not a violation** — same reasoning as 4g. A NATA lab's name is the provenance of the test the super is being asked to accept. | **Accept** | Jay | This sentence. |
| 4i | **Raw `project.id` and `lot.id` UUIDs** | `evidencePackage.ts:272` (project), `:261` (lot) | **Marginal.** §7.4 forbids *"any internal identifier that is not needed to render the page"*. These are v4 UUIDs — non-sequential, non-enumerable, and they reveal nothing an authenticated route would then serve to a token bearer. But they are also **not needed** by the public page. | **Accept for E1/E2; Mitigate before the successor slice** — the moment a queue exists, a bearer holding N lot ids across a project is a reconnaissance surface worth removing. | Jay (accept); successor slice's build agent (mitigate) | For E1/E2: this sentence, plus `[E-B10]`. For the successor: **AT-111** (Rev 2 §12, retained for the deferred slice) asserts the ids are **absent** from the public payload. |

### 4.3 The count, stated plainly

**Nine sub-items. Three are current §7.4 violations: 4a, 4c, 4d.** All three are
in scope for E2 (E2 automates mail that delivers these links at a higher rate),
so all three route to **`E.0a`** (§17). Five are `Accept`. One (4i) is
`Accept` for this wave and `Mitigate` for the successor.

**No current test asserts any public payload field is absent.** Confirmed by
grep: there is no negative assertion on the public payload anywhere in
`src/routes/holdpoints.test.ts` or `src/routes/holdpoints/*.test.ts`. Three
assertions do the opposite (§0.2). `E.0a` is therefore a test change as well as
a code change, which is exactly why Rev 2 §9 reserves it as its own PR slot and
forbids smuggling it into a phase PR.

---

## 5. Item 5 — Post-spend and post-decision read

### Current state

The public GET **deliberately** checks expiry and **not** `usedAt`.
`assertPublicHoldPointTokenAvailable` (`publicReleasePayload.ts:94-107`) throws
404 when the token is unknown and 410 when `new Date() > releaseToken.expiresAt`
— there is **no `usedAt` branch**. `canRelease` is computed separately at
`:152`: `!['released','completed'].includes(holdPoint.status) && !releaseToken.usedAt`.
So a spent link keeps rendering the full evidence package read-only, which is
pinned by `holdpoints.test.ts:3389-3392`,
`it('should reopen a used public release token as read-only evidence')`,
asserting `status === 'released'` and `tokenInfo.canRelease === false`.

### The question Rev 2 asks: for how long?

**Answered from the code, not from policy: at most 48 hours from issue.** The
GET's only gate is `expiresAt` (`publicReleasePayload.ts:100`), and `expiresAt`
is always `now + SECURE_LINK_EXPIRY_HOURS` (`tokens.ts:17` = 48, applied
`requestReleaseRoutes.ts:199`, `:753`, `actionRoutes.ts:116`). A spent link
therefore stops rendering when the *original* 48-hour window closes, whether or
not it was used. The row itself is then purged by retention
(`dataRetention.ts:43-53`), on the used-token cutoff for spent rows and
immediately-eligible for expired ones.

**This is the right window and it needs no change.** The behaviour it exists for
is real: a super who signs, closes the tab, and wants to re-read what they
signed. Bounding that at the same 48 hours as the decision itself is coherent —
one constant, one window, no second policy to keep in sync.

- **Disposition: Accept.** The post-spend read window is bounded at 48 hours by
  the shipped expiry check, and E1/E2 do not change it. **Jay** accepts.
- **Owner:** Jay.
- **Exit condition (testable):** `holdpoints.test.ts:3389-3392` stays green
  unchanged, and `publicReleasePayload.ts` appears in the `[E-B10]` untouched
  list in every Wave E PR body.

---

## 6. Item 6 — Email as the trust boundary

### 6.1 What the boundary actually is

Possession of the emailed link **is** the credential. There is no account, no
second factor, and no proof the bearer is the addressee. Three concrete
consequences, each with evidence:

1. **Forwarding works and is invisible.** Nothing binds the token to the
   mailbox. Token identity is `recipientEmail` + optional `recipientName`
   (`schema.prisma:809-810`) with no principal.
2. **Shared mailboxes collapse two humans into one capability.** See item 12.
3. **Mail-client prefetch hits the GET.** Outlook/Gmail link scanning issues
   unauthenticated GETs to whatever is in the body. If any public GET mutated,
   a scanner would spend the link before the human read the email.

### 6.2 GET purity — verified, and verified to be untested

**All public GETs are pure reads at this SHA.** `usedAt` is written in exactly
one place: the guarded `updateMany` inside `executeHoldPointTokenRelease`
(`publicReleaseExecution.ts:82-83`), reached only from the release POSTs. The
GET handlers call `assertPublicHoldPointTokenAvailable` and
`buildPublicHoldPointReleasePayload` (`publicReleasePayload.ts:94`, `:110`),
neither of which writes.

**And no test asserts it.** The near-misses were checked and do not count:
`holdpoints.test.ts:2615` and `:2727` both assert `usedAt` is null **after a
rejected POST** (a 403 at `:2606` and a 400 at `:2715` respectively), not after
a GET. So the shipped protection for the single most consequential property of
this surface — *a link scanner cannot release a hold point* — rests on nobody
having broken it yet.

### 6.3 The claim limit, restated not weakened

Program §7 line 135's words, which Rev 2 §7.6 reproduces: *"possession of an
emailed link does not by itself prove who made a contractual decision."* A
forwarded link signed by a colleague produces a record that is complete,
immutable, and **attributed to the wrong human**.

**Tier-2 chase links, which E2 makes common, are weaker still.** A tier-2 link
(Rev 2 §4.2.3) is minted against an address parsed out of `notificationSentTo`,
which stores **emails only, no names** (`schema.prisma:769`). So the token
carries no `recipientName`, and the identity override at `holdpoints.ts:176-177`
— `const tokenRecipientName = releaseToken.recipientName?.trim();
const effectiveReleasedByName = tokenRecipientName || releasedByName;` —
falls through to whatever the recipient typed. **A tier-2 release is a
materially weaker evidence artefact than a tier-1 one**, and E2 is what makes
tier-2 the common case. This is Rev 2 `[E-l]`, and it is stated here rather than
discovered by a lawyer.

### Disposition

| Sub-item | Disposition | Owner | Exit condition |
|---|---|---|---|
| Link possession as the credential; forwarding; shared mailboxes | **Accept** — this is the adopted product pattern (program line 17: mandatory reviewer accounts are the *known adoption risk*), and Wave E does not widen it. Jay accepts, in his name. | Jay | This sentence, plus item 1's `[E-B10]` check. |
| **GET purity is untested** | **Mitigate before E1** — not before E2. E1 is the first Wave E PR to touch this surface's alert behaviour, and the regression test costs one test file. | build agent | **AT-112** (Rev 2 §12): repeated GET **and HEAD** against every public hold-point and batch route leave `usedAt` null, release nothing, write no audit decision row and trigger no notification — asserted by **re-reading the database** after the requests, not by inspecting the response. This is the first test of its kind on these routes. |
| The ETA claim limit and the tier-2 weakness | **Accept, on condition the limit is written down** — CIVOS records strong tamper-evident evidence of a decision made through a link addressed to a named person; it does **not** verify that person's identity. Nothing in Wave E may state otherwise. | Jay | Rev 2 §7.6 carries the sentence; **AT-115** proves the fallback is *named as a fallback* in the reminder body (`[E-B8b]`), and Rev 2 exit item 13 requires the Clancy knowledge mirror to carry it. |

---

## 7. Item 7 — Automated mail to a non-user

### 7.1 What changes: rate, not category

Wave E adds no new personal-data field and no new egress destination. It
**increases the rate** at which one existing category — an external
individual's email address — is mailed, by putting the chase on the hourly
worker (Rev 2 §4.2). Today every send to that address is initiated by a human
clicking chase (`actionRoutes.ts:714`, `requireAuth`).

### 7.2 The facts that bound it, verified

- **Cadence.** Anchored to `scheduledDate` in the project's working calendar
  (Rev 2 §4.2.1); `minimumNoticeDays` is not consulted. `scheduledDate` is
  nullable (`schema.prisma:770`) and the Prisma `lt` filter excludes nulls, so a
  request with no scheduled date produces **no** reminder, ever.
- **Per-generation cap.** Rev 2 §4.2.2. **There is no cap today.** Verified:
  a grep for `chaseCount` across non-test `src/` returns 14 hits —
  `holdPointTemplates.ts:42`, `:372`, `:419`, `:476`, `:487`, `:516`;
  `email.ts:449`, `:460`; `chaseNotifications.ts:11`, `:43`, `:58`, `:77`;
  `actionRoutes.ts:752` (the increment), `:788`, `:834` (display and audit).
  **No comparison operator is applied to `chaseCount` anywhere in the
  codebase.** Rev 2 §2.5 is correct and the cap is a new control, not a
  preserved one.
- **Digest and daily limit.** Rev 2 §4.2.6: one email per project per
  normalised recipient per day.
- **No unsubscribe of any kind.** `NotificationEmailPreference` is keyed on
  `userId` with a hard FK to `User` (`schema.prisma:283-309`), so it cannot
  express a preference for a non-user. A case-insensitive grep across
  `backend/src` for `list-unsubscribe` returns **zero hits**. **NOT FOUND.**
- **No reply path.** `EmailOptions` (`email.ts:51-58`) has fields
  `to`, `subject`, `text`, `html`, `from`, `attachments` — **no `replyTo`** —
  and the single Resend payload (`email.ts:173-180`) passes
  `from`, `to`, `subject`, `text`, `html`, `attachments`, no reply header. A
  case-insensitive grep for `replyto|reply_to` across `backend/src` returns
  **zero hits**. **NOT FOUND.**
- **Domain-reputation risk.** There is exactly one transport
  (`resend.emails.send`, `email.ts:173`), so every CIVOS email — invitations,
  diary digests, docket alerts, claims — shares one sending reputation with
  these reminders. A spam-marked reminder campaign does not degrade reminders;
  it degrades **the whole product's mail**, including the passwordless channel
  the program's line 17 belief rests on. This, not recipient annoyance, is the
  risk that justifies the digest.

### 7.3 The Spam Act 2003 (Cth) — **facts and a position to check, no conclusion**

**This section states facts and a position to verify with counsel. It is not
legal advice and reaches no legal conclusion. Flag to Jay for J5-style
sign-off.**

The facts, as they bear on the question:

1. The Act's operative prohibition attaches to a *commercial electronic
   message*. Whether an automated reminder that a hold-point decision is due is
   commercial or transactional is a **characterisation question about CIVOS's
   specific message**, and it has not been asked of anyone qualified.
2. The recipient is **not a CIVOS user** and has no CIVOS account. Consent, if
   any, flows from the head contractor's commercial relationship with the
   superintendent — a third party to CIVOS. CIVOS holds no consent record of
   its own for that address. The address reaches CIVOS via
   `hpRecipients` project settings or free-text entry in the request modal.
3. The message is sent **by CIVOS's transport** (`email.ts:173`) from a CIVOS
   `from` address, on behalf of the head contractor, in response to an action a
   head-contractor user took. Who the "sender" is for the Act's purposes has
   not been determined.
4. **CIVOS ships no unsubscribe facility for a non-user** (§7.2, NOT FOUND) and
   no `List-Unsubscribe` header. Whether a functional unsubscribe is required
   for this message class turns entirely on the characterisation in (1).
5. **What Rev 2 §4.2.6 adds instead** is a `replyTo` reaching the human who
   made the request, plus bounce/complaint suppression (item 16). Whether a
   reply-to plus suppression discharges whatever obligation exists is a
   question, not an answer.
6. The program's own research register is explicit that it is not legal advice:
   `CIVOS-Research-Appendix-2026-07-24.md:66` carries the caveat *"Some head
   contracts still mandate wet-ink — contract check per pilot; this register is
   not legal advice."* Rev 2 §15.1 states outright that whether a reminder is a
   commercial electronic message is **never to be asserted**.

**The position offered to counsel, framed as a position and not a finding:**
*a reminder that a decision the recipient was already asked to make is now due,
sent to an address a head-contractor user nominated for that purpose, carrying
no offer and no promotion, and carrying a working reply path to the requesting
human, is most plausibly transactional rather than commercial.* **That sentence
is a hypothesis for counsel to confirm or reject. Nobody at CIVOS may rely on
it, cite it, or repeat it as settled.**

### Disposition

| Sub-item | Disposition | Owner | Exit condition |
|---|---|---|---|
| Cadence, per-generation cap, digest, daily limit | **Mitigate before E2** — these are the controls that bound the rate increase, and E2 does not ship without all of them. | build agent | **AT-102** (timing and guards), **AT-114** (the atomic cap, including the concurrency test), **AT-116** (one digest for N items; a second same-day pass sends nothing; casing variants count as one recipient). |
| Absence of `List-Unsubscribe` / any unsubscribe for a non-user | **Accept for E2, conditional on §7.3 resolving transactional** — and **Block on E2's suppression handling** until item 16 is dispositioned. If counsel says commercial, this flips to Block on all of E2. | Jay | Jay's written position under §7.3, plus item 16's disposition. Recorded in the E2 PR body. |
| `replyTo` reaching a human | **Mitigate before E2** | build agent | **AT-110** — `replyTo` added to `EmailOptions` (`email.ts:51-58`) and passed to Resend (`email.ts:173-180`), threaded at the four hold-point payload sites Rev 2 §4.2.6 enumerates including `requestReleaseRoutes.ts:457-462`, which calls `sendEmail` directly. |
| Domain-reputation risk to the whole product's mail | **Mitigate before E2** — the digest is the control; the canary (item 8) is the containment. | build agent | Rev 2 exit item 6: the E2 PR body states messages-per-recipient-per-day **before and after** the digest, on the canary population — measured, not asserted. |
| **The Spam Act 2003 characterisation** | **BLOCK on E2's first send outside the canary allowlist.** E2 may build and may run inside a Jay-named canary. It may **not** be enabled for a project Jay has not personally named until Jay records a position in writing, having either checked with counsel or accepted the risk **in his own name**. | **Jay** | A dated sentence in the E2 PR body naming who was consulted (or recording Jay's own acceptance), and the canary allowlist's contents at the moment of that sentence. No CIVOS document may state a legal conclusion. |

---

## 8. Item 8 — Tenancy on any new query

### 8.1 The claim to confirm

Rev 2 §7.2: *E1 and E2 add no external-facing query surface.* **Confirmed** — no
new route, no public payload change (Rev 2 §8.1), zero frontend diff (§8.2).
Every recipient E2 resolves comes from a record already attached to the hold
point's own project: the token (`schema.prisma:807`, `holdPointId` FK), the
`notificationSentTo` column on the hold point itself (`:769`), or that project's
`ProjectUser` rows (`actionRoutes.ts:165-198`).

### 8.2 The finding: the canary allowlist can fail OPEN

Rev 2 §4.1.3 specifies the Wave-E canary as an env allowlist passed into the
**existing** `NotificationAutomationJobOptions.projectIds`, and states: *"Empty
or unset = the stale-hold-point job is skipped entirely, so the deploy is inert
until Jay names projects."*

**That is a property of the option as it does not behave.** Read at this SHA,
`findActiveProjects` (`notificationAutomation.ts:169-191`):

```
backend/src/lib/notificationAutomation.ts:172-175
  const projectIds = options.projectIds;
  if (projectIds && projectIds.length === 0) {
    return [];
  }
...
backend/src/lib/notificationAutomation.ts:188-191
  where: {
    status: 'active',
    ...(projectIds ? { id: { in: projectIds } } : {}),
  },
```

- `projectIds: []` → **zero projects.** Inert, as Rev 2 wants.
- `projectIds: undefined` → **every active project.** The spread contributes
  nothing and the query returns the whole estate.

The comment immediately above (`:177-181`) makes the intent explicit and
deliberate: *"No default cap: a silent take-100 here (oldest-first) permanently
starved project 101+ of automated alerts on every scheduled run."* This is
correct for the four shipped jobs. It is a **fail-open** default for a canary.

The natural implementation of the env flag —
`process.env.WAVE_E_STALE_ALERT_PROJECT_IDS?.split(',')` — yields **`undefined`**
when the variable is unset, which is precisely the "inert" case Rev 2 names, and
which lands on the branch that scans **every project in production**. An
E1 deploy with the flag not yet set would then run the newly-live stale scan
across the whole estate on the next hourly pass, which is the exact storm
`[ER-B2]` exists to prevent — arriving through the control meant to prevent it.

For scale: the scan is an unbounded `findMany` with **no `take`**
(`systemAutomation.ts:278-288`), the dedupe is a `findFirst` **inside the loop**
(so an unbounded scan is also N+1), and each eligible hold point writes one
`notificationAlert` row plus one in-app `Notification` row per user in the five
`STALE_HOLD_POINT_ALERT_ROLES` (`notificationAlertConfig.ts:16-24`), escalating
to six roles (`:26`) twice (`:42`).

### Disposition

| Sub-item | Disposition | Owner | Exit condition |
|---|---|---|---|
| No new external-facing query surface in E1/E2 | **Accept** — confirmed above. Jay accepts. | Jay | Item 1's `[E-B10]` mechanical check in every Wave E PR body. |
| The automation job cannot cross a project boundary | **Accept** — `notificationAutomation.ts:188-191` scopes by `Project.id`, and every resolved recipient hangs off the hold point's own project. | Jay | **AT-113** (Rev 2 §12): with one project listed, alerts are created for that project only and none for a second eligible project. |
| **The canary allowlist fails open when unset** | **Mitigate before E1.** The env parser must map unset/blank/whitespace to `[]`, never `undefined`. This is not a nicety: it is the difference between an inert deploy and an estate-wide alert storm. | build agent | **AT-113 is extended**, and the extension is the exit condition: *with the env var **unset**, and separately with it set to `''` and to `','`, the stale job creates **zero** alerts* — asserted against the database, with at least one eligible hold point present so a fail-open would be visible. A test that only covers "one project listed" does **not** discharge this item. |

---

## 9. Item 9 — Logging and redaction

### 9.1 The three traps that ship

1. **Request-log path traps**, `logSanitization.ts:58` and `:60`
   (in `sanitizeLogText`) and `:94` and `:95` (in `sanitizeLogPath`) — the
   capability token after `/api/holdpoints/public/` or `/public/batch/`, and the
   frontend `/hp-release/` and `/hp-release/batch/` paths, are replaced with the
   redaction sentinel. Both functions carry both patterns, so a token cannot
   leak through either the text or the path route.
2. **Query-key trap**, `logSanitization.ts:52-53` — `token`, `access_token`,
   `secret`, `password`, `api_key`, `code`, `state`, `credential`, `signature`
   in query strings.
3. **The audit-key trap**, `auditLog.ts:18-27` —
   `SENSITIVE_AUDIT_KEY_PATTERNS` = `/password/i`, **`/token/i`**, `/secret/i`,
   `/api[-_]?key/i`, `/key[-_]?hash/i`, `/^authorization$/i`,
   `/^credential$/i`, `/^signature$/i`. Applied via `isSensitiveAuditKey`
   (`:29-31`) inside `sanitizeAuditChanges` (`:53-58`), which
   `createAuditLog` calls at `:77`.

### 9.2 The naming hazard, restated because it is one comment away from a leak

`publicReleaseExecution.ts:220-226`, verbatim:

```
 * SECURITY — do NOT rename these keys. `tokenRecipient` / `tokenRecipientName`
 * match `sanitizeAuditChanges`'s `/token/i` pattern and are therefore stored
 * `[REDACTED]`. Renaming `tokenRecipient` to anything without "token" in it
 * would silently start persisting the recipient's EMAIL in the audit trail.
```

The keys are `tokenRecipientEmail` and `tokenRecipientName`
(`publicReleaseExecution.ts:211-212`), supplied at `publicBatchRoutes.ts:343-344`.
The correlation key deliberately named to *avoid* the trap is `releaseLinkIds`
(`publicBatchRoutes.ts:354`), with its own comment at `:348-351` explaining that
`tokenIds` would have been redacted and erased the correlation. **This is a
load-bearing naming convention protected only by a comment**, and Wave E adds
new audit keys (Rev 2 §4.2.7), which is the moment it is most likely to be
broken.

### 9.3 The finding: the trap is already partial, and the retention is forever

**Recipient emails are already persisted un-redacted in the audit log.**
`HP_RELEASE_REQUESTED` writes them, on both request paths, under a key the trap
does not match:

- `requestReleaseRoutes.ts:495` — `changes: { ..., notificationSentTo: recipient.email, ... }` (batch), with `userId: req.user!.userId` at `:483`
- `requestReleaseRoutes.ts:926` — `changes: { ..., notificationSentTo: normalizedNotificationSentTo, ... }` (single), with `userId: req.user!.userId` at `:917`

`notificationSentTo` matches **none** of the eight patterns at
`auditLog.ts:18-27`. So the row is written verbatim.

**And it is kept indefinitely.** `RETENTION_POLICIES.auditLogs = 7 * 365`
(`dataRetention.ts:14`, commented *"Audit trails (7 years for compliance)"*) is
**declared and never read** — the only occurrence of `auditLogs` in
`dataRetention.ts` and `dataRetentionWorker.ts` is that declaration.
`applyRetentionPolicies` (`:86-146`) never touches `auditLog`, and the docstring
at `:81` states the behaviour: *"Project, audit, NCR, lot and test data are
never auto-deleted."*

**Consequence for Rev 2 §4.2.7.** Its claim that automated-send rows would be
*"the first automation-written rows"* to persist a recipient email is accurate
about *automation* and misleading about *the audit log*. The precedent already
exists; what E2 changes is that a **system actor with no `userId`** starts
writing them, at hourly cadence, without a human having clicked anything.

**Is the existing behaviour a violation?** Not of §7.4 — §7.4 governs what the
*link* reveals, and the audit log is an internal, authenticated surface. It is a
**PII-retention** question: an external individual's email address, held forever,
in a table with no deletion path. That question is the same one item 16 raises
about suppression, and it is dispositioned to the same owner.

### Disposition

| Sub-item | Disposition | Owner | Exit condition |
|---|---|---|---|
| The three shipped traps | **Accept** — they work and Wave E must not weaken them. | Jay | `[E-B7]` (Rev 2 §6) plus **AT-109**: no audit key added by this wave escapes the `/token/i` trap. |
| The `tokenRecipient` rename hazard | **Mitigate before E2** — E2 adds audit keys (Rev 2 §4.2.7), which is when the convention breaks. | build agent | **AT-109** extended: the automated-send rows do **not** persist a bare recipient email under a non-trapped key, **and** the assertion is on the stored row read back from the database, not on the argument passed in. A grep-style assertion that `tokenRecipient`/`tokenRecipientName` still contain the substring `token` is acceptable as a second guard. |
| **Recipient emails already in `AuditLog.changes` un-redacted (`requestReleaseRoutes.ts:495`, `:926`), retained forever (`dataRetention.ts:14` dead, `:81`)** | **Accept for E1/E2 — as a recorded pre-existing condition, NOT as "documented".** It is not a §7.4 violation and E1/E2 neither create nor worsen it. **Mitigate before any privacy/DSR commitment** CIVOS makes to an external individual, and **Block** on any Wave E change that adds a *second* un-trapped recipient-email key. | Jay (accept the existing rows); build agent (hold the line) | AT-109's extension above is the line-holding test. The pre-existing condition's own remediation is **out of Wave E** and is named here so it is not rediscovered: either add `notificationSentTo` to `SENSITIVE_AUDIT_KEY_PATTERNS` (which would redact it on *every* row, including historic reads via `auditLog.ts:129`) or wire `RETENTION_POLICIES.auditLogs` to something. Both are behaviour changes to a compliance surface and need their own S. |

---

## 10. Item 10 — Blast radius, one sentence per phase

The worst outcome of **one leaked link**, per phase, and whether it is accepted.

| Phase | Worst outcome of one leaked link | Accepted? |
|---|---|---|
| **Today (baseline)** | Whoever holds it reads one hold point's full evidence package — including every other recipient's email (4a), the requester's email when `fullName` is null on the batch door (4d), internal staff names, lab names and the company's ABN and address — and can release that one hold point once, with a signature under a name of their choosing, producing an immutable record attributed to the wrong human. | **Accepted with three mitigations required (`E.0a`)** — 4a, 4c, 4d. The rest is item 4's `Accept` set. |
| **E.0** | None. Docs only. | Accept. |
| **E.0a** | Strictly reduces the baseline: three fields leave the public payload and the public PDF. New risk is a regression in the authed payload, which is why the authed test at `holdpoints.test.ts:311` must stay green **unchanged**. | Accept. |
| **E1** | **Unchanged from baseline for an external bearer** — E1 touches no public route and sends no external email. Its blast radius is *internal*: a mis-scoped canary creates alerts and in-app notifications for internal staff in the five `STALE_HOLD_POINT_ALERT_ROLES` (`notificationAlertConfig.ts:16-24`) across every active project, escalating to six roles (`:26`) twice (`:42`), from an unbounded scan (`systemAutomation.ts:278-288`) with an N+1 dedupe. | **Accept only with item 8's fail-closed canary and Rev 2 §4.1.3's four bounds.** Both are `Mitigate before E1`. |
| **E2** | Two increases, and they are real. **(a) More links exist**: tier-2 links are minted from `notificationSentTo` on an hourly cadence, so at any moment more live capabilities point at one hold point than today. **(b) Each is weaker**: a tier-2 token carries no `recipientName` (`schema.prisma:769` stores emails only), so the identity override at `holdpoints.ts:176-177` does not apply and the signer types their own name — `[E-l]`. A leak of a tier-2 link therefore yields the same read-and-release capability as today with *strictly less* attribution value. | **Accept, bounded by:** the per-generation cap (no cap exists today — §7.2), the digest and daily limit, the expiry predicate in the resolver (item 3), and the canary. All are `Mitigate before E2`. The **weaker attribution is not mitigated** — it is accepted and written into §7.6 and item 6. |
| **Successor slice (deferred)** | One leaked queue token would expose N hold points across a project. This is the step change and it is why the slice is deferred, why `[E-B8]` forbids dynamic capability union, and why the rate limiter (item 2) and per-lot evaluation (item 15) are its named preconditions. | **Block** — not dispositioned by this artifact beyond naming its preconditions. |

- **Disposition: Accept**, per row, with the `Mitigate` dependencies named in
  each row.
- **Owner:** Jay.
- **Exit condition (testable):** every Wave E PR body carries the row for its
  own phase, and E1's body additionally carries the first 24 hours of
  production alert-creation counts on the canary projects (Rev 2 exit item 4) —
  measured, not assumed.

---

## 11. Item 11 — Capability reissuance after expiry (`[ER-B6]`) · **Blocks E2**

### The problem, precisely

E2's recipient resolver mints a **fresh 48-hour capability** for an address
parsed out of `notificationSentTo` (Rev 2 §4.2.3, tier 2) — including after the
original token has expired **and been purged** (`dataRetention.ts:43-53`). Doing
that repeatedly, on an hourly schedule, with no human in the loop, is a policy
question: *for how long after the original ask does CIVOS keep manufacturing new
capabilities against a stale request?*

Today the manual path already does an unbounded version of this. There is **no
cap** (§7.2, no comparison against `chaseCount` anywhere) and **no expiry
predicate** in the resolver (`actionRoutes.ts:204-211`), so an expired token
seeds new chases until retention removes it — and outside production, retention
is off by default (`dataRetentionWorker.ts:29`), so *forever*.

### The ruling

Rev 2 §4.2.3 offers a proposal and explicitly declines to settle it. **This
artifact settles it**, ratifying the proposal with one addition:

1. **Who may reissue.** The automation worker, acting as a system actor
   (`recordDecision.ts:78-84`'s `{kind:'system'}` arm, which has no production
   caller yet), **and** any user in `HP_REQUEST_ROLES` via the manual chase
   route. No other caller.
2. **For how long.** Bounded by **two** conditions, both of which must hold:
   `chaseCount < MAX_CHASES_PER_REQUEST` **and** the reservation's
   `notificationSentAt: { equals: currentGenerationStart }` generation bound
   (corrected from `gte` on 2026-07-28 — deep review L1; a floor admitted the
   NEXT generation, so the bound was not the bound this row assumes)
   (Rev 2 §4.2.2). Reissuance is therefore bounded per **request generation**,
   not per row lifetime.
3. **What terminates it** — four events, each of which means the ask that
   justified the capability no longer exists:
   - **release** — the hold point leaves the awaiting-release status set, which
     the reservation predicate already excludes;
   - **a new release request** — `notificationSentAt` is rewritten, and the
     prior unused tokens are deleted in the same transaction
     (`requestReleaseRoutes.ts:393-397`, `:865-870`; the recipient list is
     rewritten at `:825`), starting a new generation and failing any in-flight
     stale reservation closed;
   - **project closure** — `assertProjectAllowsWrite` already gates both public
     doors (`holdpoints.ts:178`, `publicBatchRoutes.ts:296`); the job must apply
     the same gate before minting;
   - **the recipient list changing** — a recipient removed from
     `notificationSentTo` stops being a tier-2 target on the next pass, because
     the tier is derived from that column and not cached.
4. **The addition this artifact makes:** reissuance must **never** widen the
   capability. A reissued tier-2 token is minted against **one
   `holdPointId`** (`schema.prisma:807`) exactly as `createChaseReleaseTokens`
   does today (`actionRoutes.ts:118-126`). A reissuance that produced anything
   project-scoped would be `[E-B8]`'s forbidden dynamic union arriving through
   the back door.

### Disposition

- **Disposition: Mitigate before E2.** The rule above is the rule; E2 encodes it.
- **Owner:** Jay ratifies the policy (it is his risk); build agent encodes it.
- **Exit condition (testable):** **AT-118** as specified in Rev 2 §12 (an
  expired unused token is not selected from tier 1, asserted with the retention
  worker **disabled**), **plus** a test per termination event in clause 3 — four
  cases, each asserting the job mints **no** token: released hold point, new
  generation, closed project, recipient removed from `notificationSentTo`. A
  test suite covering only expiry does not discharge this item.

---

## 12. Item 12 — Shared mailbox, name and case collision · **Blocks E2**

### The evidence

**Casing is normalised for the map key and discarded for the stored value.**
`buildTokenChaseTargets` (`actionRoutes.ts:88-106`):

```
backend/src/routes/holdpoints/actionRoutes.ts:92-102
  const email = tokenRecipient.recipientEmail.trim();
  if (!email) continue;
  const key = email.toLowerCase();
  if (!tokenTargetsByEmail.has(key)) {
    tokenTargetsByEmail.set(key, {
      email,                              // <- first-seen casing, NOT `key`
      fullName: tokenRecipient.recipientName,
      secureToken: crypto.randomBytes(32).toString('hex'),
    });
  }
```

The lowercase form is used **only** as the dedup key at `:95`; the value stored
at `:98` is the trimmed original. `createChaseReleaseTokens` then writes that
casing straight to the column (`:121`). The same pattern exists on the request
path (Rev 2 §4.2.6 cites `requestReleaseRoutes.ts:744-761`). So
`Sam@x.com` and `sam@x.com` are **two stored values and one person**, and
`recipientName` is whichever name was seen first.

**Nothing binds a token to a human.** Token identity is `recipientEmail` plus an
optional `recipientName` (`schema.prisma:809-810`), no principal, no FK.

### The three collisions, ruled on

1. **Two humans share `info@`.** Both can open the link; either can sign; the
   record carries `recipientName` if the token has one (`holdpoints.ts:176-177`)
   and otherwise whatever was typed. **Ruling: CIVOS cannot distinguish them and
   must not pretend to.** The mitigation is honesty, not code: item 6's claim
   limit and §7.6. Wave E adds no mechanism here, and building one would be an
   accounts feature, which program line 110 forbids.
2. **One normalised address, two stored names.** **Ruling: for the daily-limit
   key, the name is irrelevant and the normalised email is the identity.** For
   the evidence record, the name on the *token that was actually presented*
   governs, which is already the shipped behaviour at `holdpoints.ts:176-177`.
   These two answers are consistent because they answer different questions:
   *how much mail does this mailbox get* versus *whose name is on this
   signature*.
3. **Casing variants.** **Ruling: normalise at the point of every
   recipient-keyed decision.** For E2 that means exactly one place — the daily
   limit's key must be `recipientEmail.toLowerCase()`, so `Sam@x.com` and
   `sam@x.com` count as one recipient against the cap. **A repo-wide
   normalisation backfill is NOT an E2 deliverable**: it would rewrite stored
   `recipientEmail` values on a table the retention worker prunes, for no E2
   behaviour change, and Rev 2 §4.3.2 correctly assigns it to the successor
   slice where a recipient-keyed *lookup* first exists.

### Disposition

| Sub-item | Disposition | Owner | Exit condition |
|---|---|---|---|
| The daily-limit key must be case-normalised | **Mitigate before E2** | build agent | **AT-116**'s casing clause specifically: `Sam@x.com` and `sam@x.com` count as **one** recipient against `MAX_REMINDER_EMAILS_PER_RECIPIENT_PER_PROJECT_PER_DAY`. |
| Shared mailbox = indistinguishable humans | **Accept** — ruled above; the mitigation is the stated claim limit, not a mechanism. Jay accepts. | Jay | Item 6's exit condition (the §7.6 sentence and AT-115's named fallback). |
| Two names on one normalised address | **Accept for E2** — the presented token's name governs the signature; the normalised email governs the mail cap. | Jay | AT-116 (cap) plus the shipped `holdpoints.ts:176-177` behaviour, unchanged (`[E-B10]`). |
| **Normalisation backfill and a real principal** | **BLOCK the successor slice entirely.** No recipient-keyed *lookup* may be built on a column that stores mixed casing and no principal. | successor slice's build agent | Rev 2 §4.3.2's required negative tests, as its own precondition: a forwarded queue token cannot view or release outside its membership set; two recipients with the same normalised email but different names cannot cross-sign; casing variants resolve deterministically to one principal. Plus the backfill migration. |

---

## 13. Item 13 — Chase reservation concurrency and cap grain · **Blocks E2**

### The evidence

**The manual chase guard is a read-then-write, and there is no cap.**

```
backend/src/routes/holdpoints/actionRoutes.ts:721   const existingHP = await prisma.holdPoint.findUnique({ where: { id } });
backend/src/routes/holdpoints/actionRoutes.ts:733     throw AppError.notFound('Hold point');
backend/src/routes/holdpoints/actionRoutes.ts:745   if (existingHP.status === 'released') {
backend/src/routes/holdpoints/actionRoutes.ts:746     throw AppError.badRequest('Released hold points cannot be chased.');
backend/src/routes/holdpoints/actionRoutes.ts:749   const holdPoint = await prisma.holdPoint.update({ where: { id },
backend/src/routes/holdpoints/actionRoutes.ts:752       chaseCount: { increment: 1 },
backend/src/routes/holdpoints/actionRoutes.ts:753       lastChasedAt: new Date(),
```

Read at `:721`, checked at `:745`, written at `:749` with a bare
`where: { id }` — two concurrent chases both pass and both send. **No
comparison against `chaseCount` exists anywhere in the codebase** (§7.2's
14-hit grep). Note also that `:745` guards only `'released'`, so
`'completed'` is chaseable today — unlike the release paths, which guard
`notIn: ['released','completed']` (see `publicReleasePayload.ts:152`'s
`canRelease` and the terminal-status rejection at `holdpoints.ts:173`).

The correct pattern is already used elsewhere in the same file and in the
release path — the guarded `updateMany` at `publicReleaseExecution.ts:76-89`
whose `count !== 1` check at `:91` is the whole defence.

### The ruling

Rev 2 §4.2.2 proposes generation-scoped grain and no-consume-on-failure and
asks E.0 to ratify or override. **Ratified, all three clauses:**

1. **Grain: per request generation, not per row lifetime.** `chaseCount`
   accumulates over a row that is never replaced — the hold point is unique per
   `[lotId, itpChecklistItemId]` (`schema.prisma:800`) — so a lifetime cap
   means the third re-request of a long-running hold point gets zero reminders.
   The generation identifier is `notificationSentAt` (`schema.prisma:768`),
   which **is** rewritten on every request (written `requestReleaseRoutes.ts:825`
   in the same transaction that writes `notificationSentTo`). Ratified because
   it needs no migration and no second monotonic value.
2. **A failed send does not consume an attempt; a suppressed send does.**
   Ratified. Failure is a transport problem and retrying is correct; suppression
   is a delivery *decision* and retrying it is not. The rollback pattern already
   exists — `revokeFreshChaseReleaseToken` (`actionRoutes.ts:147`) is called on
   send failure at `:815` and `:818`.
3. **One atomic reservation shared by the route and the job.** Ratified, and
   **the `completed` gap is closed as part of it**: the reservation predicate's
   `status: { in: [...AWAITING_RELEASE_HOLD_POINT_STATUSES] }` excludes both
   `released` and `completed`, which is a deliberate behaviour change to the
   manual route and must be asserted as intended, not slipped in.

**One addition.** The reservation must be the **only** writer of `chaseCount`
and `lastChasedAt`. If the bare `update` at `actionRoutes.ts:749` survives
anywhere — including in an error path — the atomicity is decorative.

### Disposition

- **Disposition: Mitigate before E2.**
- **Owner:** Jay ratifies the grain (it is a product-behaviour call); build agent
  implements.
- **Exit condition (testable):** **AT-114** exactly as Rev 2 §12 specifies — a
  **real database concurrency test** driving the manual chase route and the
  automation job against one hold point simultaneously and asserting **exactly
  one** send; plus after `MAX_CHASES_PER_REQUEST` sends a new release request
  resets the generation and the hold point qualifies again; plus a failed send
  does not consume an attempt and a suppressed one does. **Plus AT-100**'s
  characterization of the extraction, in which the newly-enforced cap, cooldown
  and `completed` guard are each asserted as *intended* changes. **Plus** a grep
  assertion that no bare `chaseCount` increment survives outside the shared
  reservation.

---

## 14. Item 14 — Durable requester authority for `replyTo` · **Blocks E2**

### The evidence

**A durable requester already exists on both paths** — this is why Rev 2 needs
no new column (§4.2.4, §4.2.5):

- `HoldPointReleaseBatch.requestedByUserId` (`schema.prisma:843`), written at
  `requestReleaseRoutes.ts:365`, read at `publicBatchRoutes.ts:104-109` — **batch
  path only**.
- An `HP_RELEASE_REQUESTED` audit row carrying `userId: req.user!.userId` on
  **both** paths: `requestReleaseRoutes.ts:483` (batch, inside the
  `Promise.all` at `:479-501`) and `:917` (single, block `:916-935`). Both
  `entityType: 'hold_point'` with `entityId` the hold point.
- Audit rows are retention-exempt: `applyRetentionPolicies`
  (`dataRetention.ts:86-146`) never touches `auditLog`, and `:81` states it.
  (Note item 9's finding: that exemption is *total*, not the 7 years
  `dataRetention.ts:14` declares and nothing reads.)

**And the reply path does not exist.** `EmailOptions` has no `replyTo`
(`email.ts:51-58`); the Resend payload passes none (`email.ts:173-180`); a
case-insensitive grep for `replyto|reply_to` across `backend/src` returns
**zero hits**.

**And today's chase email attributes the request to the recipient.**
`chaseNotifications.ts:77` builds the template context; Rev 2 §4.2.6 identifies
`chaseNotifications.ts:81` setting `requestedBy` from
`context.notificationSentTo` — the **recipient** list — so the current chase
email tells the superintendent the request came from the superintendent's own
address. That is a live correctness defect, not a Wave E risk.

### The questions, ruled on

**May a `replyTo` address a user who has since left the company?** Ruled: **no
special case — the fallback handles it, and the body must name the fallback.**
Reasons:

1. `AuditLog.user` is `onDelete: SetNull`, so a deleted requester's `userId`
   goes null and the lookup finds no user. That is already a fallback path, not
   a new one.
2. An *inactive but not deleted* user is the harder case, and the honest answer
   is that CIVOS should not invite a reply to a mailbox nobody reads. The
   resolver must treat **missing or inactive** identically and fall back.
3. **What it must not do is silently attribute the request to support.** A
   superintendent reading *"Requested by: CIVOS Support"* about a hold point a
   named engineer asked for is being told something false. `[E-B8b]`
   (Rev 2 §6) is the invariant: *no email attributes a request to someone who
   did not make it.* The body must say the original requester is unavailable and
   that replies go to the company's support address.

**What is the fallback?** Ratified as Rev 2 §4.2.4 proposes: the project's
company support address, for both the missing/inactive-user case and the
no-audit-row case (a hold point requested before the audit action existed).
Both logged.

**The audit lookup rather than a column** is ratified on Rev 2 §4.2.5's
argument, which this artifact verified: complete history on both paths already,
no migration, generation-correct by construction via the
`createdAt >= notificationSentAt` bound, and retention-exempt. The one cost is
query time, which is bounded by E2's per-pass cap and must be **measured**
(Rev 2 exit item 11), not assumed.

### Disposition

- **Disposition: Mitigate before E2.**
- **Owner:** Jay ratifies the fallback identity (it is his support address that
  appears in front of a client); build agent implements.
- **Exit condition (testable):** **AT-115** exactly as Rev 2 §12 specifies —
  `replyTo` and "Requested By" resolve to the user who made the **current**
  generation, asserted on the **single**-request path (which has no
  `requestedByUserId`, so it can only pass via the audit lookup); a deleted
  requester falls back to company support **and the body names it as a
  fallback**; a hold point with no `HP_RELEASE_REQUESTED` row falls back rather
  than throwing. **Plus AT-110** for the transport plumbing. **Plus** a case
  asserting an **inactive** (not deleted) requester also falls back — Rev 2's
  AT-115 text covers deleted and missing, not inactive, and clause 2 above makes
  inactive a required case.

---

## 15. Item 15 — Cross-lot immutable-evidence correctness (`[ER-B9]`) · **Blocks the successor slice**

### The evidence, verified at this SHA

Three separate places assume one lot per decision:

1. **Sufficiency resolves against the batch's single anchor lot.**
   `publicBatchRoutes.ts:315`:
   `const releaseSufficiency = await resolveHoldPointReleaseSufficiency(batch.lotId);`
   — with the comment at `:311-313` stating the assumption outright: *"one
   advisory for the whole batch — every member shares the batch's lot"*. True
   today, because a batch is created against one `lotId`.
2. **`outstandingSiblings` counts against a single scalar `lotId`.**
   `releaseDecision.ts:98-104`:
   `tx.holdPoint.count({ where: { lotId, id: { notIn: [...holdPointIds] }, status: { notIn: TERMINAL_HOLD_POINT_STATUSES } } })`.
3. **One `result` is stamped on every member's immutable snapshot.**
   `releaseDecision.ts:125-136`: `const result = buildHoldPointReleaseResultV1(evaluation);`
   is computed **once** at `:129` and spread into every row at `:135`. The
   docstring at `:119-121` says this is deliberate: *"Every row carries the SAME
   `result`, and that is the point: one decision has one readiness verdict."*
4. **The audit row's `projectId` derives from the batch's lot** —
   `publicBatchRoutes.ts:323`, `projectId: project.id`, where `project` is
   `batch.lot.project` (`:292`).

### The ruling

**All four are *correct* for the shipped single-lot batch and *wrong* the moment
a selection spans lots.** A cross-lot release on today's code would silently
stamp the anchor lot's sufficiency verdict and outstanding-sibling count onto
every other lot's **immutable** snapshot — an evidence-integrity defect, in the
one table whose value is that it is never rewritten.

**Nothing in E1 or E2 touches any of it.** E1 changes an alert predicate; E2
adds a job, a reservation, a resolver tier and an index. Neither goes near
`releaseDecision.ts`, `publicBatchRoutes.ts` or `recordDecision` — `[E-B10]`
makes that a mechanical check.

**The rule for the successor slice, ruled rather than left open:** group the
selected hold points by their own `lotId`, resolve sufficiency **per lot**,
evaluate **per lot**, and build each item's snapshot from **its own** lot's
evaluation. `holdPointReleaseSnapshots` (`releaseDecision.ts:125-136`) is the
function that changes, and it must take a per-lot evaluation map rather than one
evaluation. A cross-**project** selection must be rejected outright.

Rev 2 §4.3.3 offers an alternative — prohibit multi-lot selection in one
decision, one signature per lot. **This artifact's preference, stated so the
successor does not have to relitigate it: take the prohibition first.** It is
honest, it is a guard rather than a rewrite of the snapshot writer, and it keeps
the immutable-evidence path untouched. A worse UX that cannot record a false
verdict beats a better UX that can.

### Disposition

- **Disposition: Accept for E1/E2** (neither touches it, and `[E-B10]` proves
  it) · **BLOCK the successor slice** until per-lot evaluation or the multi-lot
  prohibition ships.
- **Owner:** Jay accepts the E1/E2 position; the successor slice's build agent
  owns the block.
- **Exit condition (testable):** for E1/E2, the `[E-B10]` mechanical check shows
  `releaseDecision.ts`, `publicBatchRoutes.ts` and `recordDecision.ts` absent
  from the wave's diff. For the successor slice, Rev 2 §4.3.3's test: a DB test
  with **two lots whose sufficiency verdicts and outstanding-sibling counts
  deliberately differ**, asserting each hold point's snapshot carries **its
  own** lot's verdict. That test must **fail on today's code** — if it passes
  before the change, it is not testing the thing.

---

## 16. Item 16 — Suppression storage and retention · **Blocks E2's suppression handling only**

### The evidence

There is **no suppression of any kind** today. `NotificationEmailPreference` is
keyed on `userId` with a hard FK to `User` (`schema.prisma:283-309`), so it
cannot express a preference for a non-user; the chase email goes straight to the
resolved `recipientEmail` with no preference check
(`actionRoutes.ts:759-822` → `chaseNotifications.ts`). There is exactly one
transport (`resend.emails.send`, `email.ts:173`); the other branches in that
function are the disabled short-circuit, the production fail-closed and a
dev/test mock.

### The question and the ruling

Rev 2 §4.2.6 requires suppression *handling* and defers to E.0 whether it needs
a **table**, because a table means holding an external individual's email
address for a **negative** reason, indefinitely — and item 9's finding shows
CIVOS's one indefinite store (`AuditLog`) has no deletion path at all
(`RETENTION_POLICIES.auditLogs` declared at `dataRetention.ts:14`, never read;
`:81` states audit data is never auto-deleted).

**Ruling: provider read first. No CIVOS suppression table in E2.** Reasons, in
order:

1. **Resend already holds the suppression state.** It is the authority on
   whether an address hard-bounced or complained, because it is the party that
   observed it. A CIVOS table would be a **cache of someone else's truth** that
   can only ever be staler.
2. **A table is a new PII store with no retention story**, in a codebase whose
   existing indefinite store already has none (item 9). Adding a second before
   fixing the first is how a compliance problem doubles.
3. **The minimum honest implementation is small:** a suppression check at send
   time plus an audited skip (Rev 2 §4.2.6, §4.2.7). No schema, no migration, no
   backfill, no retention policy to write.
4. **The cost of being wrong is bounded and recoverable.** If the provider read
   turns out to be too slow or rate-limited for an hourly job, the fix is a
   short-TTL in-memory cache in the worker process — which stores nothing
   durably and therefore raises no retention question. That is the escalation
   path, and it is smaller than a table.

**Flip condition, so a successor does not treat this as permanent:** if CIVOS
ever needs suppression state the provider does not hold — a recipient asking
CIVOS directly to stop, rather than bouncing — then a table becomes necessary,
and it ships **with** a retention policy in the same PR, not after.

### Disposition

- **Disposition: Mitigate before E2's suppression handling** (a provider read
  plus an audited skip) · the **table** is **Blocked** and stays blocked until
  the flip condition above is met.
- **Owner:** Jay ratifies (it is a PII decision in his company's name); build
  agent implements the check.
- **Exit condition (testable):** **AT-116**'s suppression clause — a suppressed
  address receives nothing and the skip is audited — **plus AT-117**'s
  requirement that a **suppressed** send writes an audit row with a distinct
  outcome, **plus AT-114**'s clause that a suppressed send **consumes** an
  attempt while a failed send does not (item 13, clause 2). **Plus** a grep
  assertion that no new Prisma model storing an email address was added by E2
  (`[E-B10]`'s schema check already covers the migration; the wave's only schema
  change is `@@index([holdPointId])` on `HoldPointReleaseToken`, Rev 2 §5).

---

## 17. `E.0a` — the prerequisite remediation PR

Rev 2 §9 reserves `E.0a` as a named PR slot and forbids it being silently
skipped: *"If E.0 dispositions every item Accept or Mitigate-before-successor-slice,
E.0a is empty and is closed with that sentence in its place."*

**`E.0a` is NOT empty.** Three current §7.4 violations are dispositioned
`Mitigate before E2` in item 4. Its scope is exactly these, and nothing else:

| # | Change | Files | Test change |
|---|---|---|---|
| 1 | Stop passing `notificationSentTo` into the **public** payload (4a) | `backend/src/routes/holdpoints/publicReleasePayload.ts:137` | `backend/src/routes/holdpoints.test.ts:2554` inverted from `toHaveProperty` to an **absence** assertion — the first negative assertion on a public payload in the repo |
| 2 | The public PDF stops rendering `Recipient of Record` (4c) | starved automatically by change 1, because the renderer reads `data.notificationSentTo` (`frontend/src/lib/pdf/holdPointEvidencePdf.ts:44-45`) | a new assertion that the row is **absent** from the public PDF, and a confirmation that the **authed** PDF still renders it |
| 3 | `batch.requestedBy` drops its `email` fallback arm (4d) | `backend/src/routes/holdpoints/publicBatchRoutes.ts:142` (`requestedByUser?.fullName \|\| requestedByUser?.email \|\| null`) | `backend/src/routes/holdpoints/publicBatchRoutes.test.ts:269` **stays** (it asserts the `fullName` case); a **new** case with `fullName: null` asserts the response body contains no `@` |

**Explicitly NOT in `E.0a`:**

- `holdpoints.test.ts:311` — the **authenticated** evidence-package assertion.
  It must stay green **unchanged**. §0.2 corrects Rev 2's citation; internal
  staff seeing the recipient list is not a §7.4 violation.
- `holdpoints.test.ts:2552` — the public `company?.name` assertion. Item 4f
  `Accept`s company branding on the public payload; this test is not a target.
- `batch.recipient.email` (`publicBatchRoutes.ts:145-148`) and
  `tokenInfo.recipientEmail` (`publicReleasePayload.ts:149`) — items 4b and 4e
  `Accept`. The bearer's own address is not *"any other person's"*.
- Staff names, lab names, company ABN/address/logo, raw UUIDs — items 4f, 4g,
  4h `Accept`; 4i `Accept` for this wave.

**Blocking relationship:** `E.0a` blocks **E2**, not E1. E1 sends no external
email and touches no public payload, so it may merge with `E.0a` still open.
E2 is the phase that increases the rate at which these links are delivered, so
it may not.

**A second remediation PR is named and is NOT `E.0a`:** item 8's fail-closed
canary parser. It is `Mitigate before E1` and belongs **inside E1** (it is part
of the canary Rev 2 §4.1.3 already scopes to E1), not in a separate PR. It is
listed in §18 so it cannot be lost.

---

## 18. The E.0 verdict table

Every item, its disposition, owner and testable exit condition. Sub-items are
listed where the parent item splits.

| # | Item | Disposition | Owner | Testable exit condition |
|---|---|---|---|---|
| 1 | Capability model, before/after | **Accept** | Jay | `[E-B10]` mechanical check: no public route file, no new model, in the wave's diff |
| 2a | Enumeration vs the global limiter, for E1/E2 | **Accept** | Jay | `[E-B10]` check |
| 2b | Dedicated `/api/holdpoints/public/*` limiter | **Mitigate before successor slice** | build agent | limiter at `server.ts:159` + the first rate-limit test on these routes |
| 2c | 404-vs-410 existence oracle | **Accept** (ruled: keep) | Jay | §2.4 ruling + `publicReleasePayload.ts:94-107` unchanged |
| 3a | 48-hour expiry constant | **Accept** | Jay | `tokens.test.ts:28` green; `tokens.ts` untouched |
| 3b | Guarded claim as replay defence | **Accept** | Jay | `publicReleaseExecution.ts:76-89` untouched; double-spend tests green |
| 3c | Three implicit revocation paths, no explicit endpoint | **Accept** (ruled: no revoke endpoint) | Jay | §3.3 ruling; no revoke route in the wave |
| 3d | Missing `expiresAt` in the chase resolver | **Mitigate before E2** | build agent | **AT-118**, asserted with the retention worker disabled |
| 4a | `notificationSentTo` on the public payload | **Mitigate before E2 → `E.0a`** | build agent | `holdpoints.test.ts:2554` inverted to an absence assertion |
| 4b | `tokenInfo.recipientEmail` | **Accept** | Jay | §4.2 row 4b |
| 4c | Public PDF renders `notificationSentTo` | **Mitigate before E2 → `E.0a`** | build agent | absence assertion on the public PDF; authed PDF confirmed unchanged |
| 4d | `batch.requestedBy` falls back to a staff **email** | **Mitigate before E2 → `E.0a`** | build agent | new `fullName: null` case asserting no `@` in the response |
| 4e | `batch.recipient.email` / `.name` | **Accept** | Jay | §4.2 row 4e |
| 4f | Company name, ABN, address, logo data URL | **Accept** | Jay | `holdpoints.test.ts:2552` green unchanged |
| 4g | Internal staff full names | **Accept** | Jay | §4.2 row 4g; fields in the `[E-B10]` untouched set |
| 4h | Laboratory names and report numbers | **Accept** | Jay | §4.2 row 4h |
| 4i | Raw `project.id` / `lot.id` UUIDs | **Accept for E1/E2; Mitigate before successor slice** | Jay; successor build agent | `[E-B10]` now; **AT-111** (absence) for the successor |
| 5 | Post-spend / post-decision read window | **Accept** (bounded at 48 h by the shipped expiry check) | Jay | `holdpoints.test.ts:3389-3392` green unchanged |
| 6a | Link possession as the credential; forwarding; shared mailbox | **Accept** | Jay | §6.1 + `[E-B10]` |
| 6b | GET purity is untested | **Mitigate before E1** | build agent | **AT-112** — GET and HEAD on every public route, asserted by re-reading the DB |
| 6c | ETA claim limit + the tier-2 weakness | **Accept, conditional on the limit being written** | Jay | §7.6 sentence; **AT-115** names the fallback; Clancy mirror updated |
| 7a | Cadence, per-generation cap, digest, daily limit | **Mitigate before E2** | build agent | **AT-102**, **AT-114**, **AT-116** |
| 7b | No `List-Unsubscribe` / no unsubscribe for a non-user | **Accept for E2, conditional on 7e** | Jay | Jay's written §7.3 position, in the E2 PR body |
| 7c | `replyTo` reaching a human | **Mitigate before E2** | build agent | **AT-110** — four payload sites incl. `requestReleaseRoutes.ts:457-462` |
| 7d | Domain-reputation risk to all CIVOS mail | **Mitigate before E2** | build agent | E2 PR body states messages/recipient/day before and after the digest |
| 7e | **Spam Act 2003 characterisation** | **BLOCK on any send outside the canary allowlist** | **Jay** | a dated written position naming who was consulted, or Jay's acceptance in his own name. **No legal conclusion in any CIVOS document.** |
| 8a | No new external-facing query surface in E1/E2 | **Accept** | Jay | `[E-B10]` check |
| 8b | Automation cannot cross a project boundary | **Accept** | Jay | **AT-113** |
| 8c | **Canary allowlist fails OPEN when unset** | **Mitigate before E1** | build agent | **AT-113 extended**: unset, `''` and `','` each create **zero** alerts with an eligible hold point present |
| 9a | The three shipped redaction traps | **Accept** | Jay | `[E-B7]` + **AT-109** |
| 9b | `tokenRecipient` rename hazard | **Mitigate before E2** | build agent | **AT-109 extended** — assert on the stored row, plus a substring guard on the key names |
| 9c | **Recipient emails already un-redacted and indefinite in `AuditLog`** | **Accept as a recorded pre-existing condition; Block any second un-trapped key** | Jay; build agent | AT-109's extension holds the line. Remediation named in §9 and scoped **out** of Wave E |
| 10 | Blast radius per phase | **Accept** (per-row, with the named `Mitigate` dependencies) | Jay | each PR body carries its phase's row; E1's carries the first 24 h of real alert counts |
| 11 | Capability reissuance after expiry | **Mitigate before E2** (ruled: generation-bounded, four termination events, never widening) | Jay ratifies; build agent encodes | **AT-118** + one test per termination event (released / new generation / closed project / recipient removed) |
| 12a | Daily-limit key must be case-normalised | **Mitigate before E2** | build agent | **AT-116**'s casing clause |
| 12b | Shared mailbox = indistinguishable humans | **Accept** (ruled: honesty, not mechanism) | Jay | item 6's exit condition |
| 12c | Two names on one normalised address | **Accept for E2** | Jay | AT-116 + `holdpoints.ts:176-177` unchanged |
| 12d | **Normalisation backfill + a real principal** | **BLOCK the successor slice** | successor build agent | Rev 2 §4.3.2's three negative tests + the backfill migration |
| 13 | Chase reservation concurrency and cap grain | **Mitigate before E2** (ruled: per generation; failed send does not consume, suppressed does; one shared atomic reservation, `completed` excluded) | Jay ratifies; build agent implements | **AT-114** (real concurrency test) + **AT-100** + a grep that no bare `chaseCount` increment survives |
| 14 | Durable requester authority for `replyTo` | **Mitigate before E2** (ruled: audit lookup; company support fallback; inactive treated as missing; fallback **named** in the body) | Jay ratifies; build agent implements | **AT-115** + **AT-110** + a new **inactive-requester** case |
| 15 | Cross-lot immutable-evidence correctness | **Accept for E1/E2; BLOCK the successor slice** | Jay; successor build agent | `[E-B10]` now; the two-lot DB test that **must fail on today's code**, for the successor |
| 16 | Suppression storage and retention | **Mitigate before E2's suppression handling** (ruled: provider read, **no table**) | Jay ratifies; build agent implements | **AT-116** suppression clause + **AT-117** distinct outcome + **AT-114** consume-on-suppression + no new email-storing model |

### Counts

**42 dispositioned rows across the 16 items.**

| Disposition | Count | Rows |
|---|---|---|
| **Accept** | 20 | 1, 2a, 2c, 3a, 3b, 3c, 4b, 4e, 4f, 4g, 4h, 5, 6a, 6c, 8a, 8b, 9a, 10, 12b, 12c |
| **Accept for E1/E2, Mitigate or Block later** | 3 | 4i (Mitigate before successor), 9c (Block a second un-trapped key), 15 (Block successor) |
| **Accept conditional on another row** | 1 | 7b — conditional on 7e |
| **Mitigate before E1** | 2 | 6b, 8c |
| **Mitigate before E2** | 13 | 3d, 4a, 4c, 4d, 7a, 7c, 7d, 9b, 11, 12a, 13, 14, 16 |
| **Mitigate before the successor slice** | 1 | 2b |
| **BLOCK** | 2 | **7e** — Spam Act, blocks any send outside the canary allowlist · **12d** — blocks the successor slice entirely |

Of the 13 `Mitigate before E2` rows, **three are `E.0a`** (4a, 4c, 4d — §17) and
the remaining ten land inside E2's own PR.

**Blocking summary, by phase:**

- **E1 is buildable** once rows **6b** and **8c** are satisfied. Both are tests
  and a parser inside E1's own PR. Nothing blocks E1.
- **E2 is buildable** once `E.0a` (§17) has merged and rows **3d, 7a, 7c, 7d,
  9b, 11, 12a, 13, 14, 16** are satisfied. **E2 may not be enabled for any
  project Jay has not personally named** until row **7e** is dispositioned by
  Jay.
- **The successor slice is BLOCKED** on rows **2b, 4i, 12d, 15**.

---

## 19. NOT FOUND — stated so nobody re-searches

Verified absent at `415af44a`, each by grep or by reading the file:

- **Any threat-model artifact under `docs/`** other than this one. Confirmed
  by Rev 2 §7.1's own NOT FOUND and unchanged at this SHA.
- **Any dedicated rate limiter on `/api/holdpoints/public/*`** —
  `server.ts:159` mounts the router bare.
- **Any test asserting a rate limit on those routes** — zero `rateLimit` hits
  across `src/routes/holdpoints.test.ts` and `src/routes/holdpoints/*.test.ts`.
- **Any test asserting a public GET does not mutate.** The two near-misses
  (`holdpoints.test.ts:2615`, `:2727`) both follow **rejected POSTs** (403 at
  `:2606`, 400 at `:2715`), not GETs.
- **Any test asserting a public payload field is absent.** Three assert the
  opposite: `holdpoints.test.ts:2552`, `:2554`,
  `publicBatchRoutes.test.ts:269-273`.
- **Any explicit token-revocation endpoint** — only the internal helpers
  `actionRoutes.ts:129` and `:147`.
- **Any `expiresAt` predicate in the chase recipient resolver** —
  `actionRoutes.ts:204-211` filters on `holdPointId` and `usedAt` only;
  `expiresAt` appears in that file solely as the write at `:124`.
- **Any comparison against `chaseCount`** — 14 non-test hits, all display,
  context, or the `:752` increment.
- **Any `replyTo` or `reply_to` anywhere in `backend/src`** — zero hits.
  `EmailOptions` (`email.ts:51-58`) has no such field; the Resend payload
  (`:173-180`) passes no reply header.
- **Any `List-Unsubscribe` header or unsubscribe mechanism** — zero hits.
- **Any second email transport** — one `resend.emails.send` at `email.ts:173`.
- **Any index on `HoldPointReleaseToken.recipientEmail` or `.holdPointId`** —
  the model's only secondary index is `@@index([batchId])`
  (`schema.prisma:826`).
- **Any `projectId` on `HoldPointReleaseBatch`** — the model is
  `schema.prisma:833-851` and has none.
- **Any read of `RETENTION_POLICIES.auditLogs`** — declared at
  `dataRetention.ts:14`, referenced nowhere.
- **Any production caller of `recordDecision`'s `{kind:'system'}` actor arm** —
  E2 would be the first (Rev 2 §2.2, §4.2.7).

---

## 20. For Jay — what needs you, and nothing else does

Eight rows in §18 name **Jay** as the owner of an *acceptance*. Those need a
sentence in a PR body, not a decision — the reasoning is in the item.

**Three need you to actually decide something:**

1. **Row 7e — the Spam Act 2003 position. This is the only true `Block` that
   touches E2's usefulness.** E2 can be built and can run inside a canary you
   name. It cannot be turned on for a project you have not personally named
   until you record a written position — either having asked counsel, or
   accepting the risk in your own name. §7.3 lays out six facts and one
   hypothesis for counsel. **Nothing in this document reaches a legal
   conclusion, and nothing in CIVOS may.** J5-style review.
2. **Row 11 — reissuance policy ratification.** §11 rules it: bounded by
   generation and `MAX_CHASES_PER_REQUEST`, terminated by four named events,
   never widening the capability. You ratify because it is your company
   manufacturing capabilities against a stale ask.
3. **Row 14 — the fallback identity for `replyTo`.** §14 rules it: the
   company support address, with the body **naming** it as a fallback rather
   than attributing the request to support. You ratify because it is your
   support address appearing in front of a client's superintendent.

**Two things you should know that are not decisions:**

- **PR #1651 (Wave E spec Rev 2) is not merged.** This artifact discharges a
  sixteen-item list that exists only on that branch. Merge #1651 before or with
  this PR.
- **Rev 2 has one citation error worth knowing about**, corrected in §0.2:
  `holdpoints.test.ts:311` is the *authenticated* route, not the public one, so
  `E.0a` is narrower and cleaner than Rev 2 §9 describes — the authed payload
  keeps `notificationSentTo` and its test stays green untouched.

---

## 21. Verification notes

Every `file:line` above was opened in this worktree at
`415af44aab2ff6d09a66a88c82202c0c3e1008ce`. The claims most likely to be
doubted, and how each was established:

1. **No dedicated limiter on the public routes, and no test.** Read
   `server.ts:115` (global mount), `:140` and `:162-163` (the narrower siblings
   that *are* mounted), `:159` (the hold-point mount, bare). Numbers read from
   `rateLimiter.ts:47-48`. Test absence established by grepping `rateLimit`
   across `src/routes/holdpoints.test.ts` and `src/routes/holdpoints/*.test.ts`
   — zero hits.
2. **`holdpoints.test.ts:311` is the authed route.** Established by reading
   `:299-301` — `.get('/api/holdpoints/${holdPoint.id}/evidence-package')`
   `.set('Authorization', 'Bearer ${authToken}')` — and the in-file comment at
   `:307-308`. The public equivalent was then located at `:2531-2554`, whose
   request at `:2532` carries no auth header. Separability established by
   grepping the three non-test callers of `buildHoldPointEvidencePackage`:
   `publicReleasePayload.ts:122`, `readRoutes.ts:353`, `readRoutes.ts:527`.
3. **The canary can fail open.** Read `notificationAutomation.ts:172-175` (the
   `[]` branch) and `:188-191` (the `undefined` branch), plus the deliberate
   no-default-cap comment at `:177-181`.
4. **Recipient emails are already in the audit log un-redacted.** Read
   `requestReleaseRoutes.ts:495` and `:926` (the writes), then
   `auditLog.ts:18-27` (the eight patterns) and `:29-31`, `:53-58`, `:77` (the
   application). `notificationSentTo` matches no pattern.
5. **`RETENTION_POLICIES.auditLogs` is dead.** Read the declaration at
   `dataRetention.ts:14`, then grepped `auditLogs` across `dataRetention.ts`
   and `dataRetentionWorker.ts` — one hit, the declaration. Corroborated by
   `:81`'s docstring and by `applyRetentionPolicies` (`:86-146`) never naming
   `auditLog`.
6. **No cap on the chase.** Grepped `chaseCount` across non-test `src/`: 14
   hits, classified individually — six in `holdPointTemplates.ts`, two in
   `email.ts`, four in `chaseNotifications.ts`, three in `actionRoutes.ts`
   (`:752` increment, `:788` email context, `:834` audit payload). No comparison
   operator anywhere.
7. **GET purity holds but is untested.** `usedAt` is written only at
   `publicReleaseExecution.ts:82-83`, inside the guarded claim reached from the
   POSTs. The two candidate tests were read in context and both follow rejected
   POSTs (§19).
8. **Cross-lot stamping.** Read `publicBatchRoutes.ts:315` (single anchor lot),
   `releaseDecision.ts:98-104` (scalar `lotId` count) and `:125-136` (one
   `result` computed at `:129`, spread at `:135`), plus the docstring at
   `:119-121` that states the single-verdict assumption deliberately.
