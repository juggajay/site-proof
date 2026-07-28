# Wave D `D1b.0` — Threat model: the gate before any D1b code

**Date:** 28 July 2026 · **Status:** the blocking pre-build gate required by
`docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 **§4.3.4**, **§10.6** and
**exit-gate item 8** (*"`D1b.0`'s threat model merged before D1b code"*).
**Docs only. No D1b code PR may merge until this artifact merges.**

Program §7 line 134 gated a threat model before **D2**. D2 is deleted (spec §5),
and `[DR2-B4]` showed the gap was already shaping an unsafe boundary — so the
gate is pulled forward to `D1b.0` and covers **D1b and D1c**. It follows the
`docs/plans/wave-e0-threat-model-2026-07-28.md` pattern deliberately: a written
artefact, one section per threat, evidence read at a stated SHA, and every item
terminating in a disposition with a named owner and a **testable** exit
condition.

**Every `file:line` in this document was opened in this worktree at
`0adf76f8` (= `origin/master`, *"feat(d1b0): Logan PSP5 requirement profile +
crosswalk — folio groundwork (valved) (#1679)"*).** Nothing is quoted from
memory or from the spec's citation list. The benchmark numbers in §10 were
measured at `7e28b0a3` on this branch, which adds `scripts/bench-pdf-folio.mjs`
and one dependency and touches no file under `backend/src`.

**Provenance of the thing being modelled.** D1b does not exist yet.
`grep -in "folio\|handover" backend/prisma/schema.prisma` returns **zero hits** —
`FolioIssue`, `FolioSnapshot`, `FolioIssueReservation` and `HandoverExport` are
all absent. This is a threat model of a **design**, written against **shipped
neighbouring code** whose behaviour the design will inherit. That is the only
useful time to write one, and it is why five of the eight rulings below are
about code that already ships rather than code anyone has written.

---

## 0. How to read this

### 0.1 The disposition vocabulary

Copied from `wave-e0-threat-model-2026-07-28.md` §0.1, including the rule that
makes it binding.

| Disposition | What it means | What discharges it |
|---|---|---|
| **Accept** | The risk is taken as-is, in a named person's name. | The accepting sentence, with the owner's name, appears in this artifact. Nothing further is built. |
| **Mitigate before phase X** | The risk is real and phase X may not ship without the fix. | A named mechanism **and** a named test. Both must exist before phase X merges. |
| **Block** | No phase — or a named phase — proceeds until re-dispositioned. | A re-disposition, in a PR amending this artifact. |

**A *current* violation may not be dispositioned as "documented".** Where the
shipped behaviour is already wrong and D1b touches it, the disposition is
`Mitigate before D1b` and the fix is named. Nothing here is softened into a
paragraph.

### 0.2 Acceptance tests

Existing AT numbers are cited where the spec §14 already carries the assertion.
Where no existing AT covers a mitigation, this artifact **mints one**, the way
`wave-e0` minted AT-100…AT-118. Wave D's existing range ends at **AT-151**, so
the new rows are **AT-152 … AT-156** and are listed together in §11.2. They are
new obligations on D1b and D1c, not restatements.

### 0.3 What this artifact is not

It does not authorise D1b. It disposes of eight threats. D1b becomes buildable
when every row dispositioned `Mitigate before D1b` has its named mechanism and
its named test **in D1b's own PR**, and when §11's blocking summary is clear.

---

## 1. T-1 — The authorized-but-malicious issuer

### The threat

A user who legitimately holds folio-issuance rights on a project issues folios
to manufacture a record: a folio compiled from a lot they have quietly emptied,
issued in bulk to bury a bad version among good ones, or issued and then
re-issued to make an earlier version look superseded. Everything they do is
inside their permission set. **No access-control mechanism can prevent this**,
which is why the ruling is about evidence, not prevention.

### Evidence, at `0adf76f8`

The natural gate already ships, and there are two precedents to copy rather than
invent:

- `backend/src/lib/roles.ts:78` — `ROLE_GROUPS.QUALITY` is
  `[OWNER, ADMIN, PROJECT_MANAGER, QUALITY_MANAGER]`, the exact set a folio
  issuer should be drawn from.
- `backend/src/routes/testResults/accessControl.ts:41` — `TEST_VERIFIERS`, the
  same four roles declared route-locally. This is the closer precedent: the
  repo's convention is a route-local const, not a `roles.ts` group import.

The audit path ships, and **one of its two writers silently swallows failures**:

- `backend/src/lib/auditLog.ts:105` — `createAuditLog(params)`. Its body wraps
  the insert in a `try/catch` that logs and returns (`:108-111`, comment: *"Log
  error but don't fail the main operation"*). An audit-store outage is invisible
  to the caller.
- `backend/src/lib/auditLog.ts:127` — `writeAuditLogInTransaction(tx, params)`,
  which does **not** swallow: it returns the created row and a failure aborts the
  enclosing transaction.
- `backend/prisma/schema.prisma:1730-1752` — `model AuditLog`, with
  `projectId`, `userId`, `entityType`, `entityId`, `action`, `changes`,
  `ipAddress`, `userAgent`, `createdAt`, and indexes on `[projectId, createdAt]`
  and `[entityType, entityId]`.

Two routes bypass both helpers and call Prisma directly —
`backend/src/routes/auth/accountDeletionRoutes.ts:115` and
`backend/src/routes/lots/bulkMutationRoutes.ts:507` — so "an audit event is
written" is a convention, not an invariant, at this SHA.

### Ruling

**The defence against an authorized bad actor is an unforgeable trail, not a
narrower permission.** Three properties, all of which the design already implies
and none of which is free:

1. **The issue is append-only at the database level.** Spec §7.1's UPDATE
   trigger on `folio_issues` means a malicious issuer cannot retro-edit; the
   worst they can do is issue **another** version, which is itself a record.
   **AT-141** already asserts this against raw SQL.
2. **The audit event is written inside the issue transaction**, using
   `writeAuditLogInTransaction` (`auditLog.ts:127`) and **not**
   `createAuditLog` (`:105`). §10.5 requires an audit event on folio issue; if
   that event is written by the swallowing helper, an attacker who can make the
   audit insert fail gets an un-audited issuance and a 2xx. This is a real
   choice between two shipped functions and the spec does not currently name
   which one — so this document names it.
3. **The issuer gate is a route-local const in the `TEST_VERIFIERS` shape**, not
   a fresh hierarchy check. `canApproveItems` (`roles.ts:66`) is hierarchy-based
   and admits anything at or above `quality_manager`, which is the same set
   today but drifts the moment a role is inserted into `ROLE_HIERARCHY`.

**What is explicitly accepted:** a `quality_manager` who issues a folio over a
lot with thin evidence has produced a *correct* folio — the folio's whole design
is that it states what is present and names what is not (spec §1.1, `[DH-B1]`).
An issuer cannot make the folio claim more than the evidence supports, because
the §2.3 resolvers, not the issuer, decide the verdicts. **That is the mitigation
for the content limb**, and it already shipped in `#1679`.

### Disposition

**Mitigate before D1b** · owner: D1b build agent · exit: **AT-152** (§11.2) —
the issuer gate, and the audit row written by `writeAuditLogInTransaction`
inside the issue transaction, asserted by rolling the transaction back and
finding no `FolioIssue` **and** no `AuditLog` row. Plus **AT-141** unchanged.

---

## 2. T-2 — The stale-snapshot race

### The threat

`POST /api/lots/:id/folio/sessions` assembles the payload and writes
`FolioSnapshot` (spec §4.3.3). Rendering then happens **outside** that
transaction (§4.4.2 step 2), deliberately, because holding a database
transaction across an object-storage write is how a connection pool dies. In
that window the underlying evidence can change: a test result is verified, an
NCR is closed, a document is deleted, the company branding is replaced.

If the renderer re-reads **anything** from the database, the folio becomes a
mixture of two points in time — some rows as at session creation, some as at
render — and its `compiledFrom` describes neither. This is the failure mode
`[DH-B1]` exists to prevent, arriving through the back door.

### Evidence, at `0adf76f8`

The shipped precedent for a pure, snapshot-fed computation exists and is the
model: `backend/src/lib/handover/loganPsp5Profile.ts` takes
`LoganPsp5ResolverInput` and reaches no database — its header states *"PURE, in
the shape `evidenceReadiness.ts` established: functions over passed-in inputs,
no Prisma, no clock, no I/O"* (`loganPsp5Profile.ts:42-45`). The whole `#1679`
module imports nothing from `routes/` or `lib/prisma`. The renderer must be the
same species.

The countervailing pressure is real and worth naming: a renderer that takes a
`FolioSnapshot` **row** rather than its `payload` is one `include:` away from
being a live read, and Prisma makes that a one-line change nobody reviews as a
security change.

### Ruling

**The window is not closed; it is made irrelevant.** Two mechanisms:

1. **The renderer's input is `payload`, and its import graph reaches no Prisma
   client and no clock.** Not "should not read" — *cannot*, asserted as an
   import-graph property the same way spec **AT-126** asserts the archive worker
   reaches no PDF generator. The renderer signature is
   `(snapshotPayload) => Buffer` and it takes the pinned issue timestamp as a
   field of the payload, not from `Date.now()` — which is also the precondition
   the §10 benchmark's byte-determinism axis measures.
2. **The snapshot is what `compiledFrom` describes.** Spec §7.7's revision
   tokens are resolved **in the session transaction** and frozen into
   `sourceRowRefs`. A folio therefore says *"these exact rows, at these exact
   revisions"* — and if the evidence changed a second later, the folio is still
   a true statement about the moment it names.

**What is accepted, in one sentence, because the alternative is worse:** a folio
can be issued from a snapshot taken seconds before a test result was verified,
and will not show that result. Re-reading at render time to "get the latest"
would produce a document whose header time, whose `compiledFrom` and whose
content disagree — a lie that looks like freshness.

**The snapshot's own lifetime is bounded.** `FolioSnapshot.expiresAt` (§7.3)
exists; a snapshot that has expired must not be renderable, or the window
becomes unbounded and a folio can be issued from evidence months old while
presenting as new.

### Disposition

**Mitigate before D1b** · owner: D1b build agent · exit: **AT-153** (§11.2) —
the renderer's import graph reaches no Prisma client and no clock, and rendering
against an expired `FolioSnapshot` is refused. **AT-127** (historical content
intact) is unchanged and depends on this.

---

## 3. T-3 — Reservation exhaustion

### The threat

Spec §7.2 makes `FolioIssueReservation` carry a reserved `version` under unique
`[lotId, version]`, and §10.5 retires the version of an expired reservation
rather than recycling it: *"a gap in a version sequence is harmless, reuse is
not."* Both are correct, and together they make the version sequence a
**consumable resource**.

A caller who opens sessions in a loop and never issues therefore burns version
numbers permanently, and each session also writes a `FolioSnapshot` row carrying
a **full assembled payload** — so the attack costs the attacker one HTTP request
and costs CIVOS a wide row plus a permanently retired integer. Left unbounded, a
lot's folio versions reach absurd numbers and the snapshot table grows without
limit.

### Evidence, at `0adf76f8` — and this is the finding

**There is no `express-rate-limit` dependency anywhere in the repo.** Limiting is
a hand-rolled middleware, `backend/src/middleware/rateLimiter.ts`, memory-backed
in development and Postgres-backed (`rate_limit_buckets`) in production.

The limiters that exist, and the one a new folio route inherits:

| Limiter | Window | Max | Keyed on | Mounted |
|---|---|---|---|---|
| **general API** (`rateLimiter`) | `WINDOW_MS = 60 * 1000` (`rateLimiter.ts:47`) | `MAX_REQUESTS`, env `API_RATE_LIMIT_MAX`, **default 1000** (`:48`) | **client IP** | **`server.ts:116`, globally, before every router** |
| auth | 60 s | 10 prod / 50 otherwise | client IP | `server.ts:141` (`/api/auth`) |
| support | 60 s | 10 prod / 50 | client IP | `server.ts:164-165` |
| chat | 60 s | 20 | **`req.user.id`**, else IP | `copilot/chatRoute.ts:50` |
| product events | 60 s | 60 | `req.user.id`, else IP | `productEvents.ts:36` |
| verification resend | 24 h | 3 | body `email` | `auth/emailVerificationRoutes.ts:196` |

`backend/src/server.ts:144` mounts the lots router bare —
`app.use('/api/lots', lotsRouter);` — with **no router-level limiter**. So a new
`POST /api/lots/:id/folio/sessions` inherits exactly one control: **1000
requests per minute per IP**.

That is not a mitigation for this threat. It permits **1000 burned version
numbers and 1000 full payload snapshots per minute from one IP**, and it is
**IP-keyed**, so it neither identifies the actor nor survives a mobile carrier
NAT that puts a hundred honest users behind one address.

The two user-keyed precedents already exist (`chatRateLimiter` at
`rateLimiter.ts` keyed on `req.user.id`, mounted at `copilot/chatRoute.ts:50`;
`productEventsRateLimiter` at `productEvents.ts:36`), so the mechanism is a
copy, not an invention.

### Ruling

**Three bounds, none of which is the global limiter.**

1. **A dedicated, `req.user.id`-keyed limiter on session creation**, in the
   `chatRateLimiter` shape. A folio session is a human act on a human's screen
   (§4.3.1); a working ceiling is single-digit-per-minute, not 1000. The exact
   number is D1b's to set and to write in its PR body, per `[DR2-B6]`.
2. **`expiresAt` on the reservation, and a sweeper that actually runs.** §7.2
   specifies the column and the `[expiresAt]` index. §10.5 already warns that
   `dataRetentionWorker.ts` handles no artefacts — **confirmed at this SHA and
   worse than the spec states**: `backend/src/lib/dataRetentionWorker.ts` is an
   85-line scheduler whose only job is calling `applyRetentionPolicies` (`:54`),
   and `backend/src/lib/dataRetention.ts` sweeps **database rows only** —
   `passwordResetToken:104`, `emailVerificationToken:108`, `syncQueue:113`,
   `documentSignedUrlToken:117`, `holdPointReleaseToken:123`,
   `revokedAuthToken:129`, `productEvent:136`. Grep for `artifact`, `file`,
   `storage` or `upload` across both files returns **nothing**. **No stored file
   of any kind is swept anywhere in this product today.** D1c.2 may not assume a
   file sweeper exists.
3. **An outstanding-reservation cap per lot.** A limiter bounds rate; it does not
   bound the standing total. A lot with N unexpired reservations and no issued
   folio refuses the N+1th session with a stated reason.

**What is accepted:** version-number gaps. They are the correct outcome of the
§10.5 no-reuse rule and are visible on the folio as a monotonically increasing
`v{n}`. A folio at v40 on a lot with three issued folios is odd-looking, not
unsafe — and bound 3 is what stops it being routine.

### Disposition

**Mitigate before D1b** · owner: D1b build agent · exit: **AT-154** (§11.2) —
the user-keyed limiter refuses over its ceiling; the outstanding-reservation cap
refuses with a stated reason; and an expired reservation is swept with its
version **not reused**. **AT-146** already asserts the uniqueness and the sweep;
AT-154 is the rate and cap limb it does not cover.

---

## 4. T-4 — Cross-tenant session, snapshot and reservation ids

### The threat

Four new id classes reach routes as path parameters: `lotId`, the session /
snapshot id, the reservation id, and the issue id. Every one of them is a
guessable-shaped opaque UUID that a user in company B can paste into a route
scoped to company A. The classic form is the second hop: the route authorises
the **lot**, then loads the **snapshot** by its own id without re-checking that
the snapshot belongs to that lot and that project.

### Evidence, at `0adf76f8` — including a real hazard

Spec §10.1 is right that there is no single shared guard: **four per-domain
copies exist, all named `requireProjectReadAccess`**, and all four are still at
the cited lines —

| File | Line | Signature |
|---|---|---|
| `backend/src/routes/testResults/accessControl.ts` | **92** | `(projectId, user, message?)` |
| `backend/src/routes/dockets/access.ts` | **112** | `(user, projectId)` |
| `backend/src/routes/holdpoints/access.ts` | **41** | `(projectId, user, message?)` |
| `backend/src/routes/notifications/access.ts` | **50** | `(user, projectId)` |

**The argument order is inconsistent between them — two are `(projectId, user)`
and two are `(user, projectId)`.** That is the hazard, and it is not
hypothetical: a fifth copy written by pattern-matching against the wrong
neighbour transposes its arguments, and whether TypeScript catches it depends
entirely on whether the two parameter types happen to be distinguishable at that
call site. Wave D correctly declines to unify the four (§10.1), so D1b writes a
fifth — and it must be written against a named one of the four, not against
memory.

`notifications/access.ts:51-53` additionally hard-rejects subcontractor roles up
front, which is the shape a folio guard wants: a subcontractor has no business
in a handover folio at all.

### Ruling

**Every folio route resolves `projectId` from the row it is about, and
re-derives it at every hop.** Concretely:

- The lot's `projectId` comes from the lot row, never from the request.
- A snapshot, reservation or issue loaded by id is checked to belong to **both**
  the lot in the path **and** the project the guard authorised. A `findUnique`
  by id followed by a permission check on a *different* row's project is the
  bug this row exists to name.
- All four new tables carry `projectId` (§7.2, §7.3, §7.1) so the check is a
  column comparison and not a join through three tables.
- The new guard is written against **one named** existing copy, with the file
  and line in the PR body, so the argument-order hazard is a review artefact
  rather than a runtime surprise.

**Accepted:** the four-copy duplication itself. Unifying `requireProjectReadAccess`
across four route folders is a cross-cutting refactor Wave D explicitly forbids
itself (§10.1), and doing it inside a security-sensitive phase is worse than
living with it.

### Disposition

**Mitigate before D1b** · owner: D1b build agent · exit: **AT-132**, extended —
the spec's existing tenancy AT already says *"every new route refuses a
cross-tenant `:id`, for all four tables"*. The extension this artifact requires:
the fixture must include the **second-hop** case — a snapshot id from project A
presented on a lot in project B by a user who legitimately holds access to B —
which the AT as worded does not force.

---

## 5. T-5 — The storage-path guard

### The threat

§4.4.2 writes folio bytes to `folios/{projectId}/{lotId}/{folioIssueId}.pdf`.
Three interpolated segments, all derived from ids. A segment carrying `..`, `/`
or a null byte escapes the prefix; a segment that collides overwrites a legal
record. Both are the same defect and both are already solved in this repo.

### Evidence, at `0adf76f8`

The guard ships, and **it is module-private**:

```
backend/src/lib/scheduledReports/artifacts.ts:51-55
function assertSafeStorageId(value: string, fieldName: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw AppError.badRequest(`${fieldName} is invalid`);
  }
}
```

`^[A-Za-z0-9_-]+$` rejects `/`, `\`, `.`, `..`, null bytes and every non-ASCII
character, and `+` rejects the empty string. It is `function`, not
`export function` — the only call site is
`getScheduledReportArtifactStoragePath` (`artifacts.ts:122-131`), which applies
it to all three of its own segments at `:127-129`. **No other module in the repo
calls it.**

The no-overwrite write also ships, in both branches of
`storeScheduledReportArtifact` (`artifacts.ts:200`):

- Supabase: `upsert: false` at `artifacts.ts:230`, with the existing object
  re-read as an idempotent hit rather than clobbered.
- Local disk: `writeFile(filePath, buffer, { flag: 'wx' })` at
  `artifacts.ts:262`, with `EEXIST` handled the same way.

### Ruling

**Reuse, do not re-derive.** A second regex written in a folio module is a
second regex to get wrong, and it will drift from this one the first time either
is touched.

1. **Export `assertSafeStorageId` from `artifacts.ts`** (or lift it to a shared
   storage module) and apply it to **all three** folio path segments. Making the
   function public is the smallest change that lets the folio writer use the
   exact bytes that already guard the scheduled-report path.
2. **`upsert: false` / `flag: 'wx'` on the folio write.** A folio is
   append-only by trigger at the row level (§7.1); an object write that can
   overwrite would leave the row immutable and the **bytes** replaceable, which
   is the worse half of the pair. The `artifacts.ts:225-292` pattern is the one
   §4.4.2 already names — this row's contribution is that it must be the
   pattern, not a paraphrase of it.
3. **The path is built by one function**, the way `artifacts.ts:122` builds the
   scheduled-report path, so there is one place to audit.

### Disposition

**Mitigate before D1b** · owner: D1b build agent · exit: **AT-155** (§11.2) —
traversal-shaped segments are rejected by the shared guard (asserted on the
exported function, not on a copy), and a second write to an existing folio
object does not overwrite it.

---

## 6. T-6 — Resource exhaustion in the renderer

### The threat

**New in Rev 3 and new in fact:** under `[DH-i]` PDF generation runs **in the
API process**. Before this revision, every one of the eight shipped generators
ran in the user's browser and consumed the user's memory. A folio render is now
CPU-bound, synchronous work inside the process that serves every other request,
and its cost is driven by a payload whose size the requester influences —
evidence rows, document counts, matter counts.

Two shapes: a **single enormous folio** (a lot with tens of thousands of
evidence rows), and **concurrency** (N users issuing at once, N renders holding
buffers simultaneously).

### Evidence — measured, not assumed

This is the row §4.3.6's benchmark exists to feed. Measured on this branch at
`7e28b0a3`, `node v22.14.0`, `win32 x64`, results committed at
`backend/scripts/bench-results/pdf-folio-2026-07-28T12-04-29-843Z.json`. Full
table and method in **§10**.

For the selected library, **pdfkit 0.19.1**, over a folio-shaped fixture:

| Payload | Wall-clock p50 | p95 | Peak RSS growth | Output |
|---|---|---|---|---|
| Reference lot (12 evidence rows) | 18.84 ms | **25.79 ms** | — | 5.6 KB, 2 pages |
| 50-lot scale (600 evidence rows) | 88.19 ms | **117.05 ms** | — | 33.5 KB, 12 pages |
| Batch peak RSS growth (30 × 1× + 5 × 50-lot in one process) | — | — | **28.96 MiB** | — |

Against §4.3.6's predeclared thresholds — p95 **< 1500 ms**, peak RSS delta
**< 96 MiB** — the reference-lot render is **58× inside** the wall-clock bar and
the whole batch is **3.3× inside** the memory bar.

**What that does and does not settle.** It settles that a *normal* folio is not
a threat: 26 ms of CPU is a cheap request. It does **not** settle the tail,
because the benchmark measured 600 evidence rows and nothing measured 60,000.
Extrapolating the two measured points is linear-ish (12 rows → 18.8 ms, 600 rows
→ 88.2 ms) but linear extrapolation of an unmeasured regime is exactly the
arithmetic `[DR2-B6]` exists to refuse.

Two shipped facts bound the neighbourhood:

- `backend/src/server.ts:109` — `express.json({ limit: '1mb' })`, global. The
  *request* is small; the *payload the server assembles from the database* is
  not bounded by it.
- `backend/src/routes/documents.ts:278` — multer's `fileSize: 50 * 1024 * 1024`,
  the only size ceiling in the product, and it governs uploads rather than
  renders.

### Ruling

**A ceiling on the payload, refused at preflight, not truncated.** This is the
same shape spec **AT-130** already requires of the archive cap: *"the cap
refuses, it does not truncate"*.

1. **The session route measures the assembled payload — evidence row count is
   the driver — and refuses above a stated ceiling** with the measured number in
   the message. The ceiling is D1b's to pick and to write in its PR body before
   measuring against it. A folio that silently drops rows is `[DH-B1]`'s "silent
   omission" wearing a performance costume.
2. **The render happens outside any database transaction** (§4.4.2 step 2), so
   a slow render holds no connection. This is already the design; it is restated
   here because it is *also* the mitigation for this threat, and a future
   simplification that moves the render inside the transaction would reintroduce
   it silently.
3. **The T-3 limiter is the concurrency bound.** A user-keyed
   single-digit-per-minute limiter on session creation caps how many concurrent
   renders one actor can provoke. Rate limiting and resource exhaustion are the
   same mitigation here, which is why T-3's limiter is load-bearing twice.

**Accepted, in Jay's name:** the folio render runs in the API process rather
than in a worker. A worker would need a job table, a lease, a heartbeat and a
poll — the whole `D1c.1` machinery — for a 26 ms operation, and `[DH-B2]`
forbids a background job emitting a document nobody reviewed. 26 ms measured
against a 2 s session budget (§12) does not justify it.

### Disposition

**Mitigate before D1b** · owner: D1b build agent · exit: **AT-156** (§11.2) —
a payload above the stated ceiling is refused at preflight with the measured
value, and no snapshot, reservation or partial render is produced.
**AT-151** (§10) is discharged by this PR and is the input to this row.

---

## 7. T-7 — Fail-closed production storage (`[DR-B8]`, §10.3)

### The threat

§10.3 is unambiguous: *"A folio silently written to ephemeral disk is worse than
no folio: it is a legal record that reports success and then disappears."*
Railway deployment storage is ephemeral; `CLAUDE.md:266` says the files vanish on
the next redeploy.

### Evidence, at `0adf76f8` — the shipped writer fails **open**

- `backend/src/lib/supabase.ts:33-35` — `isSupabaseConfigured()` is
  `return supabase !== null;`, and the client is constructed once at module load
  (`supabase.ts:23-30`). The value is frozen at import time — it cannot report a
  *runtime* storage outage, only a *configuration* absence.
- `backend/src/lib/scheduledReports/artifacts.ts:225` —
  `if (isSupabaseConfigured()) { …Supabase… }`, and the local-disk path at
  `:257-262` is the **unguarded fall-through**. There is no
  `NODE_ENV === 'production'` check and no refusal anywhere in
  `storeScheduledReportArtifact`.
- The only production refusal is at **boot**:
  `backend/src/lib/runtimeConfig.ts:184` `assertProductionStorageConfig()`, with
  `ALLOW_LOCAL_FILE_STORAGE=true` a hard boot failure at `:191-195` and missing
  Supabase credentials a hard boot failure at `:197-199`.

So production cannot *start* without Supabase configured — but the write path
itself has no opinion, and **AT-142 has nothing to point at today**.

### Ruling

**A boot-time check is not a fail-closed write.** It is a good check and it
should stay, but it answers a different question: it proves the credentials were
present when the process started, not that the object landed durably. The gap it
leaves is narrow and real — a process running with Supabase reachable at boot and
failing later takes the `:257` fall-through and writes a legal record to a disk
that will be wiped.

**The folio writer refuses rather than falling through.** It does **not** reuse
`storeScheduledReportArtifact` unmodified; it needs an explicit
production-and-not-configured refusal with a stated reason, and it must treat an
upload **failure** — not merely an unconfigured client — as a refusal too. Step 3
of §4.4.2 already gives the correct ordering for free: **the `FolioIssue` row is
inserted only after the bytes are durable**, so a refused write leaves an expired
reservation and no row, which is the safe end state.

**Accepted:** the scheduled-report writer keeps its fall-through. Changing it is
a behaviour change to a shipped feature inside a security-gate PR, and scheduled
reports are regenerable in a way a folio is not.

### Disposition

**Mitigate before D1b** · owner: D1b build agent · exit: **AT-142** as written
in spec §14 — *"with durable storage unavailable, folio issuance refuses with a
stated reason and writes nothing to local disk"*, kind **storage-integration**.
No new AT; the existing one is correct and currently unimplementable, which is
the point of naming it here.

---

## 8. T-8 — `[DH-i]` binding, and what AT-124 actually requires

**This is the row the task brief singles out, because it is currently recorded
nowhere and D1b's implementer will read it here or not at all.**

### The invariant, stated once

> **No route anywhere accepts client-supplied folio bytes. Folio bytes are
> produced by the backend from the `FolioSnapshot` and by nothing else.**
> `[DH-i]`, spec §4.3.1.
>
> **And its corollary, which is AT-124: a client-supplied `sha256` or
> `compiledFrom` on any folio route is REJECTED with 400 — not silently
> ignored.** Spec §14: *"rejected outright, not merely ignored."*

The distinction is the whole row. A stripped field and a rejected field differ
in exactly one way that matters: **a stripped field returns 2xx.** A client — or
an attacker probing the surface — that sends `sha256` and gets a success
response has been told the field was accepted. The next thing built on that
observation is wrong, and nothing in the system disagrees with it until someone
reads the source.

### Evidence, at `0adf76f8` — AT-124 is **not satisfiable** by the repo's convention

Counted at this SHA across the whole backend:

- **`.strict(` occurrences in `backend/src`: 0.**
- **`z.strictObject` occurrences in `backend/src`: 0.**
- **`.passthrough()` / `.catchall(`: 0.**
- Against **100 `z.object(` occurrences under `backend/src/routes`.**

Representative, and there is no counter-example to show because the repo has
exactly one convention:

- `backend/src/routes/lots/validation.ts:325` —
  `const bulkDeleteSchema = z.object({ lotIds: lotIdArraySchema });`
- `backend/src/routes/lots/validation.ts:330` — `bulkUpdateStatusSchema`, plain
  `z.object`.
- `backend/src/routes/lots/geometryRoutes.ts:37` — `generatedGeometrySchema`,
  plain `z.object`.

**Zod's default for `z.object()` is to strip unknown keys silently.** So a folio
route written to the repo's shipped convention would take
`{ …valid fields…, sha256: "deadbeef" }`, drop `sha256`, and return **201**.
That is precisely "silently ignored", and AT-124 as written would fail — or
worse, would be quietly reinterpreted by whoever implements it into "the stored
value derives from the server", which is the *weaker* half of the assertion and
the half that is true by construction anyway.

### Ruling

**AT-124's rejection limb requires an explicit, deliberate departure from the
repo's validation convention, and this document is where that departure is
authorised and scoped.**

1. **Folio route body schemas are `.strict()`.** Scoped to folio routes only —
   this is not a repo-wide migration, and turning on strict validation across 100
   existing schemas inside a security-gate PR would be a large behavioural change
   to shipped routes with no test coverage for the new rejections.
2. **`sha256` and `compiledFrom` are additionally named**, so the 400 says which
   field was refused and why. A generic `unrecognized_keys` error is a correct
   rejection and a poor one: the message *"the server computes `sha256`; it is
   not accepted from a client"* is the thing that stops the next person trying.
   `AppError.fromZodError` (project convention, `CLAUDE.md`) carries the Zod
   issue through; the named-field message is the addition.
3. **No folio route has a binary or base64 body field at all.** This is
   **AT-143**'s subject — *"no Wave D route accepts a request body containing PDF
   or binary document content, and the folio module's import graph reaches no
   client-supplied byte source"* — and it is asserted as a **route-inventory**
   property, not by trying to smuggle a PDF past a validator. Asserting the
   route's *absence* is sound; asserting a check on arbitrary bytes is what
   `[DR2-B4]` deleted.
4. **The bound on accidental byte channels is already there and should be
   named:** `express.json({ limit: '1mb' })` at `backend/src/server.ts:109`
   caps any JSON body globally, and `multer` is mounted per-route on the document
   surfaces only (`routes/documents.ts:276-285`). A folio route that never adds
   a multer handler and never adds a base64 field has no byte channel by
   construction. **A folio route must not mount multer.** That is a one-line
   review check and it belongs in this document because it is the kind of line
   that gets added later "just for attachments".

**Accepted:** the 99 other non-strict schemas in `backend/src/routes`. They are a
pre-existing condition, they are out of Wave D's scope, and widening them here
would be a cross-cutting change smuggled through a threat model. Recorded, not
softened — a future agent tightening them repo-wide should expect real
behavioural fallout on existing clients.

### Disposition

**Mitigate before D1b** · owner: D1b build agent · exit: **AT-124** as written
(the rejection is now implementable because the mechanism is named), plus
**AT-143** unchanged. The PR body must state that folio schemas are `.strict()`
and that no folio route mounts multer.

---

## 9. What this model deliberately does not cover

Named so nobody re-searches, in the `wave-e0` §19 spirit.

| Not covered | Why |
|---|---|
| Folio **download** authorisation and SHA verification on read | **AT-125** already asserts it (*"a stored object mutated out-of-band fails the SHA check and errors rather than serving"*), and §10.2 already forbids public links and signed URLs. No new threat surface. |
| The **archive** worker's lease, heartbeat and compare-and-swap publish | `D1c.0`/`D1c.1` scope, and `[DR2-B7]` / **AT-135** already model it. This gate covers D1b and D1c's *shape*, not D1c's concurrency design. |
| **PII in the archive**, redaction, external delivery | §10.5 disposes of it as a decision: the archive is delivered whole to a user who already has read access to every member, is not redacted, and is not shared externally. §10.5's own sentence stands: *"If external delivery is ever added, that is a new threat model, not a rider."* |
| **Legal hold** bypass | §7.6's append-only `ArtifactLegalHold` and **AT-148** cover it; there is no D1b surface that touches hold state. |
| The **eight shipped jsPDF generators** | `[DH-i]` and **AT-122** remove them from Wave D's diff entirely. A threat model of code the wave does not touch is noise. |
| **Supabase RLS** | Not applicable. App tables live in Railway Postgres; the Supabase project is storage-only (`CLAUDE.md`). |

---

## 10. The Node PDF library decision — §4.3.5–4.3.6, **AT-151**

The §4.3.6 dependency decision, recorded here as the spec permits (*"the decision
recorded in the threat-model doc or a short companion section in the same PR"*),
because T-6 depends on its numbers.

### 10.1 Method

Harness: `backend/scripts/bench-pdf-folio.mjs` (`npm run bench:pdf`). Results:
`backend/scripts/bench-results/pdf-folio-2026-07-28T12-04-29-843Z.json`, plus
`backend/scripts/bench-results/pdf-footprint.json` for the isolated footprint
measurements.

- **The thresholds are in the harness**, copied from §4.3.6 before any candidate
  ran, and are written into every results file so the bar travels with the
  measurement (`[DR2-B6]`).
- **One layout engine, three adapters.** The folio is laid out once, against a
  five-method adapter (`newPage` / `text` / `measure` / `line` / `pageCount` +
  `footer`). This compares **primitives**, not table sugar, and keeps the three
  outputs identical in content.
- **The fixture is folio-shaped** per §4.3.2: a header block, the §2.5 legal
  paragraph as a wrapped block, **three tables** — the 8 pack items, the **18**
  §5.6.5(1)(c) matters transcribed from `loganPsp5Crosswalk.ts`, and the evidence
  rows — and a `page X of Y` footer on **every** page. That footer is the
  sharpest capability test in the set: `Y` is unknown while page 1 is drawn, so
  every candidate must reach back into already-written pages.
- **Each candidate runs in its own child process, twice.** Own process so peak
  RSS is not cross-charged; twice so **byte-determinism is checked across
  processes**, which a same-process pair cannot do.
- **Page counts are read back by an independent parser** (`pdf-lib` loads every
  candidate's output), which also proves each output is a parseable PDF.

### 10.2 Results — node v22.14.0, win32 x64, 28 July 2026

| Candidate | ver | Native build step | Byte-deterministic | p95 1× | p95 50-lot | Peak RSS | Footprint | Verdict |
|---|---|---|---|---|---|---|---|---|
| **pdfkit** | 0.19.1 | **none** (20 pkgs, 0 install scripts) | **yes** (3/3 hashes) | **25.79 ms** | 117.05 ms | 28.96 MiB | **19.5 MiB** | **SELECTED** |
| pdf-lib | 1.17.1 | none (5 pkgs, 0 install scripts) | yes | 21.66 ms | 207.32 ms | 52.71 MiB | 20.8 MiB | passes; loses the tie-break |
| jspdf | 4.2.1 | none (23 pkgs, **core-js postinstall**, 3 browser-canvas shims) | yes, **only with `setFileId`** | 16.09 ms | 154.89 ms | 43.47 MiB | 40.7 MiB | passes; loses the tie-break |

Thresholds: native build step **none** (hard reject) · byte-determinism
**identical** (hard reject) · p95 **< 1500 ms** · peak RSS delta **< 96 MiB** ·
footprint **recorded, no threshold**.

### 10.3 The decision, and why it is not "fastest wins"

**All three candidates clear every predeclared bar.** §4.3.6 sets wall-clock and
memory as **thresholds**, not scores, and names installed footprint as the
tie-breaker: *"recorded, no threshold — informational; it decides ties, not
selection."* Applied literally, the selection is **pdfkit**, on the smallest
installed footprint (19.5 MiB vs 20.8 and 40.7).

Choosing jspdf because it posted a 16 ms p95 against pdfkit's 26 ms would be
inventing a ranking the spec did not declare, after seeing the numbers — the
exact `[DR2-B6]` failure the thresholds exist to prevent. Both figures are two
orders of magnitude inside a 1500 ms bar.

**Corroborating, not deciding:** pdfkit is also the only candidate that supplies
every layout primitive the §4.3.2 contract needs natively — text measurement,
wrapping, pagination, retro-active page access via `bufferPages` +
`switchToPage`, standard-14 fonts with no embedding, and a top-left origin that
matches the layout engine with no coordinate translation. pdf-lib supplies
**neither wrapping nor pagination** (`widthOfTextAtSize` is its only measurement
primitive) and uses a bottom-left origin, so the layout engine carries all of it;
jspdf sits between the two.

**Losers' disqualifying axis: none — and that is the honest answer.** Neither
loser was disqualified. They lost the tie-break. Recording it as a
disqualification would be a tidier story and a false one.

### 10.4 AT-151: **pass**

> *"The §4.3.6 benchmark records each candidate against every predeclared
> threshold, and the selected library requires no native build step and produces
> byte-identical output across two renders of one snapshot under a fixed clock
> and fixed metadata — the precondition AT-127 depends on."*

All three columns recorded for all three candidates; pdfkit's closure carries no
`binding.gyp`, no `gypfile`, no prebuilt `.node` and no install script of any
kind; and its output hashes identically across two in-process renders **and** a
render in a separate process (`24ca3900…`, three matching hashes).

**AT-151 did not fire.** The §4.3.6 escape hatch — *"if no candidate passes,
`D1b.0` fails and says so rather than lowering a number"* — was not needed, and
no threshold was moved.

### 10.5 Two measurement bugs found, both flattering a wrong answer

Recorded because a benchmark nobody debugged is a benchmark nobody should trust.

1. **jsPDF writes a random `/ID` on every render.** Two outputs differ on exactly
   that line and nowhere else. Un-pinned, jspdf fails byte-determinism — **on a
   knob nobody turned**. `doc.setFileId(...)` makes it byte-identical, so it is
   turned, and the finding is *recorded* rather than *scored*. Rejecting a
   candidate for a default is not a measurement.
   **This is a live constraint on D1b regardless of library:** whichever renderer
   ships, its document-id and creation-date fields must be pinned from the
   snapshot, or **AT-127 is unimplementable**. pdfkit's equivalents are
   `info.CreationDate` and `info.ModDate`.
2. **The dependency-closure walker under-counted.** It used
   `require.resolve('<pkg>/package.json')`, which throws on packages whose
   `exports` map omits `./package.json` (fontkit, linebreak, tslib), and it
   skipped `optionalDependencies` — **which npm installs by default**. It
   reported jspdf's closure as 7 packages with no install script while npm had
   just run core-js's `postinstall` in the same terminal. Corrected to a
   filesystem lookup that follows optional deps: jspdf is **23** packages, with
   core-js's postinstall and `canvg` / `html2canvas` / `stackblur-canvas` present.
   None is a native addon, so the hard reject still does not fire — but a server
   renderer dragging browser rasterisers into the API image is a fact a reviewer
   should see, and the first walker hid it.

### 10.6 Measurement caveat, stated

The machine ran concurrent agent workloads during benchmarking. Across four full
runs, p95 figures varied by up to **3×** (pdfkit 1× p95 ranged 25.79–81.03 ms).
**Every run selected the same candidate and every run passed every threshold by
at least an order of magnitude**, so the contention changes no verdict — but the
committed numbers should be read as an **upper bound on a loaded developer
machine**, not as a Railway production figure. T-6's ceiling is set on the shape
of the curve, not on the absolute milliseconds.

---

## 11. The verdict table

### 11.1 Every threat, its disposition, owner and exit condition

| # | Threat | Disposition | Owner | Testable exit condition |
|---|---|---|---|---|
| **T-1** | Authorized-but-malicious issuer | **Mitigate before D1b** | D1b build agent | **AT-152** — issuer gate in the `TEST_VERIFIERS` shape; audit row via `writeAuditLogInTransaction` (`auditLog.ts:127`), **not** `createAuditLog` (`:105`); rollback leaves neither row. Plus **AT-141**. |
| **T-2** | Stale-snapshot race | **Mitigate before D1b** | D1b build agent | **AT-153** — renderer import graph reaches no Prisma client and no clock; an expired `FolioSnapshot` cannot be rendered. **AT-127** depends on it. |
| **T-3** | Reservation exhaustion | **Mitigate before D1b** | D1b build agent | **AT-154** — `req.user.id`-keyed limiter on session creation (the global 1000/min/IP at `server.ts:116` is not it); outstanding-reservation cap per lot; expired reservation swept, version not reused. Plus **AT-146**. |
| **T-4** | Cross-tenant session / snapshot / reservation ids | **Mitigate before D1b** | D1b build agent | **AT-132, extended** — the fixture must include the **second-hop** case: a project-A snapshot id presented on a project-B lot by a user who legitimately holds B. |
| **T-5** | Storage-path guard | **Mitigate before D1b** | D1b build agent | **AT-155** — `assertSafeStorageId` **exported** from `artifacts.ts:51` and applied to all three folio path segments; `upsert: false` / `flag: 'wx'`; a second write does not overwrite. |
| **T-6** | Resource exhaustion in the renderer | **Mitigate before D1b** | D1b build agent | **AT-156** — a payload above the stated ceiling is refused at preflight with the measured value; no snapshot, reservation or partial render produced. Fed by **AT-151** (§10). |
| **T-7** | Fail-closed production storage (`[DR-B8]`) | **Mitigate before D1b** | D1b build agent | **AT-142** as written, kind storage-integration. Currently unimplementable — `storeScheduledReportArtifact` falls through to local disk at `artifacts.ts:257` with no production check. |
| **T-8** | `[DH-i]` binding + AT-124's rejection limb | **Mitigate before D1b** | D1b build agent | **AT-124** — folio schemas `.strict()` (departing from the repo's 0-of-100 convention, scoped to folio routes), `sha256` / `compiledFrom` named in the 400. Plus **AT-143**; no folio route mounts multer. |
| — | The 99 other non-strict `z.object` schemas | **Accept as a recorded pre-existing condition** | Jay | Out of Wave D scope; recorded in §8, not softened. |
| — | Four duplicated `requireProjectReadAccess` with inconsistent argument order | **Accept** | Jay | §10.1 forbids unifying them; D1b names the one it copied, in its PR body. |
| — | Render in the API process rather than a worker | **Accept** | Jay | §6's measured 26 ms p95 against §12's 2 s session budget; `[DH-B2]` forbids the worker alternative. |
| — | Version-number gaps from swept reservations | **Accept** | Jay | §10.5's no-reuse rule; T-3 bound 3 keeps it from being routine. |
| — | The scheduled-report writer's local-disk fall-through | **Accept** | Jay | §7 — behaviour change to a shipped feature, out of scope; scheduled reports are regenerable, folios are not. |

### 11.2 The five ATs this artifact mints

| # | Phase | Assertion | Kind |
|---|---|---|---|
| **AT-152** | D1b | **The issuer is gated and the trail is unforgeable.** A role outside the folio-issuer set is refused. A successful issue writes an `AuditLog` row **inside the issue transaction** via `writeAuditLogInTransaction`; forcing the transaction to roll back leaves **neither** a `FolioIssue` nor an `AuditLog` row — asserting the trail cannot be lost while the record survives. | DB-backed |
| **AT-153** | D1b | **The renderer cannot see the present.** The folio renderer's import graph reaches no Prisma client and no clock — an import assertion in the shape AT-126 uses for the archive worker — and rendering against a `FolioSnapshot` past its `expiresAt` is refused with a stated reason. | unit + import assertion |
| **AT-154** | D1b | **Sessions are rate- and depth-bounded.** Session creation over the per-user ceiling is refused (asserted against the dedicated limiter, **not** the global one at `server.ts:116`); a lot at its outstanding-reservation cap refuses the next session with a stated reason; an expired reservation is swept, its object removed, and its version **not** reused. | DB-backed |
| **AT-155** | D1b | **The storage path cannot escape or clobber.** Traversal-shaped segments (`..`, `/`, `\`, empty, non-ASCII) are rejected by the **shared exported** `assertSafeStorageId`, asserted on the export rather than on a folio-local copy; and a second write to an existing folio object does not overwrite it. | unit + storage-integration |
| **AT-156** | D1b | **The renderer refuses, it does not truncate.** A payload above the stated evidence-row ceiling is refused at preflight with the measured value in the message; no `FolioSnapshot`, no `FolioIssueReservation` and no partial object is produced. The ceiling is the one written in D1b's PR body before measuring. | DB-backed |

### 11.3 Blocking summary

- **Nothing is dispositioned `Block`.** Every threat has a named mechanism and a
  named test, and all eight land inside D1b's own PR.
- **D1b is buildable** once T-1 … T-8's exit conditions hold. There is no
  prerequisite remediation PR of the `E.0a` species: nothing here requires a
  change to shipped behaviour outside Wave D's own new code. The two shipped
  defects this model found — the local-disk fall-through (§7) and the
  non-strict validation convention (§8) — are both **worked around inside the
  folio surface** rather than fixed globally, deliberately, and both workarounds
  are named.
- **D1c inherits T-3's finding**: no file sweeper exists anywhere in this
  product. `D1c.2` may not assume one and must not discover this late.
- **The three exports/one departure D1b must make, listed once** so they are not
  found one at a time: export `assertSafeStorageId` (`artifacts.ts:51`); add a
  user-keyed limiter in the `chatRateLimiter` shape; use
  `writeAuditLogInTransaction` not `createAuditLog`; and use `.strict()` schemas
  on folio routes against a repo with zero of them.

---

## 12. NOT FOUND — stated so nobody re-searches

Verified absent at `0adf76f8`, each by grep or by reading the file:

- **`express-rate-limit`** — not a dependency in any `package.json` in the repo.
  All limiting is `backend/src/middleware/rateLimiter.ts`.
- **Any router-level or route-level rate limiter under `/api/lots`** —
  `server.ts:144` mounts the router bare.
- **`.strict(`, `z.strictObject`, `.passthrough()`, `.catchall(`** — zero
  occurrences in `backend/src`.
- **Any artefact, file or storage sweeper** — `dataRetentionWorker.ts` and
  `dataRetention.ts` between them sweep seven **database row** types and no
  stored file. Grep for `artifact` / `file` / `storage` / `upload` in either
  returns nothing.
- **`FolioIssue`, `FolioSnapshot`, `FolioIssueReservation`, `HandoverExport`** —
  `grep -in "folio\|handover" backend/prisma/schema.prisma` returns zero hits.
- **Any exported storage-path guard** — `assertSafeStorageId` is
  module-private at `artifacts.ts:51` with three call sites, all in
  `getScheduledReportArtifactStoragePath`.
- **Any runtime storage-health probe** — `isSupabaseConfigured()`
  (`supabase.ts:33-35`) reports configuration at import time, not reachability.

---

## 13. Verification notes

**Everything cited was opened at `0adf76f8`.** The counts (`.strict(` = 0,
`z.object(` under `routes` = 100, `folio|handover` in `schema.prisma` = 0) were
run at that SHA and are reproducible with the greps quoted inline.

**Where this artifact departs from the spec, and why.** Three places, all in the
direction of naming a mechanism the spec left implicit:

1. §4.3.4 lists "the storage-path guard" as a threat to cover; this document
   finds the guard is **module-private** and therefore not reusable as-is, which
   turns a check into a small code change (**AT-155**).
2. §4.3.4 lists "rate limiting" against reservation exhaustion; this document
   finds the only inherited limiter is **1000/min/IP** and is not a mitigation,
   which turns a mention into a new limiter (**AT-154**).
3. **AT-124** says a client-supplied field is *"rejected outright, not merely
   ignored"*; this document finds the repo's validation convention makes that
   **unachievable without an explicit change**, and scopes the change. This is
   the finding the brief singled out, and it is the one most likely to have been
   silently reinterpreted into the weaker assertion during implementation.

**One thing changed under this document's own feet.** `#1679` shipped between the
spec's Rev 3 and this artifact and proved §2.2's pack list wrong against the
primary clause (eight items, not seven). That reconciliation is in the same PR as
this document and does not affect any ruling here — the threat surface is the
same whether the pack has seven items or eight.
