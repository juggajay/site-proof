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
