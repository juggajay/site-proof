# Wave D `D1c.0` — the streaming and storage spike, measured (2026-07-29)

**Spec source:** `docs/plans/wave-d-handover-spec-2026-07-28.md` (Rev 3) **§4.5**, with §4.6
for the frozen ledger fixture 6 simulates, §12 for the reference dataset, §15 for the exit
gate decision 4 amends, and **§16.1 J8** for the cost ceiling this report measures against
and may not move.

**Acceptance test: AT-150** — *"The benchmark report records a measured value for every
§4.5.1 fixture and for the §4.5.6 cost ceiling, each against the value as specified in this
document. A selection made against a threshold not stated here fails review. Cost is
reported per leg."*

**Base:** branch `feat/d1c0-streaming-storage-spike` off `origin/master` at `78803ba7`
(#1683, the D1b merge).

---

## THE HEADLINE, STATED FIRST

> **SUPERSEDED IN PART — read §7 AND §7.8 before acting on anything below.** Everything on this
> page was measured at the **50 GB / 50,000-member** reference scale on a **loaded** box.
> §4.5.7's entry gate re-ran the field at the decided **8 GiB / 8,334-member cap on a quiet box**
> on 2026-07-29; **§7 carries that result** and *which rows fail, and why*, changed materially
> against this page — two of its forward-looking claims did not survive the re-run.
>
> **Then the thresholds themselves moved, by Jay's dated approval.** §7.8 records it: two
> §4.5.1 rows amended (spec §16.1 **J10**), both remaining candidates passing, and
> **`archiver` 8.0.0 selected**. **§7.8 is the standing outcome `D1c.1` is governed by.**
> Every "no candidate passes" statement on this page and in §7 is true of the thresholds as
> predeclared, is left unedited on purpose, and is superseded as the standing conclusion by
> §7.8.

> **NO CANDIDATE PASSES.** All four writers miss at least one predeclared §4.5.1 row. §4.5.1
> names this as a legitimate outcome — *"If nothing passes, `D1c.0`'s output is 'no candidate
> passes' and D1c is re-scoped"* — and that is what this spike returns. **No threshold was
> relaxed to manufacture a winner.**
>
> **Cost is 3.31× over J8's ceiling: A$39.77 ex-GST measured against A$12.00.** The three
> §4.5.6 fixes are Jay's; §5.4 names which one the numbers point at and stops there.

Two things stop this being a dead end, and both are measured rather than hoped:

1. **archiver and yazl each miss exactly two rows**, and every miss except one is confined to
   the **50,000-member** leg. Member count, not archive size, is what breaks them — and
   member count is already a term in §4.5.3's cap formula.
2. **fflate's failure is categorical and is the important safety finding of this spike**: above
   4 GiB it does not error, it **silently emits an archive with a corrupt central directory**
   that three independent readers refuse. §4.5.2 predicted this; it is now measured.

---

## 0. Everything on this page came from a run

| Artefact | Path |
| --- | --- |
| Writer benchmark harness | `backend/scripts/bench-zip-spike.mjs` |
| Cost model | `backend/scripts/bench-zip-cost.mjs` |
| **Writer results (authoritative)** | `backend/scripts/bench-results/zip-spike-2026-07-28T17-52-20-842Z.json` |
| zip.js raw second-run file | `backend/scripts/bench-results/zip-spike-zipjs-2026-07-28T18-54-20-123Z.json` |
| **Cost results** | `backend/scripts/bench-results/zip-cost-2026-07-28T19-22-51-347Z.json` |
| Frozen member ledger (fixture 6) | `backend/scripts/bench-results/d1c0-frozen-members.json` |

Re-runnable with no database, no env and no network:

```bash
npm install --prefix backend/scripts/bench-zip-deps --no-audit --no-fund \
  fflate@0.8.3 archiver@8.0.0 yazl@3.3.1 @zip.js/zip.js@2.8.34 yauzl@3.2.0
cd backend
node scripts/bench-zip-spike.mjs --gen   # ~6.5 GiB of fixture sources, once
node scripts/bench-zip-spike.mjs         # ~21 GiB scratch at peak, ~80 min
node scripts/bench-zip-cost.mjs
```

**Machine:** AMD Ryzen 7 5800X (8 cores / 16 logical), 32 GB RAM, Node v22.14.0, win32 x64.
**Not a quiet box** — see §6.1, which is the most important caveat in this report.

**No prod dependency was added.** The four candidates live in `backend/scripts/bench-zip-deps/`,
a git-ignored throwaway tree resolved through a `createRequire` rooted there. Nothing was
added to any shipping `package.json`; per §4.5.2 the winner becomes a dependency in `D1c.1`,
when product code needs it.

---

## 1. The candidates, and why these four

§4.5.2 names `fflate`, `archiver`, `yazl` and *"a Web Streams/ZIP64 option"*. The fourth was
surveyed on npm on 2026-07-29:

| Package | Version | Taken? | Why |
| --- | --- | --- | --- |
| `@zip.js/zip.js` | 2.8.34 | **YES — the Web Streams/ZIP64 candidate** | The only surveyed package that is Web Streams-native, advertises `zip64` explicitly in its own keyword list, **and** documents Node support (*"A JavaScript library to zip and unzip files in the browser, Deno and Node.js"*). |
| `zip-stream` | 7.0.5 | no | **It is archiver's own engine** — same maintainer, same `compress-commons` core. Benchmarking it beside `archiver` measures one implementation twice. |
| `client-zip` | 2.5.0 | no | Browser/Fetch-oriented: emits a `Response`/`ReadableStream`, no Node stream integration. Composability with a Node-side resumable upload is §4.5.2's fifth axis, and it fails that by construction. |

**A hand-rolled ZIP container was not attempted** — §4.5.2 rejects it and this spike does not
relitigate that.

### 1.1 One "failure" was thrown away before it was believed

The first install put the candidates in `backend/node_modules` and archiver failed to load at
all: *"The requested module 'brace-expansion' does not provide an export named 'default'"*.
**That is not an archiver defect.** Backend's hoisted `minimatch@9.0.9` ships an ESM build
whose first line is `import expand from 'brace-expansion'`
(`backend/node_modules/minimatch/dist/esm/index.js:1`); the hoisted `brace-expansion@5.0.8`
no longer provides a default export; archiver's `readdir-glob` resolves the hoisted copy.
Scoring archiver on a tree collision would have been fabrication. Moved to an isolated tree,
archiver loads and runs — and goes on to be the only candidate that passes fixture 1.

---

## 2. How it was measured, and the five things that would have made it lie

**All fixture I/O is local disk.** Nothing in this spike touched Supabase, any bucket, or any
network. The upload-leg question (§4.5.2's fifth axis) is answered by **code-level analysis**
of each writer's byte sink (§4.4), not by a live 8 GiB upload.

**Fixture content is compression-realistic per §4.5.3.** The declared mix, recorded in the
results file:

| Class | Share of members | Size range | Compressible fraction |
| --- | --- | --- | --- |
| `photo` (incompressible PRNG bytes) | 78% | 12–28 KiB | 0 |
| `pdf` (mostly incompressible, compressible head) | 15% | 24–56 KiB | 0.2 |
| `text` (CSV/JSON register shapes) | 7% | 2–8 KiB | 1.0 |

The >4 GiB legs are pure incompressible PRNG bytes read off disk — which is what a >4 GiB
evidence archive actually is.

**Five harness defects were found and fixed before any candidate was graded.** Each would
have produced a false result; each is recorded rather than quietly patched.

1. **Whole-member buffers.** The first version materialised each member as one Buffer and
   measured yazl at **1,230 MiB peak RSS** and a **149 ms** worst stall on the 50,000-member
   leg — both the harness's own allocation churn and GC. Members are now streamed in 64 KiB
   chunks and the same leg measures 145.9 MiB. Charging a library for the bench's garbage
   would have failed all four on fixtures 2 and 3 and produced a **false** *"no candidate
   passes"* — the same words this report ends up printing, for entirely different and real
   reasons.
2. **fflate's ignored `mtime`.** `new ZipDeflate(name, { mtime })` **silently discards it** —
   the constructor forwards `opts` to the Deflate compressor only
   (`fflate/lib/index.cjs:1984-1992`) while the ZIP writer reads `f.mtime` off the *file
   object* (`:1889`, `new Date(f.mtime == null ? Date.now() : f.mtime)`). Every entry was
   stamped `Date.now()` and fixture 6 failed on DOS-time granularity. Byte-diffing two
   archives showed **exactly six differing bytes, all the mod-time field**; assigning
   `file.mtime` directly gives **zero**. Same class as the jsPDF `/ID` finding in
   `bench-pdf-folio.mjs`. Recorded as an **API-ergonomics finding against fflate**, not
   scored as non-determinism.
3. **zip.js's undeclared ZIP64.** Passing `zip64: ctx.forceZip64` (true only on the
   single-member leg) made zip.js **throw** on the total >4 GiB leg — *"Zip64 is not supported
   (set the 'zip64' option to 'true')"* — and it was recorded as a writer failure until
   corrected to unconditional `zip64: true`. **zip.js refuses rather than corrupting, which is
   the opposite of fflate's behaviour on the same fixture and much the better failure mode**,
   but it does require the caller to declare ZIP64 up front (§4.1).
4. **Cancellation at member boundaries** would have measured the harness's 256 MiB member
   size, not the writer. Fixture 4 now fires on a **timer, mid-member**, and every adapter
   races its per-member wait against the abort.
5. **`zipjs.terminateWorkers()` returns `undefined`** at 2.8.34 with `useWebWorkers:false`;
   `.catch` on it threw and was reported as a writer failure on every zip.js leg.

**Instrumentation.** Event-loop delay via `perf_hooks.monitorEventLoopDelay({resolution:1})`,
enabled for the whole of every leg — §4.5.1 fixture 3 says *"measured continuously for the
whole run"*, so it is graded on the **worst leg**, not a dedicated one. RSS sampled at 100 ms
**and** cross-checked against `process.resourceUsage().maxRSS`; the two agree within 1% on
every leg, so the flatness results are not a sampling artefact. Full min/p50/p99/max series
summaries are in the results JSON, not just verdicts.

**Independent read-back.** Every archive is verified by **yauzl 3.2.0**, which none of the four
writers shares — the role `pdf-lib` plays in the PDF bench. A writer never marks its own
homework.

---

## 3. Fixture-by-fixture, every candidate

Thresholds are §4.5.1 verbatim. **Not one was altered.**

| | **F1** >4 GiB, RSS ≤256 MiB **and flat ±15%** | **F2** 50,000 members, RSS ≤256 MiB, CD correct | **F3** max stall ≤50 ms, p99 ≤20 ms | **F4** cancel ≤5 s, cleanup ≤30 s | **F5** integrity, **zero** mismatches | **F6** resume byte-identical | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **fflate** 0.8.3 | ❌ **139.7%** (27.61 → 66.18 MiB) | ✅ 167.24 MiB, 50,000 entries, offsets valid | ❌ max **71.6 ms** (p99 7.4 ✓) | ✅ 0.003 s / 0.056 s | ❌ **CORRUPT >4 GiB** | ✅ identical | **reject: F1, F3, F5** |
| **archiver** 8.0.0 | ✅ **6.6%** (36.33 / 38.74 / 37.98 MiB) | ❌ **475.73 MiB** | ❌ max **523.2 ms** (p99 8.1 ✓) | ✅ 0.001 s / 0.041 s | ✅ 50,033 members SHA-verified | ✅ identical | **reject: F2, F3** |
| **yazl** 3.3.1 | ❌ **95.2%** (20.00 → 39.05 MiB) | ✅ **145.9 MiB**, CD correct | ❌ max **113.4 ms** (p99 6.0 ✓) | ✅ 0.001 s / 0.002 s | ✅ 50,033 members SHA-verified | ✅ identical | **reject: F1, F3** |
| **@zip.js/zip.js** 2.8.34 | ❌ **20.0%** (54.46 → 65.36 MiB) | ❌ **818.41 MiB** | ❌ max **696.3 ms** (p99 12.9 ✓) | ✅ 0.002 s / 0.003 s | ✅ 50,033 members SHA-verified | ✅ identical | **reject: F1, F2, F3** |

### 3.1 Fixture 1 — the ZIP64 limbs, tested separately as the spec requires

Both limbs were exercised on every candidate: a **single member of 4.5 GiB** (local-header /
data-descriptor limb) and a **32-member, 8 GiB total** archive with every member 256 MiB
(central-directory limb). Every candidate produced genuinely oversized output — 8,592,561,410
to 8,597,830,786 bytes on the total limb, 4,833,313,097 to 4,836,277,882 on the single-member
limb — so no pass or fail here is vacuous.

**Peak RSS is inside 256 MiB for all four** (max observed 66.18 MiB). **Only archiver is flat**
within ±15%. The others fail the relative band while sitting at trivial absolute values —
yazl's miss is 20.00 → 39.05 MiB, i.e. **15% of the 256 MiB cap at its worst**. That is a real
miss of a predeclared row and it is scored as one; §4.1 records what it does and does not
mean.

### 3.2 Fixture 5 — the finding that decides fflate

fflate produced, **without raising any error**, archives that:

| Reader | 8 GiB total archive | 4.5 GiB single-member archive | 50,000-member (0.99 GiB) archive |
| --- | --- | --- | --- |
| **yauzl 3.2.0** (independent parser) | ❌ *"invalid central directory file header signature: 0x9ff351be"* | ❌ *"…signature: 0x2a9fe98d"* | ✅ 50,000 entries, 50,000 SHA-256 verified, 0 mismatches |
| **Info-ZIP `unzip -t`** 6.00 | ❌ exit 3 | ❌ exit 2 | ✅ exit 0 |
| **Windows Explorer shell handler** (`Shell.Application` COM) | ❌ opens, lists **0 items** | ❌ opens, lists **0 items** | ✅ 2,000 top-level folders |

Three independent readers, two of them not JavaScript, agree. **fflate below 4 GiB is fine —
its 50,000-member archive is byte-perfect across 50,000 SHA-256 comparisons.** Above 4 GiB it
emits a corrupt central directory and returns success. For an artefact the spec calls *"the
highest-value object CIVOS will ever emit"* (§10.2), a writer that reports success on a
corrupt legal record is disqualifying on its own, independent of the other two rows it misses.

*The Explorer check initially scored these as passing.* The shell handler returns a live
namespace for an archive it cannot parse and then lists nothing; grading `count !== null` as
"opens" scored a corrupt archive as readable. Corrected to require `count > 0`, and recorded
here because it is the sort of check that quietly passes everything.

### 3.3 Fixture 3 — and what actually causes the stalls

**Every candidate passes p99 comfortably** (6.0–12.9 ms against a 20 ms threshold). **Every
candidate fails the ≤50 ms max single-tick row.** The cause is not compression; it is the
**central-directory write**, and it was measured rather than assumed, with a member-count
sweep at fixed archive shape (probe mode, not a graded fixture):

| members | archiver max stall | archiver peak RSS | yazl max stall | yazl peak RSS |
| --- | --- | --- | --- | --- |
| 5,000 | 92.3 ms | 70.07 MiB | **15.7 ms** | 47.61 MiB |
| 15,000 | 245.8 ms | 142.82 MiB | **23.1 ms** | 69.52 MiB |
| 25,000 | 359.4 ms | 225.37 MiB | **28.3 ms** | 87.91 MiB |
| 50,000 | 479.5 ms | 475.37 MiB | 59.0 ms | 219.63 MiB |

Both the stall **and** the memory scale with member count while archive bytes stay ~1 GiB. So:

- **archiver's two failures are one failure.** It exceeds 50 ms even at 5,000 members and
  crosses 256 MiB between 25,000 and 50,000. Its per-entry cost is simply high.
- **yazl is inside both thresholds at every count up to 25,000** and crosses only between
  25,000 and 50,000. Its fixture-2 and fixture-3 failures are a single member-count problem.
- **fflate is the exception**: its worst stall (71.6 ms) is on the **8 GiB** leg, not the 50k
  leg (44.96 ms) — consistent with synchronous deflate blocking on large members. `AsyncZipDeflate`
  is not an escape: it spawns a worker **per file**, i.e. 50,000 workers on fixture 2.

**This is measured on a loaded box and the absolute numbers are not certifiable — see §6.1.**
The *shape* (monotonic in member count) reproduced in every sweep; the absolute stall did not.

### 3.4 Fixtures 4 and 6 — clean sweeps, worth stating

**Fixture 4: all four pass, with three orders of magnitude of headroom.** Cancellation was
observed in **1–3 ms** against a 5 s threshold, and the partial object was removed in **2–56 ms**
against 30 s, with 433–624 MB already written at the cancel point. Cancellation is fired
mid-member on a timer, so this is not a member-boundary artefact.

**Fixture 6: all four produce byte-identical archives** across a SIGKILL and a restart over the
same frozen 400-member ledger. Per §4.6.3 the honest reading is that ZIP assembly *restarts*
from the ledger, so what this fixture actually proves is **cross-process byte determinism over
a fixed member list** — which is the property AT-128 and AT-127 depend on. The ledger is
committed at `backend/scripts/bench-results/d1c0-frozen-members.json`; the D1c.1 ledger itself
was **not** built, per the phase boundary.

### 3.5 Upload composability (§4.5.2's fifth axis) — code-level, not a live upload

| Candidate | Byte sink | Backpressure | Verdict |
| --- | --- | --- | --- |
| archiver | Node `Readable` (the archive object **is** a Readable) | Native stream backpressure; `.pipe()` into any uploader | **direct** |
| yazl | Node `Readable` (`zip.outputStream`) | Native stream backpressure | **direct** |
| `@zip.js/zip.js` | Web `WritableStream` (or a zip.js Writer) | Web Streams backpressure; `Writable.toWeb()` bridges a Node sink | **direct (via Web Streams)** |
| fflate | A callback delivering `Uint8Array` chunks | **None from the library** — the caller must implement it, as this harness does | **manual** |

---

## 4. The four decisions

### 4.1 Decision 1 — the writer: **no candidate passes**

> **SUPERSEDED — see §7 for the re-grade at the cap and §7.8 for the standing outcome.** This
> section is the verdict at 50 GB scale under the thresholds as predeclared, and it is left
> unedited. `archiver` 8.0.0 is selected in §7.8 after Jay amended two §4.5.1 rows
> (spec §16.1 **J10**).

**Selected: none.** Per §4.5.1 that is the output, and it is not softened here.

Ranked by how far each is from selectable, because D1c.1 has to start somewhere:

1. **`yazl` 3.3.1 — closest.** Passes F2 (best memory of any candidate at 50,000 members,
   145.9 MiB), F4, F5, F6. Its F3 failure disappears below ~25,000 members. Its **F1 flatness
   failure is the only miss in the whole field not explained by member count** — 20.00 MiB at
   1 GiB output, 39.05 MiB at 8 GiB. Both are trivial absolutely; the growth is characteristic
   of a V8 heap watermark rising over a 4× longer run rather than of size-proportional
   buffering, but **this spike did not prove that** (a 16 GiB leg would; it was not run — §6.2)
   and the row is scored FAIL on the evidence that exists.
2. **`archiver` 8.0.0 — the only F1 pass, and the only candidate whose >4 GiB behaviour is
   fully clean.** Flat to 6.6%, both ZIP64 limbs valid under three readers. Rejected on
   per-entry cost: 475.73 MiB and 523 ms at 50,000 members, and **over 50 ms even at 5,000**,
   which no member-count limit in a plausible range rescues.
3. **`@zip.js/zip.js` 2.8.34** — correct output everywhere it completed, best-in-class refusal
   behaviour (it *tells you* to set `zip64` instead of corrupting), but the worst memory in the
   field (818.41 MiB at 50,000 members, 3.2× the cap) and the worst stall (696 ms). Also the
   only candidate requiring the caller to declare ZIP64 before knowing the output size.
4. **`fflate` 0.8.3 — disqualified, not merely rejected.** Silent >4 GiB corruption (§3.2).
   §4.5.2's note that it *"advertises support only up to 4 GB"* is confirmed, and the failure
   mode is worse than the advertisement implies: not a refusal, a corrupt success. **J4's
   withdrawal of the fflate recommendation is vindicated on evidence.**

### 4.2 Decision 2 — cap and delivery path

**§4.5.3's formula, term by term, in binary units as the spec directs.** Where a term is not
measured, it says so.

| Term | Value | Basis |
| --- | --- | --- |
| `bucket_limit` | **465.7 GiB** (500 GB) | Supabase Pro max file-size **setting**, plan-capped, not a hard product limit (Free 50 MB; above 500 GB by arrangement). https://supabase.com/docs/guides/storage/uploads/file-limits, read 2026-07-29 |
| `upload_protocol_limit` | **465.7 GiB** on the **S3 multipart** path | S3 multipart is documented-supported (`CreateMultipartUpload`/`UploadPart`/`CompleteMultipartUpload`/`AbortMultipartUpload` all ✅) and **requires no total size upfront**. https://supabase.com/docs/guides/storage/s3/compatibility, read 2026-07-29 |
| …at default part size | **46.6 GiB** (50 GB) | `@aws-sdk/lib-storage` default `partSize` 5 MiB × the 10,000-part cap. **A config term that must be set deliberately**, not a discovered limit. |
| `zip_writer_member_limit` | **8 GiB total output / 4.5 GiB single member — PROVEN, nothing above it is** | Fixture 1. This is the binding engineering term and it is a floor, not a ceiling: no candidate was asked for more. |
| **member-count limit** | **NOT CERTIFIABLE ON THIS BOX** — trend measured, absolute limit not | §3.3 and §6.1. yazl sat at 15.7–28.3 ms up to 25,000 members in four sweeps and spiked to 129.4 ms in a fifth. |
| `service_resource_limit` | Not memory-bound (≤66 MiB on every >4 GiB leg). Throughput 20–33 MB/s **on a loaded dev box** | Wall clock is the real constraint; a 46 GiB archive would run ~40 min at that rate. Not a Railway measurement. |
| `product_cap` | **Jay's** — see §5 | The A$12.00 ceiling implies ~15.1 GB of evidence. |

**`effective_cap` = 8 GiB of output, being the largest archive any candidate was measured to
produce correctly.** Anything above that is unproven, and this report will not assert it.

**Delivery path: a single archive on the S3 multipart path. Not TUS, not split archives, not an
object tree.**

- **Not TUS.** A streaming ZIP does not know its final size until the last byte, so TUS
  requires the `creation-defer-length` extension. **Supabase documents no support for
  `Upload-Defer-Length` anywhere** — the string does not appear in the docs repo, and an
  `OPTIONS` probe returns no `Tus-Extension` header because the edge gateway answers it. The
  underlying `@tus/s3-store` advertises the extension, but that is an implementation detail
  Supabase does not commit to. **Treated as unsupported.** Choosing TUS would force staging the
  whole archive on Railway's ephemeral disk to learn its size first — which §10.3 forbids
  relying on.
- **S3 multipart composes directly** with all three viable writers: `@aws-sdk/lib-storage`'s
  `Upload` takes the writer's `Readable` as `Body`, needs no total size, and is the shape
  Supabase's own docs demonstrate with `fs.createReadStream`. No local staging.
- **Not split archives.** §4.5.3 anticipated splitting because it believed the protocol topped
  out at 50 GB. **That premise is stale** — the ceiling is 500 GB (§6.3) — so the constraint
  that would have forced splitting does not exist. Splitting also multiplies the member-count
  problem rather than solving it, and hands the receiving engineer a multi-part deliverable.
- **Not an object tree.** Nothing in the measurements points at it, and it abandons the single
  reconcilable manifest that §4.7.2 exists to provide.

### 4.3 Decision 3 — the compression-headroom margin: **1.0%**

`admission_cap = output_cap × 0.99`, measured, and deliberately **not** banking compression.

| Input | Measured |
| --- | --- |
| Ratio on §4.5.3's fixture-2 mix | 0.9408 – 0.9448 (compression saves ~5.6%) |
| **Worst output/input ratio across every leg** | **1.000919 — deflate EXPANDS incompressible content** |
| ZIP64 structural overhead | ~172 bytes/member (local header + central header + names), ≈0.1% of any archive above 5 GB at plausible member counts |

**The fixture-2 mix ratio of 0.944 is explicitly not banked.** It is favourable only because
the mix carries 7% text and 15% partly-compressible PDF. A project whose evidence is
photographs and CCTV — the shape that actually reaches a >4 GiB cap — compresses at
**1.0009**, i.e. it grows. Setting the margin from the mix would over-admit exactly the
projects most likely to hit the cap, which is the optimism §4.5.3 warns against.

**1.0%** is roughly an order of magnitude above both measured contributions (0.09% expansion +
~0.1% structure) and is the smallest round number that is not optimistic.

### 4.4 Decision 4 — the proposed §15 exit-gate amendment

**Proposed only. The spec edit lands with D1c.1, not this PR.**

§15 item 4 already says Rev 1's 50 GB gate *"is amended to `D1c.0`'s decided cap"*. Under the
cap decided in §4.2 that becomes:

> **§15 item 4 (proposed):** *"A full-project archive generated at the effective cap — **8 GiB
> of output**, the largest any candidate was measured to produce correctly — opened in Info-ZIP
> `unzip` **and** the Windows Explorer shell handler, manifest reconciled against the project's
> actual document count with omissions accounted for. **Rev 1's 50 GB reference-dataset archive
> is withdrawn as a gate**: no candidate was proven above 8 GiB, and at J8's ceiling a 50 GB
> archive is not affordable (§5). The gate additionally records **how many archives a
> reference-dataset project requires at the decided cap**, because that number — not the
> per-archive figure — is what the customer receives."*
>
> **§15 item 5 (proposed):** *"…measured against §4.5.6's ceiling. **The unit the ceiling is
> measured in is now a live question and only Jay may settle it** (§5.4): at the decided cap a
> reference-dataset project is ~6 archives, so 'per reference-dataset archive' and 'per
> full-project deliverable' are no longer the same thing, and Rev 1/Rev 2 wrote them as if they
> were."*
>
> **§15 item 6 (proposed):** *"Peak memory recorded and flat with respect to archive size —
> **flat as §4.5.1 fixture 1 defines it (±15%), which only `archiver` achieved.** If the
> selected writer is not archiver, this item records the measured deviation and the absolute
> peak rather than claiming flatness."*
>
> **New §15 item (proposed):** *"**The archive worker runs in a process that serves no user
> traffic**, and fixture 3's ≤50 ms stall threshold is asserted against the API process. Every
> candidate exceeded it in-process at 50,000 members (§3.3); the threshold exists because
> §4.5.1 assumed the job shares the API process, and the cheapest sound answer is that it must
> not. §13 already env-gates the worker separately (`SCHEDULED_REPORT_WORKER_ENABLED`)."*

That last item is the architectural consequence of §3.3 and the single most useful thing this
spike produced. **It is a proposal, not a licence to call fixture 3 passed** — in-process, all
four candidates fail it, and that verdict stands unchanged.

---

## 5. Cost, per leg, against J8's AUD 12.00 ex-GST

Reference dataset §12: **5,000 lots, 50 GB evidence**. Measured compression ratio 0.944838 →
**47.2 GB archive**. Retention modelled at **30 days** (§10.5 sets a TTL but names no number —
a declared modelling assumption, not a spec value). All rates published, cited and read
2026-07-29; full citations with quotes in the cost results JSON.

| Leg | GB | Rate | USD | AUD |
| --- | --- | --- | --- | --- |
| Original reads (Supabase → worker) | 50.0 | $0.09/GB uncached egress | $4.50 | **A$6.46** |
| Archive upload (worker → Supabase) | 47.2 | **$0.05/GB Railway service egress** | $2.36 | **A$3.39** |
| Storage, 30 days | 47.2 | $0.0213/GB-month | $0.99 | **A$1.42** |
| Download 1 (Supabase → Railway → browser) | 47.2 | **$0.14/GB — two billed transfers** | $6.61 | **A$9.49** |
| Download 2 | 47.2 | $0.14/GB | $6.61 | **A$9.49** |
| Download 3 | 47.2 | $0.14/GB | $6.61 | **A$9.49** |
| Compute (Railway vCPU + RAM) | — | $20/vCPU-mo, $10/GB-mo | $0.02 | **A$0.03** |
| **TOTAL** | | | **$27.71** | **A$39.77** |

> ### **CEILING (J8): A$12.00 ex-GST · MEASURED: A$39.77 · FAIL — 3.31× over**

**The cost is ~100% network.** Compute is A$0.03 — 0.08% of the bill. Nothing about writer
selection, compression level or CPU efficiency moves this number.

### 5.1 Why the naive model understates by ~3×, confirmed in vendor docs

Railway bills a service for bytes it **uploads** to object storage, not just bytes it serves:

> *"Note that service egress is not free. If your service sends data to users **or uploads files
> to a bucket**, that traffic counts as service egress."*
> — https://docs.railway.com/storage-buckets/billing, read 2026-07-29

And **§10.2 requires the expensive download path**: *"Downloads are authenticated app requests,
ownership-checked at the storage-path level, `no-store`. **No public link, no Supabase signed
URL, no email attachment.**"* So every download is Supabase egress ($0.09) **plus** Railway
egress ($0.05) — the double transfer is a **security requirement, not an implementation
choice**, and the three download legs are **72% of the total bill**.

### 5.2 The floor: it fails before anyone downloads anything

**Generation alone — read + upload + storage, zero downloads — is A$11.30.** That leaves
**A$0.70** of the ceiling for three downloads of a 47 GB object. No delivery path, at any
published rate, fits: even direct-from-storage downloads at the *cached* CDN rate ($0.03/GB,
the most optimistic published number) add A$6.10.

### 5.3 The cap arithmetic, and the trap in it

| Path | Evidence that fits A$12.00 |
| --- | --- |
| As specified (§10.2 backend-mediated, uncached) | **15.1 GB** |
| Signed-URL direct, uncached — *requires amending §10.2* | 20.3 GB |
| Signed-URL direct, cached — *requires amending §10.2, assumes every download is a cache hit* | 34.5 GB |

**And here is the trap, stated plainly because it is the easiest thing in this report to get
wrong.** At the proven 8 GiB cap one archive costs **A$7.23** — comfortably inside the ceiling.
But a reference-dataset project then needs **6 archives**, totalling **A$43.36**. **Splitting
does not reduce the cost; it changes the unit the ceiling is measured in.** Reading J8 as
"per archive" rather than "per full-project deliverable" makes it pass on arithmetic while the
customer's bill goes up. J8's wording is *"a full-project archive on the program's reference
dataset"*, and **re-basing that unit is a change to what Jay decided, which only Jay may make.**

### 5.4 Which of the three §4.5.6 fixes the numbers point at — and then this report stops

§4.5.6 names three, **all Jay decisions**: a lower cap, a cheaper delivery path, or a priced
add-on.

- **A lower cap** is the only one the measurements independently support: the proven engineering
  cap (8 GiB) already sits inside the ceiling at A$7.23 per archive, so it costs nothing extra
  to adopt. **But** §5.3 shows it does not reduce the cost of archiving a reference-dataset
  project, only the size of the unit billed against — so adopting it requires the J8 re-basing
  above.
- **A cheaper delivery path** cannot close a 3.31× gap on its own (§5.2 — the floor alone is
  A$11.30), and the version that helps most is **forbidden by §10.2** and would require a fresh
  threat model, not a config change.
- **A priced add-on** is untouched by any measurement here.

**The numbers point at the lower cap, with the J8 re-basing that implies. That is as far as this
report goes.** It does not choose, and §16.1 J8 is unchanged by this document: *"This is Jay's
number, not engineering's, and it is the one decision in this spec that a build agent may not
make."*

---

## 6. Deviations, gaps and what was not tested

### 6.1 The box was not quiet — the most important caveat here

**This machine is shared with other agents in the same session.** During measurement,
`Get-Process node` showed **24 node processes** and **84% CPU load**, from sibling worktrees
running `npm ci`, a vite dev server, prisma generate and MCP servers. Every leg now records
the system-wide CPU busy fraction it ran under (72–78% during the final sweeps).

**What this does and does not invalidate:**

- **Unaffected — structural and correctness results.** fflate's corrupt central directory,
  ZIP64 validity under three readers, 50,000-entry central-directory correctness, offset
  validity, 50,033 SHA-256 comparisons, byte-identical resume, compression ratios. None depends
  on CPU scheduling. These are the findings decisions 1 and 3 rest on.
- **Mildly affected — RSS.** Ordering was stable across runs (zip.js 824/818 ≫ archiver 473/475
  > yazl 244/146 > fflate 175/167) and every fixture-2 verdict is the same in both runs, but
  yazl's figure moved 244 → 146 MiB between runs, so treat single RSS values as ±40%.
- **Badly affected — maximum single-tick stall.** By definition an extreme-value statistic, and
  it swung 4× on identical input: yazl at 25,000 members measured 25.8, 29.8, 32.0 and 28.3 ms
  in four samples and **129.4 ms** in a fifth taken immediately after a 14 GiB disk flush.
  **The monotonic relationship with member count reproduced every time; the absolute values did
  not.** This is why §4.2 records the member-count limit as **not certifiable on this box**
  rather than quoting the 25,000 the four clean samples would support.

**Fixture 3's verdicts survive anyway**, because at 50,000 members every candidate exceeded the
50 ms threshold by 2–14× in every run — margins far outside the observed noise. **A quiet
machine is required before any member-count limit is written into the spec**, and that is a
named prerequisite for D1c.1, not a footnote.

### 6.2 What was not tested, and is not claimed

- **macOS Archive Utility.** §4.5.1 fixture 5 names three readers; this box is Windows. Info-ZIP
  `unzip` and the Windows Explorer shell handler were tested. **No claim is made about macOS**,
  and the results JSON records it as `untested on this box` rather than assuming.
- **No live upload.** Per the constraint, nothing touched Supabase or any network. §4.4's
  composability verdicts are code-level analysis of each writer's byte sink; the S3-multipart
  and TUS facts in §4.2 are documentation, cited and dated. **A 47 GB upload has not been
  performed and the throughput figures are not Railway measurements.**
- **A 16 GiB leg.** Would have distinguished yazl's fixture-1 flatness miss (a one-time V8 heap
  watermark rise vs. size-proportional growth). Not run. §4.1 states the hypothesis and
  explicitly does not rely on it; the row is scored FAIL.
- **`AsyncZipDeflate`.** fflate's async path was not benchmarked because it spawns a worker per
  file — 50,000 workers on fixture 2. Recorded as a reasoned exclusion, not an oversight.
- **Railway ingress and Supabase ingress rates.** Neither vendor publishes a rate or an explicit
  "free" statement. Modelled at zero **with the assumption stated**, not asserted as free.

### 6.3 One spec figure is out of date, and it changes decision 2

> §4.5.3 states *"TUS/S3 paths reach 50 GB"*.

**That is stale.** Supabase raised the ceiling to **500 GB** — *"Increasing the maximum file
size to 500 GB, up from 50 GB"* (https://supabase.com/blog/storage-500gb-uploads-cheaper-egress-pricing,
2025-07-18), and the current S3-uploads guide and pricing page both state 500 GB. The 50 GB
figure survives only on a stale troubleshooting page that contradicts both. **Consequence: the
upload-protocol term is not the binding constraint §4.5.3 assumed, and the premise that would
have forced split archives does not hold** (§4.2).

### 6.4 Deviations from the method as briefed

- **No disk-forced scaling.** 270 GB was free against a ~21 GiB peak requirement, so fixture 1's
  8 GiB leg ran at full size. **Nothing was scaled down.**
- **Two invocations, one artefact.** An external timeout killed the full run twice at ~55 min.
  The harness was changed to write results **after every candidate**, so fflate/archiver/yazl
  come from the run started `17:52:20Z` and `@zip.js/zip.js` from a second run started
  `18:54:20Z` — identical fixtures, thresholds, sources, machine and commit. The per-candidate
  records are unmodified, the merge is recorded in `mergeNote` in the results file, and the raw
  second-run file is committed alongside.
- **An earlier full run is not committed.** The first complete pass predated the Explorer
  grading fix and the zip.js `zip64` fix (§2 items 3 and 5), so two of its verdicts are known
  wrong — it scored fflate's corrupt >4 GiB archives as opening in Explorer, and failed zip.js
  on a knob the harness had not turned. It is deliberately not kept, so nobody can cite a
  superseded verdict; what it found is recorded in §2 instead.
- **`--smoke` mode** exists for exercising the harness in a minute. It cannot cross 4 GiB, so
  fixture 1 is meaningless under it; every smoke report is stamped `smoke: true`. **All results
  in this report are full-size runs.**

---

## 7. §4.5.7 re-grade — at the 8 GiB cap, on a quiet box (2026-07-29)

**Spec source:** `docs/plans/wave-d-handover-spec-2026-07-28.md` **§4.5.7**, `D1c.1`'s entry
gate. Thresholds are **§4.5.1 verbatim and unchanged** (§4.5.7 item 5).
**Committed results:** `backend/scripts/bench-results/d1c1-writer-regrade-2026-07-29T09-00-00-000Z.json`
(`complete: true`, not a smoke run). Harness: `backend/scripts/bench-zip-spike.mjs`, re-used and
extended — not rewritten. **Recorded against AT-150**, the same assertion re-run at the decided
cap.

### 7.1 THE RESULT, STATED FIRST

> **SUPERSEDED AS THE STANDING OUTCOME BY §7.8, and left unedited as the record of what the
> predeclared bars said.** Jay amended two §4.5.1 rows on 2026-07-29 (spec §16.1 **J10**);
> under the amended bars both candidates pass and **`archiver` 8.0.0 is selected**. No
> measured value below changed.

> **THE GATE FAILS. NO CANDIDATE PASSES AT THE CAP EITHER.** Per §4.5.7 item 6, **D1c re-scopes
> to an object-tree package** — the named fallback, and the only one left now that split
> archives are the shipped design rather than an alternative to it.
>
> **archiver 8.0.0** passes five rows and misses **F3** (max single-tick stall **69.99 ms**
> against 50 ms). **yazl 3.3.1** passes five rows and misses **F1** (RSS flatness **94.7%**
> against ±15%). **Each fails exactly one row, and it is a different row.**
>
> **No threshold was relaxed, and no row was softened.** Both misses were re-confirmed rather
> than taken on a single sample (§7.4).

### 7.2 The fixture table

Two candidates, per §4.5.7: `fflate` is permanently rejected (silent >4 GiB corruption) and
`@zip.js/zip.js` missed two structural bars and does not return.

| | **F1** >4 GiB, RSS ≤256 MiB **and flat ±15%** | **F2** 8,334 members, RSS ≤256 MiB, CD correct | **F3** max stall ≤50 ms, p99 ≤20 ms | **F4** cancel ≤5 s, cleanup ≤30 s | **F5** integrity, **zero** mismatches | **F6** resume byte-identical | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **archiver** 8.0.0 | ✅ **3.6%** (37.48 → 38.82 MiB; single-limb 38.10) | ✅ **93.05 MiB**, 8,334 entries, offsets valid, names unique | ❌ max **69.99 ms** (p99 **4.38** ✓) | ✅ 0.001 s / 0.002 s | ✅ 8,367 members SHA-verified, 0 mismatches | ✅ identical | **reject: F3** |
| **yazl** 3.3.1 | ❌ **94.7%** (19.86 → 38.67 MiB; single-limb 20.32) | ✅ **54.59 MiB**, 8,334 entries, offsets valid, names unique | ✅ max **16.91 ms**, p99 **15.50** | ✅ 0.000 s / 0.001 s | ✅ 8,367 members SHA-verified, 0 mismatches | ✅ identical | **reject: F1** |

Both limbs of F1 were genuinely oversized — 8,592,561,410 / 8,592,561,826 bytes on the total
limb and 4,833,313,097 / 4,833,313,106 on the single-member limb — so neither pass nor fail is
vacuous. F5 covers three archives per candidate under **yauzl** (independent parser), **Info-ZIP
`unzip -t`** and the **Windows Explorer** shell handler; **macOS Archive Utility remains
untested on this box** and is recorded as such, not assumed.

### 7.3 Quietness, which §4.5.7 makes a precondition rather than a hope

- **Idle load before the first leg: 11.5% system CPU busy**, 16 logical CPUs, 22,585 MiB free —
  measured by the harness over a 5 s window with no benchmark child running, and recorded in
  the results file at `regrade.idleLoadBeforeRun`. Against the spike's 72–78%.
- **Every leg records the CPU consumed by processes *other than the benchmark*.** The harness now
  subtracts its own `process.cpuUsage()` (threadpool included, which is where zlib runs) from the
  system-wide busy fraction. Without that subtraction a quietness gate fires on the very work it
  is measuring.
- **`regrade.contendedLegs` is empty.** No leg exceeded the 30% other-process gate, so no leg
  needed the re-run §4.5.7 item 3 mandates. The measurement is admissible on the spec's own terms.
- Sequential throughout: one candidate, one leg, one child process at a time. No sibling agents.

### 7.4 Both misses were re-confirmed, because one sample would not have been enough

§6.1 warns that max single-tick stall is an extreme-value statistic that swung 4× on identical
input under load. archiver's miss is only 1.4× over the bar, so a single sample could not carry
a decision that re-scopes a phase. An **ungraded** attribution probe re-ran the 8,334-member leg
five times per candidate:

| | 1 | 2 | 3 | 4 | 5 | graded run | bar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **archiver** max stall | 72.42 | 71.04 | 67.44 | 72.68 | 65.90 | **69.99** | ≤50 ms |
| **yazl** max stall | 7.41 | 7.11 | 15.56 | 16.38 | 15.51 | **16.91** | ≤50 ms |

**All five archiver samples exceed 50 ms, by 32–45%**, and the graded value sits mid-range.
The FAIL is a stable property of archiver's per-entry cost, not a tail sample. yazl's stalls are
robustly inside.

**yazl's F1 miss needed no probe — it had already been measured twice.** 20.00 → 39.05 MiB
(95.2%) on a loaded box, 19.86 → 38.67 MiB (**94.7%**) on a quiet one. Two runs, two machine
states, the same answer to within 0.5 points. §4.5.7 item 1 anticipated exactly this and
pre-committed the ruling: *"If the quiet figure still misses ±15%, the row stays FAIL."* It
misses. The row stays FAIL.

### 7.5 What the re-run changed — including two claims of this report that did not survive

**§4.5.7's stated expectation was wrong, and the measurement is what counts.** The spec
predicted *"yazl clears and archiver does not"*. **Neither cleared, and the reasoning behind the
prediction inverted:**

1. **archiver was expected to fail F2. It passes F2 comfortably** — **93.05 MiB** at 8,334
   members, against **475.73 MiB** at 50,000. Its per-entry memory cost was never the structural
   defect it looked like at the reference scale; it was a member-count artefact, and the cap
   removes it.
2. **yazl was expected to clear. It does not** — its F1 flatness miss is the one miss in the
   whole field that was never explained by member count, and §4.5.7 item 1 correctly refused it
   a "fresh chance on the arithmetic".
3. **§6.1's caveat is vindicated in both directions.** Quietness mattered enormously where the
   report said it would: archiver's worst stall fell **523.2 → 69.99 ms** and yazl's
   **113.4 → 16.91 ms**, and yazl now *passes* F3, a row it failed at the reference scale. It
   did not rescue anything the report said it would not.
4. **§3.3's conclusion that "archiver's two failures are one failure" is now half-right.** The
   memory half resolved at the cap; the stall half did not. archiver exceeds 50 ms at 5,000
   members and still exceeds it at 8,334 on an idle box — its central-directory write is simply
   expensive per entry.

**What no longer holds:** this report's §1 framing that *"every miss except one is confined to
the 50,000-member leg"* is superseded. At the cap, the member-count misses are gone and what
remains is **two independent, scale-invariant defects** — archiver's per-entry stall and yazl's
RSS flatness — which is precisely why the cap does not rescue the field.

### 7.6 The selection statement

> **SUPERSEDED BY §7.8 — the selection statement that stands is there.** This section is left
> unedited: it is what the un-amended thresholds produced, and its closing paragraph is the
> input that went to Jay. **He acted on it** — both observations it names were converted into
> the two amendments in §16.1 **J10**, and `archiver` 8.0.0 was then selected under §4.5.2's
> axes. The sentence *"a build agent may not change one"* held: no build agent did.

**No writer is selected.** Neither `archiver` nor `yazl` passes all six §4.5.1 fixtures at the
8 GiB / 8,334-member cap on a quiet box. **The §4.5.7 entry gate FAILS, and per §4.5.7 item 6
D1c re-scopes to an object-tree package.**

**This is a named, legitimate outcome, not an accident** — §4.5.1 wrote it down in advance
precisely so it would not read as failure on the day it happened. **The honest thing to record
alongside it:** yazl now misses on a **relative** band while sitting at trivial absolute values
(38.67 MiB is **15% of the 256 MiB cap**), and archiver misses a stall row whose user-facing
rationale `[DH-j]` already removed by moving the worker out of the API process (§16.2). **Both
observations are arguments for changing a threshold, and a build agent may not change one.**
Whether either row should be re-specified is a decision for whoever owns §4.5.1 — recorded here
as an input to that decision, and explicitly **not acted on**.

### 7.7 What was not tested, and is not claimed

- **macOS Archive Utility** — this box is Windows; unchanged from §6.2.
- **No live upload.** Nothing touched Supabase or any network. §3.5's composability verdicts
  are unchanged code-level analysis and were not re-measured.
- **Neither candidate is a product dependency.** Both were dev-installed into the gitignored
  throwaway tree `backend/scripts/bench-zip-deps/` and resolved through a `createRequire` rooted
  there. **No shipping `package.json` was touched** — the winner installs as a prod dep in
  `D1c.1`, and there is no winner to install.
- **The 16 GiB leg** that would distinguish yazl's flatness miss (one-time V8 heap watermark vs
  size-proportional growth) was **still not run**. It is out of scope for a gate whose span
  §4.5.7 fixes at 1 → 8 GiB, and the row is scored FAIL on the span the spec names.

---

### 7.8 ADDENDUM, 2026-07-29 (later the same day) — Jay amended two §4.5.1 thresholds, and a writer IS selected

> **This addendum carries the standing outcome. §7.1 and §7.6 record the outcome *under the
> thresholds as they were predeclared*, and they are left EXACTLY as measured — not edited,
> not softened, not withdrawn.** Read them as the record of what the un-amended bars said.
> What follows changed the bars, not a number.
>
> **Not one measured value in §7.2, §7.3 or §7.4 moved.** The results file is the same file:
> `backend/scripts/bench-results/d1c1-writer-regrade-2026-07-29T09-00-00-000Z.json`.

### 7.8.1 What Jay amended, and why it is his signature and not an engineering edit

**Recorded in the spec as `§16.1 J10`** (`docs/plans/wave-d-handover-spec-2026-07-28.md`), a new
dated row in the register, following J9's precedent. Two rows of §4.5.1, and only two:

1. **F3 (max single-tick stall ≤50 ms, p99 ≤20 ms) binds the API process only.** F3's own
   stated rationale is *"The API process serves user traffic during archive jobs; a 500 ms
   stall is a user-visible outage."* `[DH-j]` — decided **before** this re-grade, on this
   spike's own 50,000-member stall measurements — moved the archive worker out of the API
   process. A stall inside a worker that answers no requests has no user behind it. For the
   worker's own loop the operative bars are **F4** (cancellation observed ≤5 s, cleanup ≤30 s)
   and the §7.4 lease/heartbeat cadence, both of which archiver passes with three orders of
   magnitude of headroom (0.001 s / 0.002 s).
2. **F1's ±15% flatness band governs only where peak RSS exceeds a 128 MiB floor.** Below the
   floor the absolute **≤256 MiB** cap governs alone. The band operationalised "memory flat" to
   catch *unbounded growth*; at yazl's 19.86 → 38.67 MiB it is instead flagging fixed startup
   overhead against scale overhead at **15% of the cap** — a ratio artefact, not a leak.

**These amendments were made AFTER the measurement, which is exactly what predeclaration exists
to prevent.** That is stated here without softening, and it is precisely why they carry **Jay's
dated approval in §16** rather than an engineer's edit to a threshold table. **Untouched and
still predeclared:** F5 integrity (zero mismatches, three readers), F4 cancellation, F6
byte-identical resume, F1's absolute ≤256 MiB cap, F2 in full, and ZIP-standard compatibility.

### 7.8.2 Under the amended bars, both candidates pass — so §4.5.2's tie-break decides

| Candidate | F1 | F2 | F3 | F4 | F5 | F6 | Verdict under the amended bars |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **archiver** 8.0.0 | ✅ 3.6%, **on the band itself** | ✅ 93.05 MiB | ✅ **out of scope** — worker, not the API process | ✅ | ✅ | ✅ | **PASS** |
| **yazl** 3.3.1 | ✅ **via the 128 MiB floor** (38.67 MiB peak) | ✅ 54.59 MiB | ✅ 16.91 ms | ✅ | ✅ | ✅ | **PASS** |

**Worth stating, because it cuts against the selection made below:** archiver's F1 pass does not
depend on the amendment at all — 3.6% clears the band as originally written. yazl's F1 pass
exists **only** because of the floor. Conversely archiver only reaches the tie-break because of
the F3 amendment. Each candidate is here on one amendment; neither is here on both.

### 7.8.3 The five §4.5.2 axes, applied in order, to the measured evidence

§4.5.2 fixes the axes and their order: **ZIP64 support, Node stream backpressure, large-member
support, event-loop behaviour, resumable-upload composability.**

| # | Axis | **archiver** 8.0.0 | **yazl** 3.3.1 | Axis result |
| --- | --- | --- | --- | --- |
| 1 | **ZIP64 support** | 8,592,561,410 B total limb + 4,833,313,097 B single-member limb, both correct; 8,334-entry central directory, offsets valid, names unique; accepted by **yauzl**, **Info-ZIP `unzip -t` exit 0** and the **Windows Explorer shell handler** | 8,592,561,826 B + 4,833,313,106 B, same three readers, same result | **tie** |
| 2 | **Node stream backpressure** | the archive object **is** a `Readable`; native backpressure through `.pipe()` | `zip.outputStream` is a `Readable`; native backpressure | **tie** |
| 3 | **Large-member support** | peak RSS **37.48 → 38.82 MiB** across 1 → 8 GiB output (**3.6%**), single >4 GiB limb 38.10 MiB — measurably flat | **19.86 → 38.67 MiB** (**94.7%**), single limb 20.32 MiB — roughly doubles across the span | **archiver** |
| 4 | **Event-loop behaviour** | max stall **69.99 ms**, and it is confined to the 8,334-member central-directory leg (every other leg ≤16.43 ms); **p99 4.38 ms** | max stall **16.91 ms**; **p99 15.50 ms** | **yazl on the maximum (4.1×); archiver on p99 (3.5×)** |
| 5 | **Resumable-upload composability** | `Readable` straight in as `@aws-sdk/lib-storage` `Upload`'s `Body` — the §4.5.3 delivery path | `outputStream` likewise; identical shape | **tie** |

### 7.8.4 The selection: **`archiver` 8.0.0**

**Three axes are ties on measured evidence. The first axis that separates the candidates is
axis 3, large-member support, and archiver wins it by 26×** — 3.6% against 94.7% across exactly
the 1 → 8 GiB span the cap sets. Axis 4 goes to yazl on maximum stall, and **the axis list ranks
it below axis 3**, which is the whole function of an ordered list: it is applied as written, not
re-ordered after the numbers arrive.

**The honest statement of what that costs, and the argument for the other answer.** yazl wins
axis 4's headline number decisively — 16.91 ms against 69.99 ms — and **if §4.5.2's axes were
ordered event-loop-first, yazl would be selected.** They are not. Three things weigh against
re-reading the order in yazl's favour, all measured:

- **F3's demotion applies here too.** The 69.99 ms tick lands in the archive worker's own loop,
  outside the API process (`[DH-j]`), where no request is queued behind it. Axis 4 still counts —
  it is a real cost to the worker's own responsiveness, including its lease heartbeat — but it
  is not the user-visible cost the axis was written to catch.
- **On the statistic the worker's heartbeat actually depends on, archiver is better.** p99
  4.38 ms against yazl's 15.50 ms. §7.4's lease renewal is a repeated operation, not a
  single-tick one.
- **archiver's stall is bounded and understood**: five ungraded probe samples at 65.9–72.7 ms
  (§7.4), confined to the central-directory write at 8,334 entries — a stable per-entry cost at
  a member count the cap fixes, not a tail that grows with archive size.

**`[DH-j]` is NOT flipped by this selection, and its flip condition is not met.** That condition
required *"the selected writer holds ≤50 ms at the per-archive member ceiling"*. archiver holds
69.99 ms. The worker stays out of the API process, and §15 item 11's assertion — ≤50 ms measured
**against the API process** during a generation run — remains the gate.

**What this addendum does NOT do.** It does not install anything. Both candidates remain
dev-installed in the gitignored `backend/scripts/bench-zip-deps/` tree; **no shipping
`package.json` is touched by this record**. `D1c.1` installs `archiver` 8.0.0 as a production
dependency, under `[DH-c]`. **The object-tree package remains in the spec as D1c's fallback** —
it is not taken, and §4.5.1's naming of it stands unchanged for the day it is needed.
