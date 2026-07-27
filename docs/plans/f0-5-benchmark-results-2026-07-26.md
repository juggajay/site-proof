# F0.5 exit-gate benchmark results — 2026-07-26

Measurement only. No product code was changed to produce these numbers.

- **Spec:** `docs/plans/f0-execution-spec-2026-07-24.md` §8 (Rev 3.1), targets
  restated in §3 `[R3-3]` and §12.
- **Code under test:** `origin/master` @ `3fe7eadd` (F0.4b PR 5,
  `backend/src/routes/claims/inclusionDecision.ts` present).
- **Benchmark:** `backend/scripts/bench-f05.ts` (`npm run bench:f05`).

## Verdict

| # | Target | Budget | Measured p95 | Result |
|---|--------|--------|--------------|--------|
| 1 | Claim inclusion decision, 5,000 members, flag ON | p95 < 2,000ms | **4,340.7ms** | **FAIL** (217% of budget) |
| 2 | Single-entity decision overhead (audit row + snapshot insert in the transaction) | p95 < 50ms | **1.8ms** | **PASS** (4% of budget) |
| 3 | Paginated claim-readiness, page of 100 over 5,000 lots | p95 < 1,000ms `[R2-8]` | **80.9ms** | **PASS** (8%) |
| 3 | Paginated claim-readiness, page of 500 over 5,000 lots | p95 < 1,000ms `[R2-8]` | **256.0ms** | **PASS** (26%) |

Snapshot-shape verification at the ceiling: **all PASS** (see §"Snapshot
verification").

§8 sets no standalone latency number for the claim-readiness API; the enclosing
budget it names is the `CreateClaimModal` first-page render p95 < 1s `[R2-8]`, so
the API call inside that render is measured against it. Flagging this as a spec
gap, not a silent substitution.

## Method

- **Database:** local disposable `siteproof_test_f05bench` on
  `localhost:5432` (postgres/postgres), schema applied with
  `npx prisma migrate deploy`. Never `db push`, never Railway. The script calls
  `assertSafeTestDatabaseUrl()` (`backend/src/test/databaseSafety.ts`) *before*
  importing Prisma, so a non-local or unmarked target aborts before a client is
  constructed.
- **Real code paths.** Every measurement is an HTTP request against the actual
  routers mounted as `backend/src/server.ts` mounts them
  (`POST /api/projects/:projectId/claims` →
  `createClaimWorkflowRouter` → `recordDecision` → `evaluateClaimInclusion` /
  `claimInclusionSnapshots`; `POST /api/lots/:id/conform`;
  `GET /api/projects/:projectId/claim-readiness`). Nothing is reimplemented.
- **Flag:** `READINESS_SNAPSHOTS_ENABLED=true` for all target measurements
  (section A additionally re-runs with it off, as a baseline).
- **Dataset:** 5,000 conformed lots in one project, realistic chainage lot
  numbers (`EW-L0001-CH0`… zero-padded so the register's keyset order
  `lotNumber ASC, id ASC` is stable), `budgetAmount` set on every lot so all
  5,000 are claim-eligible, plus a **real ITP instance per lot** — one
  12-item template, `templateSnapshot` written exactly as
  `POST /api/itp/instances` writes it (`backend/src/routes/itp/instances.ts:196`),
  and 60,000 `completed` `ITPCompletion` rows. The ITP data is what makes
  `checkConformancePrerequisitesBatch` read production-shaped rows instead of a
  bare legacy lot; without it the dominant cost below would not appear at all.
- **Iterations:** 20 for the 5,000-member claim (fresh claim each time — the
  decision rows are deleted and the lots reset to `conformed` between runs, so
  state does not grow), 50 for the single-entity decision, 20 per page size.
  `p95` is the ceil(0.95·n)-th sorted sample; at n=20 that is the 19th of 20, so
  `max` is reported alongside it.
- **Phase attribution** comes from the existing `usePrismaMiddleware` shim in
  `backend/src/lib/prisma.ts` (a test-only hook — no product code instrumented).
  `$queryRaw` does not pass through the model-operation extension, so the raw
  `SELECT … FOR UPDATE` lock time falls into the reported "unattributed"
  remainder together with the pre-transaction auth reads, body parsing and JS.

**Environment:** Windows 11, AMD Ryzen 7 5800X, Node v22.14.0, PostgreSQL 17.9
on localhost (`shared_buffers=128MB`, `work_mem=4MB`), Prisma 6.19.3. The app
and the database are on the same host, so there is **no network round trip to
Postgres** — Railway production adds one per query. The costs below are
dominated by a few large single queries rather than by query count, so they are
comparatively RTT-insensitive, but treat these as a floor, not a ceiling.

## Target 1 — claim inclusion decision, 5,000 members (FAIL)

`POST /api/projects/:projectId/claims`, 5,000 lots at `percentageComplete: 100`
(the worst case: every member flips to `claimed`, so `lot.updateMany` and the
member-snapshot chunking both run at full width).

| Measurement | p50 | p95 | max | mean |
|---|---|---|---|---|
| Route latency, flag ON | 3,686.6ms | **4,340.7ms** | 4,543.5ms | 3,827.6ms |
| Route latency, flag OFF (baseline) | 2,977.5ms | 3,516.8ms | 3,674.7ms | 3,068.8ms |

**The route was already over budget before F0.4b PR 5.** With snapshots off it
is still 176% of the 2s budget. The snapshot work accounts for 824ms of the
2,341ms overshoot; the remaining ~1.5s is the pre-existing claim-create path.

### Bottleneck breakdown

Measured Prisma operation time per decision, bucketed by phase:

| Phase | p50 | p95 | max | share of p50 total |
|---|---|---|---|---|
| `evaluate` (reads inside the transaction) | 2,105.6ms | 2,629.9ms | 2,633.7ms | **57%** |
| `snapshot` (11 × `RequirementEvaluation.createManyAndReturn`) | 692.4ms | 869.3ms | 881.4ms | 19% |
| `mutate` (claim + 5,000 members + status flips) | 583.6ms | 677.0ms | 726.6ms | 16% |
| `audit` (`AuditLog.create`) | 9.0ms | 10.5ms | 11.1ms | 0.2% |
| unattributed (raw `FOR UPDATE` locks, auth reads, body parse, JS) | 310.7ms | 418.7ms | 431.2ms | 8% |

Heaviest individual operations, representative iteration:

| Operation | Calls | Total |
|---|---|---|
| `Lot.findMany(include)` — `checkConformancePrerequisitesBatch` | 1 | **1,846.7ms** |
| `RequirementEvaluation.createManyAndReturn` | 11 | 699.5ms |
| `ProgressClaim.create` (nested 5,000 `ClaimedLot` rows) | 1 | 351.5ms |
| `Lot.findMany` — plain eligibility read | 1 | 187.1ms |
| `Lot.updateMany` — 5,000 lots to `claimed` | 1 | 181.0ms |
| `ClaimedLot.findMany` — `getCumulativeClaimedPercentByLot` | 1 | 30.1ms |
| `AuditLog.create` | 1 | 10.3ms |

**One query is half the decision.** The deep conformance hydration in
`checkConformancePrerequisitesBatch`
(`backend/src/lib/conformancePrerequisites.ts`, `CONFORMANCE_LOT_INCLUDE`) pulls
5,000 lots × (1 `ITPInstance` + 1 `ITPTemplate` + 12 `ITPChecklistItem` +
12 `ITPCompletion`) ≈ 130,000 rows through Prisma hydration in a single call.
The relevant indexes all exist (`itp_completions.itp_instance_id`,
`itp_checklist_items.template_id`), so this is row volume, not a missing index.

### Sizing the levers (read-only diagnostic, section D)

The same 5,000 lot ids, four query shapes, 5 reps each — no product change,
just measurement of what each variant of the same read costs:

| Variant | p50 | vs shipped |
|---|---|---|
| 1. Plain `lot.findMany` (the eligibility read) | 179.8ms | — |
| 2. `CONFORMANCE_LOT_INCLUDE` **as shipped** | 1,938.4ms | baseline |
| 3. Same, minus `template.checklistItems` | 1,668.5ms | **−270ms (−14%)** |
| 4. Same, `itpInstance`/`completions` narrowed to the columns the gate reads | 920.2ms | **−1,018ms (−53%)** |

Variant 3 measures **dead hydration**: `getChecklistItemsForInstance`
(`backend/src/routes/itp/helpers/templateSnapshot.ts:88-98`) returns the parsed
`templateSnapshot` and only falls back to `instance.template.checklistItems`
when the snapshot is absent. `POST /api/itp/instances` always writes a snapshot,
so for every instance created through the product the 60,000 checklist-item rows
`CONFORMANCE_LOT_INCLUDE` fetches are hydrated and discarded. Note the fallback
is real for legacy/null-snapshot instances, so dropping the include outright
would change behaviour for those rows — the safe shape is snapshot-first with a
second, narrow query for the instances that lack one.

Variant 4 narrows `ITPCompletion` to the three columns
`buildItpChecklistCompleteness` and `getNaHoldPointSignoffItemIds` actually read
(`checklistItemId`, `status`, `verificationStatus`) plus `templateSnapshot`,
instead of `completions: true` — all 17 `ITPCompletion` columns, including two
Decimals, five nullable text fields and three timestamps.

### Analysis

1. **The gate cannot be met by tuning the snapshot path.** Snapshots are 19% of
   the decision; deleting them entirely leaves p95 at ~3.5s.
2. **The primary lever is the conformance read**, worth up to ~1.0s of the 2.34s
   overshoot on measured evidence (variants 3+4 above). That code is shared with
   claim-readiness and single-lot conform, so the win compounds — the 500-item
   readiness page spends 171.7ms of its 220.7ms in the same query.
3. **Secondary lever, snapshot writes (~700ms).** `insertSnapshots`
   (`backend/src/lib/readiness/recordDecision.ts:339-349`) uses
   `createManyAndReturn`, so all 5,001 rows come back over the wire and are
   hydrated into `DecisionOutcome.snapshots`. The claim-create route reads only
   `decision.mutation` — the returned rows are unused on this path. Plain
   `createMany` would drop the RETURNING payload. Not measured in isolation here
   because it needs a product change; flagged as a candidate, not a proven win.
4. **Third lever, `ProgressClaim.create` with 5,000 nested `claimedLots.create`
   (351ms)** — a sibling `claimedLot.createMany` is the usual shape for this.
   Smallest of the three.
5. **`DECISION_TRANSACTION_TIMEOUT_MS = 15_000` is load-bearing.** The observed
   max is 4,543ms, i.e. Prisma's 5s interactive-transaction default would have
   produced intermittent timeouts at the ceiling. The 15s knob (recordDecision.ts:171)
   is what keeps this decision from failing outright, and headroom is 3.3×, not
   the comfortable margin the comment implies.
6. **Whether the target or the ceiling should move is a product call, not a
   measurement one.** 5,000 members is an artificial worst case (one claim
   covering every lot on a 5,000-lot job at 100%); if the realistic ceiling is
   500 members the budget is met with room to spare. Recorded here without a
   recommendation because the spec fixes 5,000 as the benchmarked ceiling.

**Serializable retry rate was not measured.** §8 pairs it with the concurrency
test load; this benchmark is single-client, and it observed zero retries
(no `DECISION_CONFLICT`, no failed iterations across 40 claim decisions).

### Snapshot verification at the ceiling (all PASS)

| Check | Expected | Measured |
|---|---|---|
| Snapshot rows written | 5,001 = 1 `claim` aggregate + 5,000 `claim_lot` members | **5,001 (1 + 5,000)** |
| `createMany` chunks | 11 (`ceil(5001 / SNAPSHOT_CHUNK_SIZE=500)`), budget ≤ 11 | **11** |
| Max member `result` size | ≤ 1,024 bytes (`MEMBER_RESULT_MAX_BYTES`) | **103 bytes** (10% of budget) |
| Max aggregate `result` size | ≤ 65,536 bytes (`RESULT_MAX_BYTES`) | **138 bytes** (0.2%) |

The aggregate carries counts and totals only — 138 bytes at 5,000 members
confirms no member-id array leaked into it (`[R3.1-B3]`). Member rows are 103
bytes against a 1 KB budget, so the compact-verdict design has ~10× headroom.

## Target 2 — single-entity decision overhead (PASS)

`POST /api/lots/:id/conform` (non-force, prerequisites genuinely met via a
completed 12-item ITP) — the representative single-entity decision, 50 fresh
lots per configuration.

| Measurement | p50 | p95 | max | mean |
|---|---|---|---|---|
| **Audit row + snapshot insert, in-transaction (the target metric)** | 1.1ms | **1.8ms** | 2.1ms | 1.2ms |
| Route latency, flag ON | 13.8ms | 16.7ms | 29.8ms | 14.4ms |
| Route latency, flag OFF | 12.7ms | 15.3ms | 16.5ms | 13.1ms |
| Flag ON − flag OFF (p95 delta; snapshot insert only) | — | 1.3ms | — | — |

Two readings of the target, both comfortably inside 50ms: the directly measured
`AuditLog.create` + `RequirementEvaluation.createManyAndReturn` time inside the
transaction (1.8ms p95), and the end-to-end flag delta (1.3ms). The flag-OFF
column already writes the audit row inside the transaction, so the delta
isolates the snapshot insert alone; the first row is the full audit + snapshot
figure the spec words the budget as.

## Target 3 — paginated claim-readiness over 5,000 lots (PASS)

`GET /api/projects/:projectId/claim-readiness?limit=N[&cursor=…]` — the F0.2a
keyset cursor API. "Page 1" includes the `total` count (first-page only); "page
2" is a cursor request with no count.

| Page size | Page | p50 | p95 | max | mean |
|---|---|---|---|---|---|
| 100 | 1 (with count) | 55.4ms | **80.9ms** | 83.9ms | 60.4ms |
| 100 | 2 (cursor) | 53.8ms | 63.8ms | 67.7ms | 55.3ms |
| 500 | 1 (with count) | 223.3ms | **256.0ms** | 269.8ms | 229.3ms |
| 500 | 2 (cursor) | 220.7ms | 249.8ms | 257.1ms | 226.2ms |

Cost scales with page size, not with register size: page 2 is no slower than
page 1 at either size, which is the keyset pagination working as designed (no
`OFFSET` scan). Same dominant query as Target 1 — `Lot.findMany(include)` is
33.3ms of the 53.8ms page-100 request and 171.7ms of the 220.7ms page-500
request, i.e. the conformance-read lever in §Target 1 is worth ~60–78% of this
endpoint's latency too.

## Re-running

```bash
cd backend

# One-time: create the disposable database and apply the schema.
psql -h localhost -U postgres -c "CREATE DATABASE siteproof_test_f05bench;"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/siteproof_test_f05bench" \
  npx prisma migrate deploy

# The benchmark (~3 minutes: 6s seed, 40 claim decisions, 100 conforms, 80 pages).
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/siteproof_test_f05bench" \
  npm run bench:f05
```

Exit code 0 = every target inside budget, 1 = at least one miss, 2 = the
benchmark itself errored. The script seeds, measures, verifies and tears down in
one pass, so it is re-runnable against the same database.

Flags: `--lots=N` (default 5000), `--claim-iterations=N` (20),
`--entity-iterations=N` (50), `--page-iterations=N` (20), `--only=ABCD` to run a
subset of the sections, `--keep` to skip teardown and inspect the dataset.

---

## 2026-07-26 post-fix re-measurement

`f0-5-perf-fix` (stacks on #1578) attacks the read volume the section above
sized. Same benchmark, same script — `backend/scripts/bench-f05.ts` is byte
identical, so these numbers and the ones above are directly comparable.

- **Code under test:** `f0-5-perf-fix` (three read-volume changes, no schema
  change, no new dependency, behaviour-preserving on decision outcomes).
- **Baseline for this table:** the same benchmark re-run on
  `origin/f0-5-benchmark` @ `093643f0` on the machine that measured the "after"
  column, minutes before the change. It read **p95 4,163.6ms** where the
  original write-up above read 4,340.7ms — the same verdict, ~4% run-to-run
  variance on the same host. Compare within a column pair, not across write-ups.

### Verdict

| # | Target | Budget | Before (p95) | After (p95) | Result |
|---|--------|--------|--------------|-------------|--------|
| 1 | Claim inclusion decision, 5,000 members, flag ON | p95 < 2,000ms | 4,163.6ms | **2,964.0ms** | **still FAIL** (148% of budget, was 208%) |
| 2 | Single-entity decision overhead (audit + snapshot in transaction) | p95 < 50ms | 1.4ms | **1.7ms** | PASS (3% of budget) — no regression |
| 3 | Paginated claim-readiness, page of 100 | p95 < 1,000ms `[R2-8]` | 63.4ms | **45.0ms** | PASS (4%) — 29% faster |
| 3 | Paginated claim-readiness, page of 500 | p95 < 1,000ms `[R2-8]` | 261.5ms | **164.8ms** | PASS (16%) — 37% faster |

Snapshot-shape verification at the ceiling is unchanged and still **all PASS**:
5,001 rows (1 aggregate + 5,000 members) in 11 chunks, max member `result` 103
bytes, max aggregate `result` 138 bytes. Target 2's 1.4 → 1.7ms movement is noise
on a 1–2ms measurement (the flag ON − flag OFF delta came out at −0.2ms), not a
regression; Target 3 improves because it shares the same conformance read.

Full route latency at the ceiling:

| Measurement | p50 | p95 | max | mean |
|---|---|---|---|---|
| Route latency, flag ON — before | 3,735.2ms | 4,163.6ms | 4,577.6ms | 3,810.7ms |
| Route latency, flag ON — **after** | **2,785.4ms** | **2,964.0ms** | 3,014.2ms | 2,783.1ms |
| Route latency, flag OFF — before | 3,015.7ms | 3,331.9ms | 3,482.7ms | 3,062.9ms |
| Route latency, flag OFF — **after** | **2,087.9ms** | **2,275.4ms** | 2,293.0ms | 2,105.9ms |

### Updated phase attribution

| Phase | p50 before | p50 after | delta | share of p50 after |
|---|---|---|---|---|
| `evaluate` (reads inside the transaction) | 2,101.4ms | **1,128.9ms** | **−972.5ms** | 41% |
| `snapshot` (11 × `RequirementEvaluation.createManyAndReturn`) | 695.3ms | 681.8ms | −13.5ms | 24% |
| `mutate` (claim + 5,000 members + status flips) | 577.5ms | 601.7ms | +24.2ms | 22% |
| `audit` (`AuditLog.create`) | 9.3ms | 8.2ms | −1.1ms | 0.3% |
| unattributed (raw `FOR UPDATE` locks, auth reads, body parse, JS) | 313.1ms | 345.4ms | +32.3ms | 12% |

Heaviest individual operations, representative iteration:

| Operation | Calls | Before | After |
|---|---|---|---|
| `Lot.findMany` — conformance hydration + eligibility read | 1 + 1 | 1,981.3ms + 166.4ms | **1,005.0ms combined** |
| `RequirementEvaluation.createManyAndReturn` | 11 | 708.5ms | 601.0ms |
| `ProgressClaim.create` (nested 5,000 `ClaimedLot` rows) | 1 | 366.2ms | 375.7ms |
| `Lot.updateMany` — 5,000 lots to `claimed` | 1 | 208.8ms | 188.4ms |
| `ClaimedLot.findMany` — `getCumulativeClaimedPercentByLot` | 1 | 19.9ms | 31.0ms |
| `AuditLog.create` | 1 | 7.5ms | 7.5ms |

**Reading the "after" operation table:** the recorder keys the two `Lot.findMany`
calls apart by the `(include)` suffix (`bench-f05.ts:118-121`). The conformance
read is now a `select`, so both calls land in one `Lot.findMany` bucket —
1,005.0ms is the conformance hydration **plus** the eligibility read, not the
conformance read alone. Section D's variant 4 (885–962ms across runs) is the
standalone figure for the conformance read as it now ships.

### What changed, per lever

1. **`include` → `select` on the conformance read**
   (`backend/src/lib/conformancePrerequisites.ts`, `CONFORMANCE_LOT_SELECT`).
   Four Lot columns and three of `ITPCompletion`'s seventeen, matching what
   `buildItpChecklistCompleteness` and `getNaHoldPointSignoffItemIds` actually
   read (`checklistItemId`, `status`, `verificationStatus`); `ncrLots` also moved
   from `include` to `select` so the join row's own columns stop coming back.
   This is section D variant 4, and it is the whole of the −972ms on `evaluate`.
2. **`template.checklistItems` out of the hot query** (same const; fallback in
   `attachLegacyChecklistItems`). `getChecklistItemsForInstance`
   (`backend/src/routes/itp/helpers/templateSnapshot.ts:88-98`) returns the parsed
   snapshot and only falls back to live items when the parse yields null, and
   `backend/src/routes/itp/instances.ts:196` writes a snapshot on every
   assignment — so ~60,000 rows per decision were hydrated and discarded. The
   fallback is preserved, not deleted: instances whose snapshot does not parse
   resolve their items through ONE `iTPChecklistItem.findMany` keyed by the
   DISTINCT templates involved (12 rows for a 5,000-lot legacy project, not
   60,000). Snapshot-bearing instances fire no extra query at all. Detection calls
   `parseTemplateSnapshot` rather than checking for null, so a corrupt snapshot
   still falls back exactly as it does today.
3. **`createManyAndReturn` narrowed to `select: { id: true }`**
   (`backend/src/lib/readiness/recordDecision.ts`, `insertSnapshots`). Verdict on
   the candidate: **no caller reads snapshot row content off a
   `DecisionOutcome`** — all eight `recordDecision` call sites (claims
   `workflowRoutes.ts:253`, `lots/qualityRoutes.ts:446,589`, `holdpoints.ts:192`,
   `holdpoints/actionRoutes.ts:417`, `holdpoints/publicBatchRoutes.ts:314`,
   `ncrs/ncrClosureWorkflow.ts:384,527`) read `decision.mutation` and nothing
   else, and `lib/readiness/contracts/**` never mentions snapshots. So
   `DecisionOutcome.snapshots` was removed rather than left as a field that is an
   empty array on every write path, and `snapshotIds` (which the DB suites assert
   on) stays. **Plain `createMany` was NOT used**: it returns only a count, so
   `snapshotIds` would have to be minted client-side, moving id generation off the
   schema default for no further win.
   **Measured: −13.5ms p50, i.e. noise.** The 5,001-row insert cost is the insert,
   not the RETURNING payload. Kept because the work it deletes is provably dead
   (5,001 hydrated rows, ~2 MB of transient objects per decision), not because it
   moved the benchmark. The earlier "secondary lever, snapshot writes (~700ms)"
   line should be read as **refuted**: the snapshot phase is ~682ms with or
   without the payload.

### Why Target 1 is still over, and what is left

The gate needs another ~965ms of p95. Measured, read-only, on the same 5,000-lot
dataset (`--only=CD --keep`, then the query shapes below at 5 reps each):

| Remaining lever | p50 now | p50 if taken | Available |
|---|---|---|---|
| Conformance completions fetched FLAT (`iTPCompletion.findMany` + a JS join) instead of through Prisma's nested-relation hydration | 962.0ms | 659.4ms | **−303ms** |
| Eligibility read in `evaluateClaimInclusion` (`inclusionDecision.ts:146-151`) narrowed to the 4 columns `ClaimableLot` declares | 184.3ms | 47.2ms | **−137ms** |
| `ProgressClaim.create`'s 5,000 nested `claimedLots.create` → sibling `claimedLot.createMany` | 375.7ms | not measured | ~−200ms (est.) |
| Floor: the 60,000 completion rows the gate genuinely reads, fetched flat, 3 columns, nothing else | — | **330.1ms** | — |

Both measured levers together are ~440ms, landing p95 near 2.5s — **still over
budget**. They are deliberately NOT in this change: they do not flip the verdict,
and the last row is why. Even a perfect implementation cannot go below the ~330ms
it takes to read the 60,000 `ITPCompletion` rows the conformance predicates
consume, and the decision also has to insert 5,001 snapshot rows (~682ms), create
5,000 `ClaimedLot` rows (~376ms), flip 5,000 lot statuses (~188ms) and hold a
serializable lock over all of it. The floor for a 5,000-member decision that
reads every member's ITP state is on the order of 1.7–2.0s on this hardware, with
no network round trip to Postgres — Railway adds one per query.

So the conclusion of the original §Analysis point 6 stands and is now
quantified: **at 5,000 members this budget is a spec question, not a tuning
question.** Three honest options, in order of how much they cost:

1. **Lower the benchmarked ceiling.** At 500 members the same route is well
   inside 2s (section C's page-of-500 shares the conformance read and lands at
   164.8ms end to end). One claim covering all 5,000 lots of a 5,000-lot job at
   100% is an artificial worst case.
2. **Raise the Target 1 budget** to something the measured floor can meet (~3s)
   and keep 5,000 members.
3. **Change what the decision reads** — a per-lot conformance summary maintained
   on write (or a SQL-side aggregate) instead of re-deriving from 60,000
   completion rows inside the transaction. Real work, real invalidation risk, and
   it changes the trust model of the gate: today the verdict is computed from
   primary data inside the serializable transaction, which is precisely why it
   cannot be stale.

`DECISION_TRANSACTION_TIMEOUT_MS = 15_000` is now 5x the observed max (3,014ms),
up from 3.3x.

### Decision (2026-07-27): option 2 — budget revised to p95 < 3s

Jay accepted the recommendation: **Target 1 budget is now p95 < 3,000ms at the
5,000-member ceiling** (`bench-f05.ts` updated to match). Rationale: the
remaining time is a measured floor (60k completion rows genuinely read +
5,001 snapshot inserts under one serializable tx), option 3's architectural
rework isn't worth one second at an artificial worst case, and lowering
`CLAIM_LOTS_MAX` would cap real claims. Against the revised budget the
post-#1580 result (p95 2,964ms) **PASSES at 99% of budget** — tight but honest;
any regression on this path will flip the verdict back to FAIL.

### Re-running this comparison

```bash
cd backend
git checkout origin/f0-5-benchmark   # baseline column
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/siteproof_test_f05bench" \
  npm run bench:f05
git checkout f0-5-perf-fix           # after column
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/siteproof_test_f05bench" \
  npm run bench:f05
```

Behaviour-preservation proof for the change (local disposable Postgres, never
Railway):

```bash
# The three pinned decision suites — 44 tests.
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/siteproof_test_f05perf" \
  npx vitest run src/routes/claims/claimInclusionDecision.db.test.ts \
    src/routes/lots/lotConformanceDecision.db.test.ts \
    src/lib/readiness/recordDecision.db.test.ts

# Everything around the touched code — 1,317 tests. `--no-file-parallelism` is
# required: these DB suites share one database, and running them concurrently
# produces spurious 409 DECISION_CONFLICTs from the serializable retry loop.
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/siteproof_test_f05perf" \
  npx vitest run --no-file-parallelism src/routes/claims src/routes/lots \
    src/routes/holdpoints src/routes/ncrs src/lib/readiness src/routes/itp \
    src/lib/conformancePrerequisites.test.ts
```
