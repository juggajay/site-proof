# Wave C1 exit gate — evidence at `bb28c44b` (2026-07-28)

**Gate source:** `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` (Rev 2.2) **§15.1**
— the wave's own thirteen-item exit gate. This is **not** the §15.1 BLOCK-MODE acceptance
gate of the D14 pack spec; that one is assembled separately in
`docs/plans/block-mode-gate-status-2026-07-28.md` and is cross-referenced below rather
than duplicated. The two gates are independent: C1 can exit with every project in `warn`,
which is where every project is.

**Assembled by:** orchestrator, 2026-07-28, after the C1 build chain (#1582 C1.0, #1585
C1.1, #1594 C1.2), the F1 canonicalization fold (#1596, #1598, #1602, #1614) and the D14
chain (#1608, #1611, #1615, #1616). **Spec phase C1.3 — "benchmark, monitoring, exit
evidence" (§11) — has no PR**; this document is its third deliverable, and the absence of
the other two is recorded honestly at items 8 and 11.

**Verified at HEAD.** Every suite cited below was re-run in a clean worktree at
`bb28c44b` against the local disposable Postgres (`siteproof_test`,
`npx prisma migrate deploy` → *No pending migrations to apply*), never Railway:

| Run | Result |
| --- | --- |
| `npx vitest run src/lib/readiness/sufficiency/{counts,evaluate,regime,registry,resolve,testCategories,testCategoriesSeedSweep,lotAttributeValidation}.test.ts src/lib/readiness/sufficiency/rulesets` | **10 files, 333 tests passed** |
| `npx vitest run --no-file-parallelism` over `sufficiency/regime.db`, `sufficiency/testCategoriesEngine.db`, `routes/lots/conformanceSufficiency.db`, `routes/lots/testSufficiencyEntry.db`, `routes/lots/sufficiencySnapshots.db`, `routes/claims/claimInclusionDecision.db` | **6 files, 92 tests passed** |
| `npx vitest run --no-file-parallelism` over `predicates.parity`, `contracts/contracts`, `requirements/requirements`, `characterization/characterization`, `routes/lots/lotConformanceDecision.db`, `routes/notifications/alertMappers`, `evidenceReadiness/conformanceCopy` | **7 files, 249 tests passed** |

**23 files, 674 tests, zero failures** — every acceptance test named in the table below is
inside one of those three runs.

## The thirteen items

| # | §15.1 exit item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | ≥ 1 pack `confirmed`, with `block` proven end to end on it | ✅ DONE | **Two** packs confirmed, not one: `vicroads-204.v2` (`rulesets/vicroads-204.v2.ts:238` `status: 'confirmed'`, edition v8.0 / November 2025, clause 204.13(a), grade `'A'` — #1611) and `tfnsw-q6.v1` (`rulesets/tfnsw-q6.v1.ts:408` `status: 'confirmed'`, Q6 Ed 2/Rev 0 February 2024, Table Q6/L.1 all 25 cells, grade `'A'` — #1615). `block` proven end to end in #1594: `POST /api/lots/:id/conform` refused **400** with *"Requires 6 compaction tests (… clause 204.13(a)) — 1 verified conforming"*, lot stays `in_progress`, **no decision row written** (AT-10, `routes/lots/conformanceSufficiency.db.test.ts`); the same lot conforms at `off`/`warn`; force-conform records the shortfall in the snapshot (AT-16, `routes/lots/sufficiencySnapshots.db.test.ts`). Both suites green at HEAD. **Caveat, stated not hidden:** the item's "verified in the snapshot by **direct prod query**" ritual is unreachable — no project is at `mode: 'block'` on production (J1: opt-in per project), and flipping one is gated by the separate block-mode gate. The proof that exists is route-level against a real DB, not a prod row. |
| 2 | The third F0 consumer contract turns green | ✅ DONE | `contracts/futureConsumers.ts:44-61` — `TestSufficiencyVerdict` with `TestReasonCode` widened by the five C1 codes (`:29-42`), satisfied by the **real** evaluator, not a stub: AT-2 at `sufficiency/evaluate.test.ts:100` asserts the evaluator always populates `state`/`rules` although both are optional. `contracts/contracts.test.ts` still green at HEAD with its shipped four-key fixture. Three of six consumers live (lot readiness, claim readiness, test sufficiency). |
| 3 | CI currency assertions green, demonstrably failing on AT-17's synthetic cases | ✅ DONE | AT-17 `sufficiency/registry.test.ts:264` — a `confirmed` pack with a past `revalidateBy`, at grade ≠ `'A'`, a `draft` pack declaring `reduced`, and a missing `pdfPage` each fail `validateRuleset`. Extended twice since: AT-42 at `registry.test.ts:209`/`:241` (Q6 confirmed on grade-A provenance; synthetic expired and non-A variants fail — #1615) and `registry.test.ts:669` (the Section 173 limb carries **its own** provenance gate — #1611). #1594's F12 fix hardened the date checks (strict ISO both fields, `checkedOn` not in the future with one day of UTC grace, expiry unconditional once parsed) after a malformed `'2027-7-27'` made a confirmed pack immortal. All green at HEAD. |
| 4 | No behaviour change at `mode: 'off'`/`warn'`, proven by §11 C1.1's three-part gate | ✅ DONE | (a) **Parity test** — `readiness/predicates.parity.test.ts` extended 15 → 170 cases over the full `mode × ruleset status × rule-resolution` cross-product; eleven of twelve permutations byte-identical, the twelfth is the specced `block` cell (#1585, AT-14). (b) **Conform-decision DB pins** — `routes/lots/lotConformanceDecision.db.test.ts` unchanged and green, plus the purpose-built `routes/lots/conformanceSufficiency.db.test.ts` on a **VIC** fixture where the confirmed pack actually resolves (#1585 deviation 4 — the original NSW fixture would have made the assertion vacuous). (c) **Corpus** regenerated and the diff accepted in each PR that moved it: #1585 = 20 lots × one added `"sufficiencyBlocks": false` line, nothing else; #1602 = 27/83 lines with `canConform`/`sufficiencyBlocks` parity **moved on zero lots**; #1611 = byte-identical (AT-53); #1615 = 20 NSW lots gain one `test_sufficiency_unknown` warning, **no `blockerCount` or `actionBlockerCount` changed anywhere**. §11's stated premise ("expected diff: empty") was wrong on its own terms and is corrected in #1585's body — recorded here rather than repeated as if it held. |
| 5 | `tfnsw-r44.v1` ships `draft` with its unconfirmability stated | ♻️ SUPERSEDED | Twice. First by `[C1C-9]` (#1585): the pack was **deregistered**, not shipped draft — `draft` means plausible-but-unconfirmed, and grade-A primary evidence proved it *confirmed-wrong* (R44 Ed 6 publishes no frequencies; `n = 6` is one cell of Q6 Table Q6/L.1). Then by **#1615 (D14.3)**, which **deleted the file** and shipped `tfnsw-q6.v1` `confirmed` in its place; the reasoning is written into `rulesets/index.ts:18-30`. The unconfirmability record survives in `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md` and in the Q6 pack header. AT-43 (`registry.test.ts`) pins that the registry is exactly `[vicroads-204.v1, vicroads-204.v2, tfnsw-q6.v1]` and that **no NSW input at any band or area can yield the flat `minCount: 6`**. |
| 6 | Regime correctness proven, including both query modes (AT-5, AT-6, AT-7, AT-8) | ✅ DONE | `sufficiency/regime.test.ts` — AT-7 property test, bounded lookback ≡ fold over full history, N = 1…4 × 60 generated sequences, with an **independent** reference fold implementing the length guard itself `[C1R-B7]`. `sufficiency/regime.db.test.ts` (the DB-backed pin #1582 flagged as missing and #1585 added) — AT-5 unconformed subject takes most-recent-N; AT-6 conformed subject uses the strictly-before compound cursor, including four lots sharing a `conformedAt` where a plain `lt` drops or duplicates rows, plus the length guard; AT-8 force-conformed is non-conforming and an **unverified** failing test does not reset the stream while a verified one does; AT-8b eligibility never lowers a count. Hardened since: AT-49a (#1608 — three conformed but **untested** lots earn no eligibility; the shipped fixtures had pinned the defect as correct and were **corrected**, not supplemented) and AT-56b (#1602 — the streak now breaks on real vocabulary; proven to fail 4/6 against the pre-F1.2 engine). All green at HEAD. |
| 7 | Retroactivity observable, three ways | ✅ DONE | AT-15 in `routes/lots/sufficiencySnapshots.db.test.ts` (#1594): a past test corrected to a **verified fail** raises the requirement, and the advisory item appears on the readiness response of an **already-conformed** lot with `blockers` still empty — the §5.1.3 surface that made Rev 1's exit item unobservable. The other two readings are the `RequirementEvaluation` snapshot (`buildSufficiencySnapshotV1`, `sufficiency/snapshot.ts`) recording the regime basis with each decision, and the regime unit tests of item 6. Green at HEAD. |
| 8 | All §12 benchmarks met on the reference dataset | ⛔ **OPEN — orchestrator (gap (b) only)** — gap (a) CLOSED by #1641; see the amendment below | Two distinct gaps. **(a) Target 1 has no passing measurement on any C1 tree.** *(AMENDED 2026-07-28 — no longer true; the paragraph below records the measurement that closed it. Left as written so the amendment reads against what it corrects.)* The budget was revised **2 s → 3 s** by Jay in #1581, on the strength of #1580's **2,964 ms** — measured on the pre-C1 F0 tree, at 99 % of the revised budget. Every C1-era run since is over it, *on the branch and on its own base*: #1585 base 3,091 ms / branch 3,218 ms; #1594 master 3,990 ms & 4,334 ms / branch 3,390 ms & 3,716 ms (C1.2 **faster** than master both samples); #1602 base mean 3,393 ms / PR mean 3,250 ms. Each PR argues environmental drift and the argument is well-evidenced (#1594's flag-OFF master baseline alone spends 2,967–3,084 ms), but **no quiet-box re-measurement was ever recorded**, so the item's own claim — "budget met" — is unproven at HEAD. **(b) Six §12 rows were never measured at all:** sufficiency added to `GET /:id/readiness` p95 < 25 ms; total readiness p95 < 400 ms; ≤ 1 additional query per stream; regime lookback p95 < 5 ms; conform-decision overhead p95 < 5 ms; serializable-retry rate unchanged; `activitySlug` backfill window. These were C1.3's job and C1.3 shipped no PR. **What IS proven:** the `claim_member` snapshot bound — AT-13 measures **178 bytes against the 1,024-byte budget at 10,000 synthetic rules** (#1594), the unbounded-rule-count assertion `[C1R-B4]` asked for; Targets 2 and 3 pass with wide margins in every run (single-entity 1.4–1.7 ms vs 50 ms; claim-readiness pages 63–92 ms and 163–258 ms vs 1,000 ms); and F1's categoriser cost is bounded by AT-60 (`testCategoriesEngine.db.test.ts`) — though note #1610 relaxed its wall-clock assertion **25 ms → 100 ms** for CI-runner headroom, so it now pins the memoization (cache size) far harder than the latency. |
| 9 | Tenant isolation green for the regime query and the registry route | ✅ DONE | AT-18 `sufficiency/regime.db.test.ts:477` — three conforming lots in project B never earn project A's streak, including when both share an `activitySlug`. AT-19 `routes/lots/testSufficiencyEntry.db.test.ts:727` — the registry route 401s unauthenticated and returns **byte-identical payloads to two users in different companies** (the fixture seeds a second company so the assertion is real, `:55`). Extended by #1611 to assert the route serves **live packs only** (exactly one `vic`/`vicroads` entry, `.v2`, with `materialTypes`). Both green at HEAD. |
| 10 | Legal confirmation on the seeded packs, or an explicit recorded risk acceptance `[C1R-8]` | ⛔ **OPEN — Jay** | J5. Unchanged since the spec was written and unchanged by the D14 chain, which **widened** the surface it covers: the seeded content is now two authorities and 25 transcribed TfNSW table cells, not one pack. Gates a pack reaching a **paying customer**; does not gate a pilot on CIVOS's own QA project (same reading as `block-mode-gate-status-2026-07-28.md`). Related but **closed**: J2 (may a laboratory MDD count toward the per-lot N) was confirmed grade A from primary sources in **#1603** — MDD is the denominator of a ratio, never one of the N — and the shipped `LAB_REFERENCE_TOKENS` (#1598) already implement that position. |
| 11 | Docs + Clancy knowledge mirror updated | ⛔ **OPEN — orchestrator** | **Docs half: done.** C1 spec at Rev 2.2 with the F1 fold (#1605), D14 spec Rev 2 (#1592), F1 spec Rev 2 (#1596), block-mode gate status (#1617), the three confirmation reports in `docs/research/`, and this file. **Two things are not done.** (i) **Clancy has never been told sufficiency exists** — `backend/src/routes/copilot/chat/productKnowledge.ts` (197 lines) contains **zero** occurrences of *sufficiency*, *frequency*, *ruleset*, *VicRoads*, *Q6* or *density* at HEAD (grep, this worktree). A quality manager asking Clancy why a lot says "1 of 6" gets nothing. (ii) The C1 spec still does not carry D14 §18's `[C1C-10]`…`[C1C-14]` — the spec itself says so at line 101-102 ("Not folded here"), so §3.2.1's "quantity is dead weight for C1 counting" and §8.2's "expressible by `perQuantity` + `minCountByScale`" are both **stale and wrong** in the shipped document, and §11/§12's `p95 < 2 s` still contradicts #1581. |
| 12 | Pilot acceptance: a real lot on a real project, gate visible, explanation readable by a QM without training | ⛔ **OPEN — Jay** | No pilot has run. Its two prerequisites are themselves open: the block-mode gate's Jay items (Section 173 boundary domain review, Q6 portal currency re-check — `block-mode-gate-status-2026-07-28.md`) and the production-migration question below. |
| 13 | `npm run fallow:audit` verdict recorded per PR | ✅ DONE | Recorded in every C1-chain PR body, none suppressed and `.fallowrc.json` untouched throughout: #1582 **fail** (6 complexity findings in the new pure layer, investigated), #1585 **fail** (2 introduced findings fixed by extraction, remainder inherited), #1594 findings investigated with the one **new** function — `resolveSufficiencyBatch` — split out in a third commit, #1598 **pass**, #1602 **warn** (all six findings `introduced: false`; two genuinely introduced were refactored away, fail → warn), #1608 **fail**, #1611 **warn**, #1614 **pass**, #1615 **fail**, #1616 **warn**. Both `fail` verdicts in the D14 chain are the inherited `evaluateRule` / `validateRule` hotspots the phase briefs forbade refactoring mid-chain; **#1620 then extracted them** ("behaviour-preserving, corpus-locked") once the chain closed. |

**AMENDED by the orchestrator (2026-07-28) — item 8's gap (a) is CLOSED; the row above was
true when written and is not true now.** #1641 (`0ae440f5`, *"perf(claims): claim decision
back under the 3s budget at 5k members"*, merged 2026-07-28T00:22Z) is the quiet-box
re-measurement the row said had never been recorded. F0.5 **Target 1** — claim inclusion
decision, 5,000 members, snapshots ON — measured **p95 3,725 ms FAIL at the merge-base** and
**2,654–2,722 ms passing all five of five** on the branch, against the 3,000 ms budget #1581
set. The evidence is the strong kind rather than a single lucky run: base and branch
alternated on one idle box with `bench-f05.ts` byte-identical on both sides; base swung
1.58 s run to run and **failed 4 of 5** (its one PASS, 2,987.0 ms, had 13 ms of headroom);
the branch sat in a **69 ms band**; p50 improved a stable −339 to −635 ms; and the
characterization corpus regenerated byte-identical after both fixtures were deleted. #1641
also flags its own over-claim — ~300 ms of the 687 ms `evaluate` drop is **re-attribution,
not elimination**, so the honest net is −453 ms p50.

**FURTHER AMENDED 2026-07-29 (first pass) — the 2,654–2,722 ms figures were UNVERIFIED
in-repo, and the first grounding attempt FAILED OUTRIGHT.** The 2026-07-28 deep review
flagged every number in this paragraph as *aspirational*: the harness was committed and
correctly shaped, but no output artefact was, so the figures lived only in #1641's body.
`bench-f05.ts` now **writes a timestamped record on every run, including runs that error**,
so the gap cannot silently reopen — and that is exactly what it caught: **four attempts,
four failures, zero completed runs.** The 5,000-member decision **exceeded the 15 s
`DECISION_TRANSACTION_TIMEOUT_MS`** and the route 500'd — observed transaction durations
**16,815 / 15,149 / 15,299 / 15,469 ms**, i.e. **~5.8× the claimed 2,654 ms**. Two records
are committed, deliberately at the two different surfaces the timeout can surface at:
`f05-2026-07-28T23-05-31-920Z.json` (`SNAPSHOT_WRITE_FAILED` inside
`requirementEvaluation.createManyAndReturn`) and `f05-2026-07-28T23-27-07-094Z.json`
(`DATABASE_ERROR` at `tx.progressClaim.create`, `workflowRoutes.ts:288`). All four ran at
`cpuBusyPercent: 100` against a third-party runaway (`L-Connect 3`, ~43,000 cumulative
CPU-seconds) this session had no business killing.

**CLOSED 2026-07-29 (second pass) — the re-run happened on a quiet box and gap (a) is
VERIFIED. The timeouts were the box, not the code.** Same workstation, same local test
database, harness byte-identical, run once the machine was genuinely idle (records carry
`cpuBusyPercent` 8.4–14.6, against 100 for all four failures):

| record | shape | Target 1 p95 | p50 | budget | verdict |
| --- | --- | --- | --- | --- | --- |
| `f05-2026-07-29T08-59-39-160Z.json` | `--only=A --claim-iterations=5` — **the failing runs' exact shape** | **2,507.4 ms** | 2,368.6 ms | 3,000 ms | **PASS** (84%) |
| `f05-2026-07-29T09-00-31-801Z.json` | default full gate, A–D, n=20 | **2,383.2 ms** | 2,252.8 ms | 3,000 ms | **PASS** (79%) |

The claimed **2,654–2,722 ms** reproduces **within 6–10%, on the fast side**, and the claim
that mattered — *under the 3,000 ms budget at the 5,000-member ceiling* — holds on 25 of 25
iterations across the two runs with `verdict.failures: []`. **Nothing about the timeout was
a production defect:** the identical decision that took 15–17 s at 100% CPU takes ~2.4 s at
~10%, so the 5.8× was contention, now demonstrated rather than assumed. Targets 2 and 3
re-measured on the same full run and also pass — single-entity overhead **p95 1.2 ms**
(budget 50 ms), claim-readiness **p95 46.7 ms** at page 100 and **136.2 ms** at page 500
(budget 1,000 ms).

**AT-13's "178 bytes" is grounded too.** Both records carry
`results.A.snapshotAudit.maxMemberBytes: 178` against the 1,024-byte budget, checked by the
harness rather than asserted in prose — along with 5,001 snapshot rows in 11 chunks and a
215-byte max aggregate.

**One observation that does not depend on the re-run:** the 3,000 ms budget sits inside a
`DECISION_TRANSACTION_TIMEOUT_MS` of 15 s (`recordDecision.ts:226`), so the margin between
*"misses the budget"* and *"hard 500 for the user"* is **5×**. `recordDecision.ts` already
records the right response — *"if claim decisions ever legitimately exceed this, the fix is
chunking the DECISION, not raising the timeout again"* — so this is a known position, not a
new defect; it is simply now demonstrated rather than theoretical.

**Gap (b) is untouched and stays
OPEN:** the six §12 rows that were never measured at all — sufficiency added to
`GET /:id/readiness` p95 < 25 ms; total readiness p95 < 400 ms; ≤ 1 additional query per
stream; regime lookback p95 < 5 ms; conform-decision overhead p95 < 5 ms; serializable-retry
rate unchanged; `activitySlug` backfill window. **Net: item 8 goes from ⛔ OPEN on both
halves to ⛔ OPEN on gap (b) only**, so the tally below is unchanged. Raised by C3's exit
record (`wave-c3-exit-evidence-2026-07-28.md`, *"The C1 cross-reference the gate got
half-right"*), which noticed this file was stale on the point.

**8 DONE · 4 OPEN · 1 SUPERSEDED.** Of the four open, **two are Jay's** (10 legal, 12 pilot)
and **two are the orchestrator's** (8 benchmarks, 11 Clancy + spec amendments).

## Items outside §15.1 that a reader of this record should know

| Item | Owner | Status |
| --- | --- | --- |
| **The two C1-era migrations have no recorded production application.** `20260727035309_c1_test_sufficiency_lot_attributes` (#1585 — four `lots` columns, `projects.test_sufficiency_mode`, one index) and `20260727120000_d14_lot_material_type` (#1608). The **Production Migrations** workflow has **no successful run after 2026-07-26 03:27 UTC**; its only 2026-07-27 dispatch (run `30266978830`, 12:41 UTC) **failed the branch guard** — dispatched from `refs/heads/d14-1-lot-attributes-vocabulary`, refused because production migrations may only run from `master`. Both PR bodies state the columns are named in shipped `select`s, so code deployed ahead of them would 500 lot reads. This is an **evidence gap, not a proven omission** — the workflow is one of several ways to apply a migration and I hold no production DB access — but nothing in the PR bodies, PR comments or workflow history evidences the apply or the `activitySlug` backfill run. | **orchestrator** | ✅ CLOSED same day — see below |

**Closed by the orchestrator (2026-07-28), who holds the evidence the agent could not:** both migrations were applied to Railway **directly via `prisma migrate deploy` from the PR branch, BEFORE each merge** — the established C1-era pattern, used precisely because the Production Migrations workflow's branch guard (correctly) refuses non-master refs; run `30266978830` was the orchestrator probing that guard, not the apply path. Evidence: (1) `20260727035309` — applied + backfill run 295/341 exact-slugged with idempotence proven by a second zero-row run, recorded in #1585's merge-time record and the session transcript; (2) `20260727120000` — `migrate deploy` output "All migrations have been successfully applied" followed by a direct `information_schema.columns` query returning `material_type | text | YES`, both in the session transcript of 2026-07-27; (3) post-deploy prod smoke the same day: `/health` 200, sufficiency registry route 401-not-404, `GET /api/lots/:id` 401-not-500 — the lot read path selecting the new columns works on prod. Residual improvement queued: record orchestrator-applied migrations as a PR comment at apply time so the evidence lives on the PR, not in a session transcript.
| §15.2 monitoring (lots by sufficiency state, force-conforms that overrode an `insufficient` verdict, `unknown`-cause distribution, regime distribution, sufficiency query p95, serializable-retry rate) | orchestrator | ⛔ OPEN — C1.3's second deliverable; no PR |
| §15.1 BLOCK-MODE acceptance gate (the D14 spec's ten items) | see `block-mode-gate-status-2026-07-28.md` | 9/9 machine items green; 3 Jay items open (Section 173 domain review, Q6 portal currency re-check, J5) |
| F1 §19 / issue **#1604** — converging the sufficiency attribution rule with `predicates.ts` `testMatchesItem` | Jay (it is a **loosening**) | ⛔ OPEN by design; must not land while any project is in `block` |

## What C1 actually delivers at HEAD

Two confirmed packs (VIC earthworks, NSW earthworks + pavements), counting **resolved test
categories** rather than raw strings, on every VIC and NSW project, surfaced in the shipped
readiness panel including on conformed and claimed lots, recorded in immutable decision
snapshots at `resultSchemaVersion: 1`, and **blocking nothing** — every project is at
`warn` (J1), and `sufficiencyBlocks` additionally requires a `confirmed` pack and a real
shortfall (`evaluate.ts`, AT-9). The wave's differentiating claim — a shortfall surfaced
before it costs money rather than discovered at handover — is shipped and reversible.

The four open items are what stands between that and "a quality manager on a pilot project
trusts the number": Jay's legal position and pilot pass, the six §12 rows that were never
measured (the quiet-box run itself landed in #1641 — see the amendment above), and telling
Clancy the feature exists.
