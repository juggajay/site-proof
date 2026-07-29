/**
 * Wave D `D1c.0` — streaming ZIP writer + storage spike (spec
 * `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.5). **AT-150.**
 *
 * Six fixtures, every threshold predeclared in the spec and copied verbatim into
 * `FIXTURES` below so the results file carries the bar it was judged against. A
 * candidate that misses one fixture is not selected. If nothing passes, the
 * output is "no candidate passes" (§4.5.1) — a named, legitimate outcome. NO
 * THRESHOLD IN THIS FILE MAY BE RELAXED.
 *
 * CANDIDATES (§4.5.2): `fflate`, `archiver`, `yazl`, and one Web Streams/ZIP64
 * option. The fourth is `@zip.js/zip.js`: of the npm survey (`zip-stream`,
 * `client-zip`, `@zip.js/zip.js`) it is the only one that is Web Streams-native,
 * advertises ZIP64 explicitly, AND documents Node support. `zip-stream` was
 * rejected as a duplicate measurement — it is archiver's own engine, same
 * maintainer, same `compress-commons` core, so benchmarking it alongside
 * `archiver` measures one implementation twice. `client-zip` was rejected as
 * browser/Fetch-oriented: it emits a `Response`/`ReadableStream` and has no Node
 * stream integration, which is the composability axis this spike exists to test.
 * A hand-rolled ZIP container is rejected by spec and is not attempted.
 *
 * DEPENDENCY ISOLATION, and why it is not `backend/node_modules`.
 * The candidates are installed into `scripts/bench-zip-deps/`, a throwaway tree
 * with its own `package.json`, and resolved through a `createRequire` rooted
 * there. Installing them into `backend/node_modules` was tried first and
 * produced a FALSE archiver failure: backend's hoisted `minimatch@9.0.9` (ESM
 * build, `import expand from 'brace-expansion'`) collides with the hoisted
 * `brace-expansion@5.0.8`, which no longer has a default export, and archiver's
 * `readdir-glob` picks up the hoisted copy. That is a backend-tree hoisting
 * collision, not an archiver defect, and scoring a candidate on it would have
 * been fabrication. The isolated tree also makes the §4.5.2 rule — the winner is
 * NOT a product dependency in this PR — mechanically true: nothing is added to
 * any `package.json` that ships.
 *
 *   cd backend/scripts/bench-zip-deps && npm install
 *   # or from the repo root:
 *   npm install --prefix backend/scripts/bench-zip-deps --no-audit --no-fund \
 *     fflate@0.8.3 archiver@8.0.0 yazl@3.3.1 @zip.js/zip.js@2.8.34 yauzl@3.2.0
 *
 * `yauzl` is the harness's INDEPENDENT READER — the same role `pdf-lib` plays in
 * `bench-pdf-folio.mjs`. Every archive is verified by a parser none of the four
 * writers share, so a writer cannot mark its own homework.
 *
 * DISK. ~21 GiB of scratch at peak. Measure free space before running. The
 * scratch root defaults to `os.tmpdir()/civos-d1c0-zip-spike` and is overridable
 * with `--scratch=PATH`. Sources are generated once and reused by all candidates.
 *
 * ALL FIXTURE I/O IS LOCAL DISK. Nothing in this file touches Supabase, any
 * bucket, or any network. The upload-leg composability question (§4.5.2, "does
 * it compose with a resumable upload") is answered by CODE-LEVEL analysis —
 * whether the writer exposes a byte sink a TUS client can consume with
 * backpressure — recorded per candidate in `uploadComposability`, not by a live
 * 8 GiB upload.
 *
 * Run:
 *   cd backend
 *   node scripts/bench-zip-spike.mjs --gen        # generate fixture sources (once)
 *   node scripts/bench-zip-spike.mjs              # run all fixtures, write results
 *
 * Flags: --scratch=PATH  --candidates=a,b  --fixtures=1,2,4,5,6
 *        --scale=N (fraction of the 8 GiB leg, for a smoke run; 1 = full)
 *        --out=PATH  --no-write  --keep (do not delete archives afterwards)
 * Internal: --child=<json-file> makes this file the single-run worker.
 */

import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { Readable, Writable } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(HERE, '..');
const DEPS_ROOT = path.join(HERE, 'bench-zip-deps');
const depRequire = createRequire(path.join(DEPS_ROOT, 'noop.cjs'));

const KiB = 1024;
const MiB = 1024 * KiB;
const GiB = 1024 * MiB;

const CANDIDATES = ['fflate', 'archiver', 'yazl', '@zip.js/zip.js'];

/** Defined here rather than at the CLI because the §4.5.7 constants below read it. */
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

/**
 * The clock every entry is stamped with. ZIP stores a DOS date/time per member;
 * unpinned, fixture 6's byte-identity assertion is untestable for reasons that
 * have nothing to do with resume.
 */
const PINNED_MTIME = new Date('2026-01-01T00:00:00.000Z');
const DEFLATE_LEVEL = 6;

/**
 * §4.5.7 — the D1c.1 entry gate. Two knobs, and NEITHER is a threshold.
 *
 * `--members=N` moves fixture 2's SCALE, not its bar. §4.5.7 item 2 derives the
 * per-archive member ceiling the decided 8 GiB cap implies: the reference dataset
 * (§12) is 50,000 members, it delivers as 6 archives at the cap, and
 * 50,000 / 6 = 8,333.3 -> 8,334. The predeclared pass conditions (peak RSS delta
 * <= 256 MiB, central directory correct) are untouched, and `FIXTURES` below is
 * NOT edited — §4.5.7 item 5: predeclared numbers do not move because the scale
 * did. The central-directory check grades against the count actually offered to
 * the writer, so a smaller run is not a weaker one.
 *
 * `--quiet-max-other-cpu=N` implements §4.5.7 item 3: quietness is a
 * PRECONDITION, not a hope. A leg that ran with more than N% of the box's CPU
 * consumed by processes OTHER than this benchmark is re-run rather than
 * reported. It gates nothing about the writer — it gates whether a measurement
 * is admissible at all.
 */
const F2_MEMBERS = Number(arg('members', 50000));
const F2_LEG_ID = `members-${F2_MEMBERS}`;
const QUIET_MAX_OTHER_CPU_PCT = Number(arg('quiet-max-other-cpu', 30));

// ---------------------------------------------------------------------------
// The predeclared thresholds — spec §4.5.1, transcribed verbatim.
// NOT edited after measuring. A candidate that misses one is not selected.
// ---------------------------------------------------------------------------

const FIXTURES = Object.freeze({
  1: {
    name: '>4 GiB archive (single member >4 GiB AND total >4 GiB, tested separately)',
    pass: 'Archive completes; peak RSS delta <= 256 MiB and flat, i.e. peak RSS at 8 GiB output is within +/-15% of peak RSS at 1 GiB output.',
    peakRssDeltaMiB: 256,
    flatnessTolerancePct: 15,
  },
  2: {
    name: '50,000-member archive',
    pass: 'Completes; peak RSS delta <= 256 MiB; central directory correct — every member listed, offsets valid.',
    peakRssDeltaMiB: 256,
    memberCount: 50000,
  },
  3: {
    name: 'Event loop under load',
    pass: 'Maximum single-tick stall <= 50 ms, p99 <= 20 ms, measured continuously for the whole run.',
    maxStallMs: 50,
    p99StallMs: 20,
  },
  4: {
    name: 'Cancellation mid-write',
    pass: 'Cancellation observed within <= 5 s; all partial objects and temp files removed within <= 30 s; no orphaned handle, no partial object left addressable.',
    observedWithinS: 5,
    removedWithinS: 30,
  },
  5: {
    name: 'Integrity',
    pass: "Archive opens in Windows Explorer, macOS Archive Utility and `unzip`; every member's extracted SHA-256 equals its recorded sourceChecksum; zero mismatches — not a rate.",
    mismatchesAllowed: 0,
    note: 'This box is Windows. Windows Explorer (the shell Zip folder handler, via Shell.Application COM) and Info-ZIP `unzip` are tested. macOS Archive Utility is UNTESTED ON THIS BOX and is recorded as such — no claim is made about it.',
  },
  6: {
    name: 'Resume after process kill',
    pass: 'Kill mid-archive, restart: the job resumes from the frozen ledger, completes, and its final archive is byte-identical to an uninterrupted run over the same frozen members.',
    note: 'The D1c.1 ledger does not exist yet. It is SIMULATED here as a fixed JSON member list (scripts/bench-results/d1c0-frozen-members.json). Per spec §4.6.3 the honest default is that ZIP assembly RESTARTS from the frozen member ledger, so the assertion this fixture actually makes is: the writer produces byte-identical output for the same frozen member list, across processes, after a SIGKILL.',
  },
});

/**
 * §4.5.6 / J8. Jay's number. A build agent may not move it.
 */
const COST_CEILING_AUD_EX_GST = 12.0;

// ---------------------------------------------------------------------------
// Synthetic fixture content — §4.5.3 compression realism
// ---------------------------------------------------------------------------

/**
 * xorshift128 fill. Genuinely incompressible at deflate's 32 KiB window, fast
 * enough to generate gigabytes, and DETERMINISTIC from a seed — which fixture 6
 * needs, since two processes have to produce the same member bytes.
 *
 * ponytail: a seeded PRNG rather than crypto.randomFillSync, because fixture 6
 * needs reproducibility and crypto random cannot give it.
 */
function makePrng(seed) {
  let s0 = (seed ^ 0x9e3779b9) >>> 0 || 1;
  let s1 = ((seed * 2654435761) ^ 0x85ebca6b) >>> 0 || 2;
  // STATEFUL across calls, which is what makes the chunked stream and the
  // one-shot buffer produce identical bytes: every non-final chunk is a multiple
  // of 4, so the same number of PRNG states is consumed either way.
  return (buf) => {
    let i = 0;
    for (; i + 4 <= buf.length; i += 4) {
      const t = (s0 ^ (s0 << 11)) >>> 0;
      s0 = s1;
      s1 = (s1 ^ (s1 >>> 19) ^ t ^ (t >>> 8)) >>> 0;
      buf.writeUInt32LE(s1, i);
    }
    for (; i < buf.length; i += 1) buf[i] = (s1 >>> ((i % 4) * 8)) & 0xff;
    return buf;
  };
}

const prngFill = (buf, seed) => makePrng(seed)(buf);

/** Compressible content, shaped like the CSV/JSON a manifest and a test register carry. */
const TEXT_CORPUS = [
  'lot,test,type,result,chainage,date,operator,lab',
  'LOT-0001,TR-0001-01,Field density (nuclear gauge),pass,CH1250,2026-06-11,J Ryan,NATA 1234',
  'LOT-0001,TR-0001-02,CBR - 4 day soak,pass,CH1260,2026-06-11,J Ryan,NATA 1234',
  'LOT-0001,TR-0001-03,Particle size distribution,pass,CH1270,2026-06-12,M Lennox,NATA 1234',
  '{"documentType":"test_certificate","uploadedBy":"j.ryan@example.com","lot":"LOT-0001"}',
].join('\n');

function textBuffer(size, seed) {
  const unit = `${TEXT_CORPUS}\n# member ${seed}\n`;
  const reps = Math.ceil(size / unit.length);
  return Buffer.from(unit.repeat(reps).slice(0, size), 'utf8');
}

/**
 * The §4.5.3 mix, DECLARED here and recorded in the results so the compression
 * ratio the headroom margin comes from is traceable to a stated composition.
 * Evidence archives are byte-dominated by already-compressed photographs; the
 * text minority is real (manifests, registers, exported CSV) but small.
 */
const MEMBER_MIX = Object.freeze([
  { class: 'photo', share: 0.78, minBytes: 12 * KiB, maxBytes: 28 * KiB, compressible: 0 },
  { class: 'pdf', share: 0.15, minBytes: 24 * KiB, maxBytes: 56 * KiB, compressible: 0.2 },
  { class: 'text', share: 0.07, minBytes: 2 * KiB, maxBytes: 8 * KiB, compressible: 1 },
]);

const CATEGORIES = { photo: 'photos', pdf: 'test-certificates', text: 'registers' };
const EXT = { photo: '.jpg', pdf: '.pdf', text: '.csv' };

/**
 * Deterministic member content, produced in BOUNDED CHUNKS.
 *
 * The first version of this materialised each member as one whole Buffer and fed
 * that to the writer. It measured yazl's peak RSS delta at 1,230 MiB on the
 * 50,000-member leg and its worst event-loop stall at 149 ms — both of which
 * were the HARNESS's own allocation churn and GC, not the library's. Charging a
 * candidate for the bench's garbage would have failed all four on fixtures 2 and
 * 3 and produced a false "no candidate passes". Real members arrive as streams
 * off disk or storage; so do these.
 */
function* memberChunks(member, chunkSize = 64 * KiB) {
  const compressible = Math.round(member.size * member.compressible);
  if (compressible > 0) yield textBuffer(compressible, member.seed);
  const prng = makePrng(member.seed);
  let remaining = member.size - compressible;
  while (remaining > 0) {
    const n = Math.min(chunkSize, remaining);
    yield prng(Buffer.allocUnsafe(n));
    remaining -= n;
  }
}

/** The same bytes, in one piece — used only for checksum computation. */
const materialise = (member) => Buffer.concat([...memberChunks(member, 1 << 30)]);

/**
 * The member plan. Deterministic from (count, seed) so every candidate and every
 * process builds the same archive from the same bytes.
 */
function planMembers(count, baseSeed) {
  const members = [];
  let cum = 0;
  const buckets = MEMBER_MIX.map((m) => ({ ...m, upTo: (cum += m.share) }));
  for (let i = 0; i < count; i += 1) {
    const seed = (baseSeed + i * 2654435761) >>> 0;
    const r = ((seed >>> 8) % 10000) / 10000;
    const bucket = buckets.find((b) => r < b.upTo) ?? buckets[buckets.length - 1];
    const span = bucket.maxBytes - bucket.minBytes;
    const size = bucket.minBytes + ((seed >>> 3) % (span + 1));
    const lot = String(Math.floor(i / 25) + 1).padStart(4, '0');
    members.push({
      path: `LOT-${lot}/${CATEGORIES[bucket.class]}/CH${1250 + (i % 900)}_m${String(i).padStart(6, '0')}${EXT[bucket.class]}`,
      kind: 'prng',
      class: bucket.class,
      seed,
      size,
      compressible: bucket.compressible,
    });
  }
  return members;
}

// ---------------------------------------------------------------------------
// Source generation — the on-disk fixtures (§4.5: local disk only)
// ---------------------------------------------------------------------------

const SRC = (scratch) => path.join(scratch, 'src');

/**
 * `--smoke` shrinks the on-disk sources so the harness itself can be exercised in
 * a minute. It is NOT a measurement mode: a smoke run cannot cross 4 GiB, so
 * fixture 1 is meaningless under it. Every smoke report is stamped `smoke: true`
 * and `SMOKE` in its verdict so it can never be mistaken for the real pass. The
 * reported run is full-size; §4.5 permits scaling only if disk cannot hold the
 * 8 GiB leg, and this box has 271 GiB free.
 */
const SMOKE = process.argv.includes('--smoke') || process.env.BENCH_ZIP_SMOKE === '1';
const HUGE_MEMBER_BYTES = SMOKE ? 48 * MiB : Math.round(4.5 * GiB); // > 4 GiB: the single-member ZIP64 limb
const BLOCK_BYTES = SMOKE ? 8 * MiB : 256 * MiB;
const BLOCK_COUNT = 8;

function generateSources(scratch) {
  const dir = SRC(scratch);
  fs.mkdirSync(dir, { recursive: true });
  const written = [];
  const emit = (file, bytes, seed) => {
    const target = path.join(dir, file);
    if (fs.existsSync(target) && fs.statSync(target).size === bytes) {
      written.push({ file, bytes, sha256: readSha(target), reused: true });
      return;
    }
    const chunk = Buffer.allocUnsafe(4 * MiB);
    const fd = fs.openSync(target, 'w');
    const hash = createHash('sha256');
    let done = 0;
    let s = seed;
    while (done < bytes) {
      const n = Math.min(chunk.length, bytes - done);
      prngFill(chunk.subarray(0, n), (s = (s * 1664525 + 1013904223) >>> 0));
      fs.writeSync(fd, chunk, 0, n);
      hash.update(chunk.subarray(0, n));
      done += n;
    }
    fs.closeSync(fd);
    written.push({ file, bytes, sha256: hash.digest('hex'), reused: false });
    process.stdout.write(`  generated ${file} (${(bytes / GiB).toFixed(2)} GiB)\n`);
  };
  emit('huge.bin', HUGE_MEMBER_BYTES, 0xc1005);
  for (let i = 0; i < BLOCK_COUNT; i += 1)
    emit(`blk-${String(i).padStart(2, '0')}.bin`, BLOCK_BYTES, 0x5170 + i);
  return written;
}

function readSha(file) {
  const hash = createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.allocUnsafe(8 * MiB);
  for (;;) {
    const n = fs.readSync(fd, buf, 0, buf.length, null);
    if (n <= 0) break;
    hash.update(buf.subarray(0, n));
  }
  fs.closeSync(fd);
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// Writer adapters
// ---------------------------------------------------------------------------

/**
 * Every adapter is driven the same way: ONE member in flight at a time, the
 * previous fully consumed before the next is offered. That is what a real worker
 * over a frozen ledger does, and it is the only way the four are comparable —
 * `archiver.append()` returns immediately and would otherwise queue 50,000
 * materialised buffers in memory, charging the library for the harness's
 * decision to shove everything at it at once.
 */

/**
 * Every member is a stream, whatever its origin — file members off disk, PRNG
 * members out of `memberChunks`. Uniform so the four candidates are compared on
 * one input shape, and streamed so the harness holds 64 KiB, not a whole member.
 */
function memberSource(member, scratch) {
  if (member.kind === 'file')
    return { stream: () => fs.createReadStream(path.join(SRC(scratch), member.file)), size: member.size };
  return { stream: () => Readable.from(memberChunks(member)), size: member.size };
}

/**
 * Backpressure wait. Resolves on `close`/`error` as well as `drain`, because a
 * cancellation destroys the sink and a plain `once('drain')` would then wait
 * forever — which would have made fixture 4 hang rather than fail.
 */
const drain = (ws) =>
  new Promise((res) => {
    if (ws.destroyed || ws.writableEnded || ws.writableLength < ws.writableHighWaterMark) return res();
    const done = () => {
      ws.off('drain', done);
      ws.off('close', done);
      ws.off('error', done);
      res();
    };
    ws.once('drain', done);
    ws.once('close', done);
    ws.once('error', done);
  });

/**
 * Wires `ctx.abort` so the whole run can be torn down MID-MEMBER, and gives the
 * adapters a promise to race their per-member waits against. Cancelling only at
 * member boundaries would have measured the harness's 256 MiB member size, not
 * the writer's responsiveness — and §4.5.1 fixture 4 says "mid-write".
 */
function wireAbort(ctx, teardown) {
  ctx.aborted = new Promise((res) => {
    ctx.abort = () => {
      if (ctx.cancelled) return;
      ctx.cancelled = true;
      try {
        teardown();
      } catch (err) {
        ctx.teardownError = String(err?.message ?? err);
      }
      res();
    };
  });
}

const adapters = {
  /**
   * archiver 8. `new ZipArchive(...)` — v8 dropped the callable factory. Pipes
   * a Node Readable, so the upload leg is a plain `.pipe()`.
   */
  async archiver(members, outPath, ctx) {
    const { ZipArchive } = depRequire('archiver');
    const ws = fs.createWriteStream(outPath);
    const a = new ZipArchive({ zlib: { level: DEFLATE_LEVEL }, forceZip64: ctx.forceZip64 });
    const failed = new Promise((_, rej) => a.on('error', rej));
    const closed = new Promise((res) => ws.on('close', res));
    a.pipe(ws);
    wireAbort(ctx, () => {
      if (typeof a.abort === 'function') a.abort();
      else a.destroy(new Error('cancelled'));
      ws.destroy();
    });
    for (const m of members) {
      ctx.mark?.(ws.bytesWritten);
      if (ctx.cancelled) break;
      const src = memberSource(m, ctx.scratch);
      const entered = new Promise((res) => a.once('entry', res));
      await Promise.race([
        (async () => {
          a.append(src.stream(), { name: m.path, date: PINNED_MTIME });
          await entered;
          await drain(ws);
        })(),
        failed,
        ctx.aborted,
      ]);
      if (ctx.cancelled) break;
    }
    if (ctx.cancelled) return { bytesOut: ws.bytesWritten, cancelled: true };
    await Promise.race([a.finalize(), failed]);
    await closed;
    return { bytesOut: fs.statSync(outPath).size };
  },

  /**
   * yazl. `addReadStream` with a declared size so yazl makes its OWN ZIP64
   * decision per entry rather than being told; `outputStream` is a Node Readable.
   */
  async yazl(members, outPath, ctx) {
    const yazl = depRequire('yazl');
    const zip = new yazl.ZipFile();
    const ws = fs.createWriteStream(outPath);
    const failed = new Promise((_, rej) => {
      ws.on('error', rej);
      zip.outputStream.on('error', rej);
    });
    const closed = new Promise((res) => ws.on('close', res));
    zip.outputStream.pipe(ws);
    wireAbort(ctx, () => {
      zip.outputStream.unpipe(ws);
      zip.outputStream.destroy();
      ws.destroy();
    });
    for (const m of members) {
      ctx.mark?.(ws.bytesWritten);
      if (ctx.cancelled) break;
      const src = memberSource(m, ctx.scratch);
      const stream = src.stream();
      // yazl processes its entry queue serially; awaiting the source stream's
      // end is the equivalent of archiver's 'entry' event.
      const consumed = new Promise((res) => stream.once('end', res));
      zip.addReadStream(stream, m.path, {
        mtime: PINNED_MTIME,
        mode: 0o100644,
        size: src.size,
        compress: true,
      });
      await Promise.race([consumed.then(() => drain(ws)), failed, ctx.aborted]);
      if (ctx.cancelled) {
        stream.destroy();
        break;
      }
    }
    if (ctx.cancelled) return { bytesOut: ws.bytesWritten, cancelled: true };
    zip.end();
    await Promise.race([closed, failed]);
    return { bytesOut: fs.statSync(outPath).size };
  },

  /**
   * fflate. `Zip` + `ZipDeflate` — the SYNCHRONOUS deflate path, deliberately.
   * `AsyncZipDeflate` spawns a worker PER FILE, which at 50,000 members is
   * 50,000 workers; that is not a configuration a production worker can run, so
   * the sync path is the honest subject. The consequence for the event loop is
   * the measurement, not a surprise.
   */
  async fflate(members, outPath, ctx) {
    const fflate = depRequire('fflate');
    const ws = fs.createWriteStream(outPath);
    let zipError = null;
    let ended = false;
    const closed = new Promise((res) => ws.on('close', res));
    const zip = new fflate.Zip((err, chunk, final) => {
      if (err) {
        zipError = err;
        return;
      }
      if (chunk && chunk.length) ws.write(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.length));
      if (final) {
        ended = true;
        ws.end();
      }
    });
    wireAbort(ctx, () => {
      try {
        zip.terminate();
      } catch {
        /* terminate after end throws; the sink is destroyed below regardless */
      }
      ws.destroy();
    });

    const pushChunks = async (file, stream) => {
      let prev = null;
      for await (const c of stream) {
        if (zipError || ctx.cancelled) {
          stream.destroy();
          return;
        }
        if (prev) {
          file.push(prev, false);
          await drain(ws);
        }
        prev = new Uint8Array(c.buffer, c.byteOffset, c.length);
      }
      if (zipError || ctx.cancelled) return;
      file.push(prev ?? new Uint8Array(0), true);
      await drain(ws);
    };

    for (const m of members) {
      ctx.mark?.(ws.bytesWritten);
      if (zipError || ctx.cancelled) break;
      const src = memberSource(m, ctx.scratch);
      const file = new fflate.ZipDeflate(m.path, { level: DEFLATE_LEVEL });
      // THE KNOB NOBODY TURNS. `new ZipDeflate(name, { mtime })` SILENTLY IGNORES
      // mtime: the constructor forwards `opts` to the Deflate compressor only
      // (`lib/index.cjs:1984-1992`) and the ZIP writer reads `f.mtime` off the
      // FILE OBJECT (`:1889`, `new Date(f.mtime == null ? Date.now() : f.mtime)`).
      // Passed as a constructor option it lands nowhere, every entry is stamped
      // with Date.now(), and fixture 6 fails on a two-second DOS-time granularity
      // difference — which is what this harness measured before the property was
      // assigned directly. Diffing two archives showed exactly six differing
      // bytes, all of them the local/central mod-time field. Recorded as a
      // finding, not scored as non-determinism.
      file.mtime = PINNED_MTIME;
      zip.add(file);
      await pushChunks(file, src.stream());
    }
    if (ctx.cancelled) return { bytesOut: ws.bytesWritten, cancelled: true };
    if (zipError) throw zipError;
    if (!ended) zip.end();
    await closed;
    if (zipError) throw zipError;
    return { bytesOut: fs.statSync(outPath).size };
  },

  /**
   * @zip.js/zip.js — the Web Streams candidate. `Writable.toWeb` on the sink,
   * `Readable.toWeb` on file members. `bufferedWrite:false` is essential:
   * buffered writes hold whole entries in memory. `useWebWorkers:false` keeps it
   * in-process so the event-loop measurement is of the writer, not of a worker
   * pool the API process would also have to host.
   */
  async '@zip.js/zip.js'(members, outPath, ctx) {
    const zipjs = await import('@zip.js/zip.js');
    zipjs.configure({ useWebWorkers: false, useCompressionStream: true });
    const ws = fs.createWriteStream(outPath);
    const closed = new Promise((res) => ws.on('close', res));
    const controller = new AbortController();
    const writer = new zipjs.ZipWriter(Writable.toWeb(ws), {
      level: DEFLATE_LEVEL,
      bufferedWrite: false,
      keepOrder: true,
      // ALWAYS TRUE, and this is the second knob nobody turns. Passing
      // `zip64: ctx.forceZip64` (true only on the single->4 GiB leg) made zip.js
      // THROW on the total->4 GiB leg — "Zip64 is not supported (set the 'zip64'
      // option to 'true')" — and it was recorded as a writer failure until this
      // was corrected. zip.js will not silently emit a broken archive, which is
      // the opposite of fflate's behaviour on the same fixture and much the
      // better failure mode; but it does require the CALLER to declare ZIP64 up
      // front. A production archive job cannot know whether its output will
      // cross 4 GiB until the last byte, so the only safe setting is
      // unconditional. Cost is ~20 bytes of extra field per entry.
      zip64: true,
    });
    wireAbort(ctx, () => {
      controller.abort();
      ws.destroy();
    });
    try {
      for (const m of members) {
        ctx.mark?.(ws.bytesWritten);
        if (ctx.cancelled) break;
        const src = memberSource(m, ctx.scratch);
        await Promise.race([
          writer.add(
            m.path,
            { readable: Readable.toWeb(src.stream()) },
            {
              lastModDate: PINNED_MTIME,
              signal: controller.signal,
              zip64: ctx.forceZip64 || src.size >= 0xffffffff,
            },
          ),
          ctx.aborted,
        ]);
        if (ctx.cancelled) break;
      }
      if (ctx.cancelled) return { bytesOut: ws.bytesWritten, cancelled: true };
      await writer.close();
    } finally {
      // terminateWorkers() returns undefined (not a promise) at 2.8.34 with
      // useWebWorkers:false — `.catch` on it threw and was misreported as a
      // writer failure on every leg until this was wrapped.
      try {
        await zipjs.terminateWorkers?.();
      } catch {
        /* nothing to terminate */
      }
    }
    await closed;
    return { bytesOut: fs.statSync(outPath).size };
  },
};

/**
 * §4.5.2's fifth axis, answered by reading each library's surface rather than by
 * a live upload. The question a TUS/S3 client asks is: can I get bytes out as a
 * flow-controlled stream without the writer having materialised the archive?
 */
const UPLOAD_COMPOSABILITY = Object.freeze({
  archiver: {
    sink: 'Node Readable (archive.pipe(dest)) — the archive object IS a Readable',
    backpressure: 'native Node stream backpressure; pipe() to any Writable, including a TUS/S3 uploader',
    verdict: 'direct',
  },
  yazl: {
    sink: 'Node Readable (zip.outputStream)',
    backpressure: 'native Node stream backpressure on outputStream',
    verdict: 'direct',
  },
  fflate: {
    sink: 'callback delivering Uint8Array chunks',
    backpressure:
      'NONE from the library — the caller must stop pushing source data when its own sink says wait. Composes only if the feeding loop implements backpressure, as this harness does.',
    verdict: 'manual',
  },
  '@zip.js/zip.js': {
    sink: 'WritableStream (Web Streams) or a zip.js Writer',
    backpressure:
      'Web Streams backpressure into the WritableStream; Writable.toWeb() bridges a Node sink. A TUS client that exposes a WritableStream composes directly; a Node-stream client needs the toWeb bridge.',
    verdict: 'direct (via Web Streams)',
  },
});

// ---------------------------------------------------------------------------
// Instrumentation — RSS + event-loop delay, continuous for the whole run (§4.5.1 #3)
// ---------------------------------------------------------------------------

/** System-wide CPU busy fraction between two `os.cpus()` reads. */
function cpuSnapshot() {
  const t = os.cpus().reduce(
    (a, c) => {
      for (const k of Object.keys(c.times)) a[k === 'idle' ? 'idle' : 'busy'] += c.times[k];
      return a;
    },
    { idle: 0, busy: 0 },
  );
  return t;
}

function startMonitors() {
  const loop = monitorEventLoopDelay({ resolution: 1 });
  loop.enable();
  const rss = [];
  const baselineRss = process.memoryUsage().rss;
  const baselineMaxRss = process.resourceUsage().maxRSS;
  // THIS BOX IS SHARED. Other agents in the same session run `npm ci`, vite,
  // prisma and MCP servers in sibling worktrees, and the load is not constant.
  // Identical fixtures measured 32 ms and 129 ms of worst-case stall in two
  // sessions, so every leg records the system-wide CPU busy fraction it ran
  // under. A stall number without its concurrent load is not reproducible, and
  // saying so is cheaper than pretending the box was quiet.
  const cpu0 = cpuSnapshot();
  // §4.5.7 item 3 needs "busy because of OTHER processes", not "busy". This
  // benchmark deflates at level 6 and legitimately burns a core or more of its
  // own; subtracting its own usage is the difference between a quietness gate
  // and a gate that fires on the thing it is measuring.
  const own0 = process.cpuUsage();
  const wall0 = performance.now();
  const timer = setInterval(() => rss.push(process.memoryUsage().rss), 100);
  timer.unref();
  return {
    stop() {
      const cpu1 = cpuSnapshot();
      const dBusy = cpu1.busy - cpu0.busy;
      const dIdle = cpu1.idle - cpu0.idle;
      const systemCpuBusyPct = dBusy + dIdle > 0 ? Number(((100 * dBusy) / (dBusy + dIdle)).toFixed(1)) : null;
      const own = process.cpuUsage(own0);
      const wallMs = performance.now() - wall0;
      const cores = os.cpus().length;
      // Own CPU as a fraction of the whole box, so it is on the same scale as
      // systemCpuBusyPct. cpuUsage() is microseconds and covers the libuv
      // threadpool, which is where zlib actually runs.
      const ownCpuBusyPct =
        wallMs > 0 && cores > 0
          ? Number((((own.user + own.system) / 1000 / (wallMs * cores)) * 100).toFixed(1))
          : null;
      const otherCpuBusyPct =
        systemCpuBusyPct == null || ownCpuBusyPct == null
          ? null
          : Number(Math.max(0, systemCpuBusyPct - ownCpuBusyPct).toFixed(1));
      clearInterval(timer);
      loop.disable();
      const maxRss = process.resourceUsage().maxRSS;
      const sorted = rss.slice().sort((a, b) => a - b);
      const p = (q) => sorted[Math.min(sorted.length - 1, Math.ceil((q / 100) * sorted.length) - 1)] ?? 0;
      const ms = (ns) => Number((ns / 1e6).toFixed(3));
      return {
        systemCpuBusyPct,
        ownCpuBusyPct,
        otherCpuBusyPct,
        cpuCount: os.cpus().length,
        eventLoopDelayMs: {
          samples: loop.count,
          min: ms(loop.min),
          p50: ms(loop.percentile(50)),
          p99: ms(loop.percentile(99)),
          max: ms(loop.max),
          mean: ms(loop.mean),
          resolutionMs: 1,
          note: 'perf_hooks.monitorEventLoopDelay at 1 ms resolution; values include the 1 ms sampling interval as a floor.',
        },
        rssMiB: {
          samples: rss.length,
          baseline: +(baselineRss / MiB).toFixed(2),
          min: +(p(0) / MiB).toFixed(2),
          p50: +(p(50) / MiB).toFixed(2),
          p99: +(p(99) / MiB).toFixed(2),
          max: +(p(100) / MiB).toFixed(2),
          peakDelta: +((p(100) - baselineRss) / MiB).toFixed(2),
          // resourceUsage().maxRSS is in KB and monotonic; the delta is peak growth.
          peakDeltaMaxRss: +((maxRss - baselineMaxRss) / 1024).toFixed(2),
        },
      };
    },
  };
}

/**
 * §4.5.7 item 3's precondition, measured rather than asserted: the box's
 * system-wide CPU busy fraction over `ms` with nothing of ours running. Recorded
 * in the report so "the box was quiet" is a number a reader can check, not a
 * claim the author made about their own machine.
 */
async function measureIdle(ms = 5000) {
  const a = cpuSnapshot();
  await new Promise((r) => setTimeout(r, ms));
  const b = cpuSnapshot();
  const dBusy = b.busy - a.busy;
  const dIdle = b.idle - a.idle;
  return {
    windowMs: ms,
    systemCpuBusyPct: dBusy + dIdle > 0 ? Number(((100 * dBusy) / (dBusy + dIdle)).toFixed(1)) : null,
    cpuCount: os.cpus().length,
    freeMemMiB: Math.round(os.freemem() / MiB),
    measuredBefore: 'the first candidate leg, with no benchmark child running',
  };
}

// ---------------------------------------------------------------------------
// The child worker — one (candidate, leg) per process
// ---------------------------------------------------------------------------

function legMembers(leg) {
  const block = (i) => ({
    kind: 'file',
    file: `blk-${String(i % BLOCK_COUNT).padStart(2, '0')}.bin`,
    size: BLOCK_BYTES,
  });
  switch (leg.kind) {
    case 'huge-member':
      return [{ kind: 'file', file: 'huge.bin', size: HUGE_MEMBER_BYTES, path: 'LOT-0001/cctv/run-01.mp4' }];
    case 'blocks': {
      const out = [];
      for (let i = 0; i < leg.count; i += 1)
        out.push({ ...block(i), path: `LOT-${String(Math.floor(i / 4) + 1).padStart(4, '0')}/photos/blk-${String(i).padStart(3, '0')}.bin` });
      return out;
    }
    case 'many':
      return planMembers(leg.count, 0x51701c00);
    case 'frozen':
      return JSON.parse(fs.readFileSync(leg.ledger, 'utf8')).members;
    default:
      throw new Error(`unknown leg kind ${leg.kind}`);
  }
}

async function runChild(job) {
  const { candidate, leg, scratch, outPath } = job;
  const result = { candidate, leg: leg.id, pid: process.pid, error: null };
  const members = legMembers(leg);
  const inputBytes = members.reduce((n, m) => n + m.size, 0);
  const ctx = { scratch, forceZip64: Boolean(leg.forceZip64), cancelled: false };
  let cancelTimer = null;

  if (leg.cancelAfterMs) {
    // MID-WRITE, on a timer — not at a member boundary. With 256 MiB members a
    // boundary-triggered cancel would have measured the harness's member size.
    cancelTimer = setTimeout(() => {
      result.cancelRequestedAt = performance.now();
      result.bytesAtCancelRequest = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
      ctx.abort?.();
    }, leg.cancelAfterMs);
  }
  if (leg.killAtBytes) {
    // The kill is the PARENT's job (SIGKILL from outside); the child only says
    // when it has crossed the threshold so the parent does not race start-up.
    ctx.mark = (written) => {
      if (written >= leg.killAtBytes && !result.killReady) {
        result.killReady = true;
        process.send?.({ type: 'kill-ready', bytes: written });
      }
    };
  }

  const mon = startMonitors();
  const t0 = performance.now();
  try {
    const out = await adapters[candidate](members, outPath, ctx);
    result.wallClockMs = Number((performance.now() - t0).toFixed(1));
    result.bytesOut = out.bytesOut;
    result.cancelled = Boolean(out.cancelled);
    if (result.cancelRequestedAt != null)
      result.cancelObservedMs = Number((performance.now() - result.cancelRequestedAt).toFixed(1));
  } catch (err) {
    result.wallClockMs = Number((performance.now() - t0).toFixed(1));
    // A cancellation that surfaces as a stream error is a CANCELLATION, not a
    // failure — the sink was destroyed on purpose.
    if (ctx.cancelled) {
      result.cancelled = true;
      result.cancelErrorSurfaced = String(err?.message ?? err);
      if (result.cancelRequestedAt != null)
        result.cancelObservedMs = Number((performance.now() - result.cancelRequestedAt).toFixed(1));
    } else {
      result.error = { message: String(err?.message ?? err), name: err?.name ?? null };
    }
    try {
      result.bytesOut = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
    } catch {
      result.bytesOut = 0;
    }
  }
  clearTimeout(cancelTimer);
  Object.assign(result, mon.stop());
  result.memberCount = members.length;
  result.inputBytes = inputBytes;
  result.compressionRatio =
    result.bytesOut && inputBytes ? Number((result.bytesOut / inputBytes).toFixed(6)) : null;
  // The cleanup leg of fixture 4: remove the partial object and time it.
  if (leg.cancelAfterMs) {
    const t1 = performance.now();
    const before = fs.existsSync(outPath);
    try {
      fs.rmSync(outPath, { force: true });
    } catch (err) {
      result.cleanupError = String(err?.message ?? err);
    }
    result.cleanup = {
      partialExisted: before,
      partialBytes: result.bytesOut,
      removedMs: Number((performance.now() - t1).toFixed(1)),
      stillPresent: fs.existsSync(outPath),
      openHandlesAfter: process.getActiveResourcesInfo().filter((r) => r === 'FSReqCallback' || r === 'FileHandle').length,
    };
  }
  process.stdout.write(`\nBENCH_JSON:${JSON.stringify(result)}\n`);
}

// ---------------------------------------------------------------------------
// Independent verification — yauzl (fixtures 2 and 5)
// ---------------------------------------------------------------------------

/**
 * Walks the central directory with a parser NONE of the four writers share,
 * checks every recorded local-header offset actually carries a local header
 * signature, and (when `expected` is supplied) SHA-256s every member's
 * decompressed bytes against its recorded sourceChecksum.
 */
async function verifyArchive(zipPath, expected, opts = {}) {
  const yauzl = depRequire('yauzl');
  const fd = fs.openSync(zipPath, 'r');
  const sigBuf = Buffer.allocUnsafe(4);
  const out = {
    entryCount: 0,
    namesUnique: true,
    offsetsValid: true,
    badOffsets: [],
    sizeMismatches: [],
    shaChecked: 0,
    shaMismatches: [],
    error: null,
  };
  try {
    const zf = await new Promise((res, rej) =>
      yauzl.open(zipPath, { lazyEntries: true, autoClose: false, strictFileNames: false }, (e, z) =>
        e ? rej(e) : res(z),
      ),
    );
    out.entryCount = zf.entryCount;
    const seen = new Set();
    const readEntry = () =>
      new Promise((res, rej) => {
        zf.once('entry', res);
        zf.once('end', () => res(null));
        zf.once('error', rej);
        zf.readEntry();
      });
    for (;;) {
      const entry = await readEntry();
      if (!entry) break;
      zf.removeAllListeners('entry');
      zf.removeAllListeners('end');
      zf.removeAllListeners('error');
      if (seen.has(entry.fileName)) out.namesUnique = false;
      seen.add(entry.fileName);
      // Offset validity: 0x04034b50 is the local file header signature.
      fs.readSync(fd, sigBuf, 0, 4, entry.relativeOffsetOfLocalHeader);
      if (sigBuf.readUInt32LE(0) !== 0x04034b50) {
        out.offsetsValid = false;
        if (out.badOffsets.length < 20)
          out.badOffsets.push({ name: entry.fileName, offset: entry.relativeOffsetOfLocalHeader });
      }
      const want = expected?.get(entry.fileName);
      if (want && entry.uncompressedSize !== want.size)
        if (out.sizeMismatches.length < 20)
          out.sizeMismatches.push({ name: entry.fileName, got: entry.uncompressedSize, want: want.size });
      if (want && !opts.skipSha) {
        const rs = await new Promise((res, rej) =>
          zf.openReadStream(entry, (e, s) => (e ? rej(e) : res(s))),
        );
        const hash = createHash('sha256');
        await new Promise((res, rej) => {
          rs.on('data', (c) => hash.update(c));
          rs.on('end', res);
          rs.on('error', rej);
        });
        const got = hash.digest('hex');
        out.shaChecked += 1;
        if (got !== want.sha256 && out.shaMismatches.length < 20)
          out.shaMismatches.push({ name: entry.fileName, got, want: want.sha256 });
      }
    }
    zf.close();
  } catch (err) {
    out.error = String(err?.message ?? err);
  } finally {
    fs.closeSync(fd);
  }
  out.everyMemberListed = expected ? out.entryCount === expected.size : null;
  out.mismatches = out.shaMismatches.length + out.sizeMismatches.length;
  return out;
}

/** Info-ZIP `unzip -t` — CRC-verifies every member without extracting. */
function unzipTest(zipPath) {
  const res = spawnSync('unzip', ['-t', '-qq', zipPath], { encoding: 'utf8', maxBuffer: 64 * MiB });
  return {
    tool: 'Info-ZIP unzip',
    version: spawnSync('unzip', ['-v'], { encoding: 'utf8' }).stdout?.split('\n')[0]?.trim() ?? null,
    exitCode: res.status,
    opens: res.status === 0,
    stderr: (res.stderr ?? '').slice(0, 600),
  };
}

/**
 * Windows Explorer's Zip folder handler, driven through the same COM interface
 * Explorer itself uses (`Shell.Application` → `NameSpace(path).Items()`). This
 * is the shell handler, not `Expand-Archive`/`System.IO.Compression`, because
 * "opens in Windows Explorer" is a claim about the shell handler.
 */
function explorerTest(zipPath) {
  if (process.platform !== 'win32')
    return { tool: 'Windows Explorer shell Zip handler', tested: false, reason: 'not win32' };
  const ps = `$ErrorActionPreference='Stop'; $s=New-Object -ComObject Shell.Application; $n=$s.NameSpace('${zipPath.replace(/'/g, "''")}'); if($n -eq $null){Write-Output 'NULL_NAMESPACE'; exit 2}; Write-Output $n.Items().Count`;
  const res = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    encoding: 'utf8',
    timeout: 300000,
  });
  const text = (res.stdout ?? '').trim();
  const count = /^\d+$/.test(text) ? Number(text) : null;
  return {
    tool: 'Windows Explorer shell Zip handler (Shell.Application COM)',
    tested: true,
    exitCode: res.status,
    topLevelItemCount: count,
    // ZERO ITEMS IS A FAILURE, NOT A PASS. Explorer's shell handler returns a
    // live namespace for an archive whose central directory it cannot parse and
    // then lists nothing — which is exactly what fflate's >4 GiB output does.
    // Grading `count !== null` as "opens" scored a corrupt archive as readable.
    opens: res.status === 0 && count !== null && count > 0,
    stderr: (res.stderr ?? '').slice(0, 600),
    note: 'Items() lists the archive ROOT only; a nested-path archive reports its top-level folder count, not its member count. Opening at all is the assertion.',
  };
}

const MACOS_NOT_TESTED = Object.freeze({
  tool: 'macOS Archive Utility',
  tested: false,
  reason:
    'This spike ran on Windows 11. No macOS machine was available, so no claim is made. §4.5.1 fixture 5 names three readers; two were tested and the third is recorded as untested-on-this-box rather than assumed.',
});

// ---------------------------------------------------------------------------
// Parent orchestration
// ---------------------------------------------------------------------------

function spawnLeg(job, { onKillReady } = {}) {
  const jobFile = path.join(job.scratch, `job-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(jobFile, JSON.stringify(job));
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), `--child=${jobFile}`], {
      cwd: BACKEND_ROOT,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      // The child must agree with the parent about fixture sizes, or it looks for
      // 256 MiB blocks the smoke run wrote at 8 MiB.
      env: { ...process.env, BENCH_ZIP_SMOKE: SMOKE ? '1' : '0' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('message', (msg) => {
      if (msg?.type === 'kill-ready') onKillReady?.(child, msg);
    });
    child.on('exit', (code, signal) => {
      fs.rmSync(jobFile, { force: true });
      const marker = stdout.indexOf('BENCH_JSON:');
      if (marker < 0)
        return resolve({
          candidate: job.candidate,
          leg: job.leg.id,
          killedBy: signal,
          error: {
            message: `child produced no result (exit ${code}, signal ${signal})`,
            stderr: stderr.slice(-1500),
          },
        });
      const parsed = JSON.parse(stdout.slice(marker + 'BENCH_JSON:'.length).split('\n')[0]);
      parsed.exitCode = code;
      parsed.killedBy = signal;
      resolve(parsed);
    });
  });
}

const LEGS = (scratch, scale) => [
  {
    id: 'flat-1gib',
    fixture: 1,
    kind: 'blocks',
    count: 4,
    label: '1 GiB output — the flatness baseline',
  },
  {
    id: 'total-8gib',
    fixture: 1,
    kind: 'blocks',
    count: Math.max(4, Math.round(32 * scale)),
    label: 'total >4 GiB, every member < 4 GiB — the ZIP64 central-directory limb',
    verify: 'full',
  },
  {
    id: 'single-4.5gib',
    fixture: 1,
    kind: 'huge-member',
    forceZip64: true,
    label: 'single member > 4 GiB — the ZIP64 local-header/data-descriptor limb',
    verify: 'full',
  },
  {
    id: F2_LEG_ID,
    fixture: 2,
    kind: 'many',
    count: F2_MEMBERS,
    label: `${F2_MEMBERS.toLocaleString('en-AU')} members, §4.5.3 mix`,
    verify: 'full',
  },
  {
    id: 'cancel',
    fixture: 4,
    kind: 'blocks',
    count: 32,
    cancelAfterMs: SMOKE ? 1500 : 20000,
    label: 'cancellation mid-write, on a timer, well inside a 256 MiB member',
  },
];

async function runCandidate(candidate, scratch, opts, ledger) {
  const legs = {};
  const archives = {};
  for (const leg of LEGS(scratch, opts.scale)) {
    if (opts.fixtures && !opts.fixtures.has(leg.fixture)) continue;
    const outPath = path.join(scratch, `${sanitize(candidate)}-${leg.id}.zip`);
    fs.rmSync(outPath, { force: true });
    process.stdout.write(`  ${candidate} / ${leg.id} ... `);
    const started = Date.now();
    let res = await spawnLeg({ candidate, leg, scratch, outPath });
    res.durationS = Math.round((Date.now() - started) / 1000);
    // §4.5.7 item 3: "a leg that records a busy fraction consistent with
    // contention is RE-RUN, not reported." One re-run, and the discarded
    // attempt is kept in the artefact so the discard is auditable rather than
    // silent. If the re-run is contended too, the leg is reported WITH the flag
    // — the harness does not get to invent a quiet box that does not exist.
    if (res.otherCpuBusyPct != null && res.otherCpuBusyPct > QUIET_MAX_OTHER_CPU_PCT) {
      process.stdout.write(`CONTENDED (${res.otherCpuBusyPct}% other-process CPU) — re-running\n`);
      const discarded = res;
      fs.rmSync(outPath, { force: true });
      const retryStarted = Date.now();
      res = await spawnLeg({ candidate, leg, scratch, outPath });
      res.durationS = Math.round((Date.now() - retryStarted) / 1000);
      res.quietnessRerun = {
        reason: `first attempt ran under ${discarded.otherCpuBusyPct}% other-process CPU, over the ${QUIET_MAX_OTHER_CPU_PCT}% admissibility gate`,
        discardedAttempt: discarded,
      };
      res.stillContended = res.otherCpuBusyPct != null && res.otherCpuBusyPct > QUIET_MAX_OTHER_CPU_PCT;
      process.stdout.write(`  ${candidate} / ${leg.id} (re-run) ... `);
    }
    legs[leg.id] = res;
    process.stdout.write(
      res.error
        ? `ERROR ${res.error.message.slice(0, 90)}\n`
        : `${((res.bytesOut ?? 0) / GiB).toFixed(2)} GiB in ${res.durationS}s, peak RSS +${res.rssMiB?.peakDelta} MiB, EL max ${res.eventLoopDelayMs?.max} ms\n`,
    );
    if (!res.error && leg.verify && fs.existsSync(outPath)) archives[leg.id] = { outPath, leg };
  }

  // ---- Fixture 5, over the archives that survived ----
  const integrity = {};
  for (const [id, { outPath, leg }] of Object.entries(archives)) {
    process.stdout.write(`  ${candidate} / integrity(${id}) ... `);
    const expected = leg.verify === 'full' ? expectedMap(leg, scratch) : null;
    const [readback, unzip, explorer] = [
      await verifyArchive(outPath, expected),
      unzipTest(outPath),
      explorerTest(outPath),
    ];
    integrity[id] = { readback, readers: [unzip, explorer, MACOS_NOT_TESTED] };
    process.stdout.write(
      `${readback.entryCount} entries, ${readback.shaChecked} SHA-256 checked, ${readback.mismatches} mismatches, unzip ${unzip.opens ? 'ok' : 'FAIL'}, explorer ${explorer.opens ? 'ok' : 'FAIL'}\n`,
    );
  }

  // ---- Fixture 6, over the frozen ledger ----
  let resume = null;
  if (!opts.fixtures || opts.fixtures.has(6)) {
    resume = await runResume(candidate, scratch, ledger);
  }

  if (!opts.keep)
    for (const f of fs.readdirSync(scratch))
      if (f.startsWith(`${sanitize(candidate)}-`)) fs.rmSync(path.join(scratch, f), { force: true });

  return { legs, integrity, resume, uploadComposability: UPLOAD_COMPOSABILITY[candidate] };
}

const fileShaCache = new Map();

function expectedMap(leg, scratch) {
  const map = new Map();
  for (const m of legMembers(leg)) {
    let sha;
    if (m.kind === 'file') {
      // The 8 GiB leg reuses eight 256 MiB blocks under 32 member paths; without
      // this the parent would re-hash 8 GiB to learn eight checksums.
      if (!fileShaCache.has(m.file))
        fileShaCache.set(m.file, readSha(path.join(SRC(scratch), m.file)));
      sha = fileShaCache.get(m.file);
    } else {
      sha = createHash('sha256').update(materialise(m)).digest('hex');
    }
    map.set(m.path, { size: m.size, sha256: sha });
  }
  return map;
}

/**
 * Fixture 6. Run A is uninterrupted. Run B is SIGKILLed mid-write, then a fresh
 * process rebuilds the whole archive from the same frozen JSON member list —
 * which is exactly §4.6.3's stated restart semantics. Byte-identity of A and B'
 * is the assertion.
 */
async function runResume(candidate, scratch, ledger) {
  const legBase = { fixture: 6, kind: 'frozen', ledger: ledger.file, verify: false };
  const outA = path.join(scratch, `${sanitize(candidate)}-resume-a.zip`);
  const outB = path.join(scratch, `${sanitize(candidate)}-resume-b.zip`);
  process.stdout.write(`  ${candidate} / resume ... `);

  const a = await spawnLeg({ candidate, leg: { ...legBase, id: 'resume-a' }, scratch, outPath: outA });
  if (a.error) {
    process.stdout.write(`ERROR (run A) ${a.error.message.slice(0, 80)}\n`);
    return { runA: a, verdict: 'fail', reason: 'uninterrupted run failed' };
  }
  const shaA = readSha(outA);

  const killed = await spawnLeg(
    {
      candidate,
      leg: { ...legBase, id: 'resume-killed', killAtBytes: Math.floor(a.bytesOut / 2) },
      scratch,
      outPath: outB,
    },
    { onKillReady: (child) => child.kill('SIGKILL') },
  );
  const partialBytes = fs.existsSync(outB) ? fs.statSync(outB).size : 0;
  fs.rmSync(outB, { force: true }); // the restart writes a fresh lease-keyed object (§4.6.2)

  const b = await spawnLeg({ candidate, leg: { ...legBase, id: 'resume-restart' }, scratch, outPath: outB });
  const shaB = b.error ? null : readSha(outB);
  const identical = Boolean(shaA && shaB && shaA === shaB);
  process.stdout.write(
    `${identical ? 'BYTE-IDENTICAL' : 'DIVERGED'} (killed after ${(partialBytes / MiB).toFixed(1)} MiB partial)\n`,
  );
  fs.rmSync(outA, { force: true });
  fs.rmSync(outB, { force: true });
  return {
    ledger: path.relative(BACKEND_ROOT, ledger.file).replace(/\\/g, '/'),
    ledgerMembers: ledger.count,
    runA: { bytesOut: a.bytesOut, sha256: shaA, wallClockMs: a.wallClockMs },
    killedRun: { killedBy: killed.killedBy, partialBytes },
    restart: b.error ? { error: b.error } : { bytesOut: b.bytesOut, sha256: shaB, wallClockMs: b.wallClockMs },
    byteIdentical: identical,
    verdict: identical ? 'pass' : 'fail',
  };
}

const sanitize = (s) => s.replace(/[^a-z0-9]+/gi, '-');

// ---------------------------------------------------------------------------
// Grading — strictly against FIXTURES, never against what the numbers suggest
// ---------------------------------------------------------------------------

function gradeCandidate(candidate, data) {
  const { legs, integrity, resume } = data;
  const v = {};
  const say = (pass, measured, detail) => ({ pass, measured, ...(detail ? { detail } : {}) });

  // ---- Fixture 1 ----
  const one = legs['flat-1gib'];
  const eight = legs['total-8gib'];
  const huge = legs['single-4.5gib'];
  if (!one || !eight || !huge) v.fixture1 = say(false, 'not run');
  else if (one.error || eight.error || huge.error)
    v.fixture1 = say(
      false,
      `did not complete: ${[one, eight, huge]
        .filter((r) => r.error)
        .map((r) => `${r.leg}: ${r.error.message}`)
        .join(' | ')}`,
    );
  else {
    const peaks = [one, eight, huge].map((r) => r.rssMiB.peakDelta);
    const worstPeak = Math.max(...peaks);
    const flatness = one.rssMiB.peakDelta
      ? Math.abs(eight.rssMiB.peakDelta - one.rssMiB.peakDelta) / one.rssMiB.peakDelta
      : Infinity;
    const withinCap = worstPeak <= FIXTURES[1].peakRssDeltaMiB;
    const flat = flatness * 100 <= FIXTURES[1].flatnessTolerancePct;
    // The >4 GiB claim is only true if the archive really is >4 GiB.
    const reallyBig = eight.bytesOut > 4 * GiB && huge.bytesOut > 4 * GiB;
    v.fixture1 = say(withinCap && flat && reallyBig, {
      peakRssDeltaMiB: { '1GiB': one.rssMiB.peakDelta, '8GiB': eight.rssMiB.peakDelta, 'single>4GiB': huge.rssMiB.peakDelta },
      flatnessDeviationPct: Number((flatness * 100).toFixed(1)),
      outputBytes: { '8GiB-leg': eight.bytesOut, 'single-member-leg': huge.bytesOut },
      withinCap,
      flat,
      bothLimbsOver4GiB: reallyBig,
    });
  }

  // ---- Fixture 2 ----
  const many = legs[F2_LEG_ID];
  const manyCheck = integrity[F2_LEG_ID]?.readback;
  if (!many) v.fixture2 = say(false, 'not run');
  else if (many.error) v.fixture2 = say(false, `did not complete: ${many.error.message}`);
  else {
    // Graded against the count actually offered to the writer (§4.5.7 item 2
    // moves the scale to 8,334; the bar — every member listed, offsets valid,
    // <= 256 MiB — is FIXTURES[2]'s, unchanged).
    const cdOk = Boolean(
      manyCheck &&
        !manyCheck.error &&
        manyCheck.entryCount === many.memberCount &&
        manyCheck.everyMemberListed &&
        manyCheck.namesUnique &&
        manyCheck.offsetsValid,
    );
    const rssOk = many.rssMiB.peakDelta <= FIXTURES[2].peakRssDeltaMiB;
    v.fixture2 = say(cdOk && rssOk, {
      memberCount: many.memberCount,
      entriesInCentralDirectory: manyCheck?.entryCount ?? null,
      everyMemberListed: manyCheck?.everyMemberListed ?? null,
      offsetsValid: manyCheck?.offsetsValid ?? null,
      namesUnique: manyCheck?.namesUnique ?? null,
      peakRssDeltaMiB: many.rssMiB.peakDelta,
      readbackError: manyCheck?.error ?? null,
    });
  }

  // ---- Fixture 3 — continuous over EVERY leg, worst case wins ----
  const measured = Object.values(legs).filter((r) => r.eventLoopDelayMs);
  if (!measured.length) v.fixture3 = say(false, 'not measured');
  else {
    const worstMax = Math.max(...measured.map((r) => r.eventLoopDelayMs.max));
    const worstP99 = Math.max(...measured.map((r) => r.eventLoopDelayMs.p99));
    v.fixture3 = say(
      worstMax <= FIXTURES[3].maxStallMs && worstP99 <= FIXTURES[3].p99StallMs,
      {
        worstMaxStallMs: worstMax,
        worstP99StallMs: worstP99,
        perLeg: Object.fromEntries(
          measured.map((r) => [r.leg, { max: r.eventLoopDelayMs.max, p99: r.eventLoopDelayMs.p99, p50: r.eventLoopDelayMs.p50 }]),
        ),
      },
    );
  }

  // ---- Fixture 4 ----
  const cancel = legs.cancel;
  if (!cancel) v.fixture4 = say(false, 'not run');
  else {
    const observedS = (cancel.cancelObservedMs ?? Infinity) / 1000;
    const removedS = ((cancel.cleanup?.removedMs ?? Infinity) + (cancel.cancelObservedMs ?? 0)) / 1000;
    v.fixture4 = say(
      cancel.cancelled === true &&
        observedS <= FIXTURES[4].observedWithinS &&
        removedS <= FIXTURES[4].removedWithinS &&
        cancel.cleanup?.stillPresent === false,
      {
        cancelObservedS: Number(observedS.toFixed(3)),
        partialRemovedS: Number(removedS.toFixed(3)),
        partialBytesAtCancel: cancel.cleanup?.partialBytes ?? null,
        partialStillPresent: cancel.cleanup?.stillPresent ?? null,
        openFileHandlesAfter: cancel.cleanup?.openHandlesAfter ?? null,
        error: cancel.error?.message ?? null,
      },
    );
  }

  // ---- Fixture 5 ----
  const checked = Object.entries(integrity);
  if (!checked.length) v.fixture5 = say(false, 'no archive survived to be verified');
  else {
    const totalMismatches = checked.reduce((n, [, c]) => n + (c.readback.mismatches ?? 0), 0);
    const anyReadbackError = checked.some(([, c]) => c.readback.error);
    const unzipOk = checked.every(([, c]) => c.readers[0].opens);
    const explorerOk = checked.every(([, c]) => c.readers[1].opens);
    const shaChecked = checked.reduce((n, [, c]) => n + c.readback.shaChecked, 0);
    v.fixture5 = say(totalMismatches === 0 && !anyReadbackError && unzipOk && explorerOk && shaChecked > 0, {
      archivesChecked: checked.map(([id]) => id),
      membersShaVerified: shaChecked,
      mismatches: totalMismatches,
      unzipOpensAll: unzipOk,
      explorerOpensAll: explorerOk,
      macosArchiveUtility: 'untested on this box',
      perArchive: Object.fromEntries(
        checked.map(([id, c]) => [
          id,
          {
            entries: c.readback.entryCount,
            shaChecked: c.readback.shaChecked,
            mismatches: c.readback.mismatches,
            readbackError: c.readback.error,
            unzip: c.readers[0].opens,
            unzipExit: c.readers[0].exitCode,
            explorer: c.readers[1].opens,
            explorerItems: c.readers[1].topLevelItemCount,
          },
        ]),
      ),
    });
  }

  // ---- Fixture 6 ----
  v.fixture6 = resume
    ? say(resume.verdict === 'pass', {
        byteIdentical: resume.byteIdentical ?? false,
        shaUninterrupted: resume.runA?.sha256 ?? null,
        shaAfterKillAndRestart: resume.restart?.sha256 ?? null,
        killedAfterBytes: resume.killedRun?.partialBytes ?? null,
        killSignal: resume.killedRun?.killedBy ?? null,
        error: resume.restart?.error?.message ?? resume.reason ?? null,
      })
    : say(false, 'not run');

  const failed = Object.entries(v)
    .filter(([, r]) => !r.pass)
    .map(([k]) => k);
  return { fixtures: v, failedFixtures: failed, selectable: failed.length === 0 };
}

// ---------------------------------------------------------------------------
// The frozen ledger (fixture 6's simulated D1c.1 member list)
// ---------------------------------------------------------------------------

function writeLedger(count) {
  const dir = path.join(HERE, 'bench-results');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'd1c0-frozen-members.json');
  const members = planMembers(count, 0xf0f00001).map((m) => ({
    ...m,
    sourceChecksum: createHash('sha256').update(materialise(m)).digest('hex'),
  }));
  fs.writeFileSync(
    file,
    `${JSON.stringify(
      {
        purpose:
          'Fixture 6 (spec §4.5.1) simulates the D1c.1 frozen-member ledger (§4.6.1) as a FIXED JSON member list. The ledger itself is not built in D1c.0. Members are PRNG-generated from `seed` so two processes materialise identical bytes; `sourceChecksum` is the SHA-256 of those bytes.',
        spec: 'docs/plans/wave-d-handover-spec-2026-07-28.md Rev 3 §4.5.1 fixture 6, §4.6.1, §4.6.3',
        generatedBy: 'backend/scripts/bench-zip-spike.mjs',
        memberCount: members.length,
        totalBytes: members.reduce((n, m) => n + m.size, 0),
        members,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return { file, count: members.length };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const childJob = arg('child', null);
if (childJob) {
  await runChild(JSON.parse(fs.readFileSync(childJob, 'utf8')));
} else {
  const scratch = path.resolve(arg('scratch', path.join(os.tmpdir(), 'civos-d1c0-zip-spike')));
  fs.mkdirSync(scratch, { recursive: true });
  const opts = {
    scratch,
    scale: Number(arg('scale', 1)),
    keep: process.argv.includes('--keep'),
    candidates: arg('candidates', CANDIDATES.join(',')).split(',').filter(Boolean),
    fixtures: arg('fixtures', null)
      ? new Set(arg('fixtures', '').split(',').map(Number))
      : null,
  };

  if (process.argv.includes('--gen')) {
    process.stdout.write(`generating fixture sources in ${SRC(scratch)}\n`);
    const sources = generateSources(scratch);
    fs.writeFileSync(path.join(scratch, 'sources.json'), JSON.stringify(sources, null, 2));
    process.stdout.write(
      `done — ${(sources.reduce((n, s) => n + s.bytes, 0) / GiB).toFixed(2)} GiB of sources\n`,
    );
    process.exit(0);
  }

  /**
   * `--probe-members=a,b,c` — NOT a graded fixture. Runs the many-member leg at
   * several member counts so the fixture-3 stall can be ATTRIBUTED rather than
   * merely reported. If the worst stall scales with member count while archive
   * bytes stay roughly constant, the stall is the central-directory write, not
   * the compression path — which changes what D1c.2 has to do about it.
   */
  if (arg('probe-members', null)) {
    const counts = arg('probe-members', '').split(',').map(Number).filter(Boolean);
    process.stdout.write('\nfixture-3 attribution probe (NOT graded)\n');
    process.stdout.write('candidate       members   bytesOut     wall(s)  peakRSS  cpu%   EL p50   EL p99   EL max\n');
    for (const candidate of opts.candidates) {
      for (const count of counts) {
        const outPath = path.join(scratch, `${sanitize(candidate)}-probe-${count}.zip`);
        fs.rmSync(outPath, { force: true });
        const res = await spawnLeg({
          candidate,
          leg: { id: `probe-${count}`, fixture: 2, kind: 'many', count },
          scratch,
          outPath,
        });
        fs.rmSync(outPath, { force: true });
        process.stdout.write(
          res.error
            ? `${candidate.padEnd(15)} ${String(count).padEnd(9)} ERROR ${res.error.message.slice(0, 60)}\n`
            : [
                candidate.padEnd(15),
                String(count).padEnd(9),
                String(res.bytesOut).padEnd(12),
                String(Math.round(res.wallClockMs / 1000)).padEnd(8),
                String(res.rssMiB.peakDelta).padEnd(8),
                String(res.systemCpuBusyPct).padEnd(6),
                String(res.eventLoopDelayMs.p50).padEnd(8),
                String(res.eventLoopDelayMs.p99).padEnd(8),
                String(res.eventLoopDelayMs.max),
              ].join(' ') + '\n',
        );
      }
    }
    process.exit(0);
  }

  if (!fs.existsSync(path.join(SRC(scratch), 'huge.bin'))) {
    process.stderr.write(`fixture sources missing — run with --gen first (scratch: ${scratch})\n`);
    process.exit(2);
  }

  const started = new Date();
  const ledger = writeLedger(400);
  process.stdout.write(`\nWave D D1c.0 — streaming ZIP writer + storage spike\n`);
  process.stdout.write(`scratch: ${scratch}   node ${process.version}   ${process.platform} ${process.arch}\n`);
  process.stdout.write(`fixture 2 member count: ${F2_MEMBERS.toLocaleString('en-AU')}   quietness gate: <= ${QUIET_MAX_OTHER_CPU_PCT}% other-process CPU\n`);
  process.stdout.write('measuring idle load ... ');
  const idleLoad = await measureIdle();
  process.stdout.write(`${idleLoad.systemCpuBusyPct}% system CPU busy, ${idleLoad.freeMemMiB} MiB free\n\n`);

  // Results are written after EVERY candidate, not once at the end. A full pass
  // is ~80 minutes and the first attempt at this was killed on the fourth
  // candidate, losing three candidates' completed work. Incremental writes make
  // a kill cost one candidate instead of all of them.
  const outDir = path.join(HERE, 'bench-results');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = started.toISOString().replace(/[:.]/g, '-');
  const outPath = arg('out', path.join(outDir, `zip-spike-${stamp}.json`));

  const results = [];
  for (const candidate of opts.candidates) {
    process.stdout.write(`${candidate}\n`);
    const data = await runCandidate(candidate, scratch, opts, ledger);
    const graded = gradeCandidate(candidate, data);
    results.push({
      candidate,
      version: candidateVersion(candidate),
      ...graded,
      uploadComposability: data.uploadComposability,
      raw: { legs: data.legs, integrity: data.integrity, resume: data.resume },
    });
    process.stdout.write(
      `  => ${graded.selectable ? 'SELECTABLE' : `NOT SELECTABLE — fails ${graded.failedFixtures.join(', ')}`}\n\n`,
    );
    if (!process.argv.includes('--no-write'))
      fs.writeFileSync(
        outPath,
        `${JSON.stringify(buildReport(results, { started, opts, scratch, ledger, idleLoad, complete: false }), null, 2)}\n`,
        'utf8',
      );
  }

  const report = buildReport(results, { started, opts, scratch, ledger, idleLoad, complete: true });
  const ratios = report.compressionRatioOnFixture2Mix;

  const line = (s) => process.stdout.write(`${s}\n`);
  line('candidate      ver       f1    f2    f3    f4    f5    f6    verdict');
  for (const r of results) {
    const f = (k) => (r.fixtures[k]?.pass ? 'pass' : 'FAIL').padEnd(5);
    line(
      [
        r.candidate.padEnd(14),
        String(r.version ?? '—').padEnd(9),
        f('fixture1'),
        f('fixture2'),
        f('fixture3'),
        f('fixture4'),
        f('fixture5'),
        f('fixture6'),
        r.selectable ? 'SELECTABLE' : `reject: ${r.failedFixtures.join(', ')}`,
      ].join(' '),
    );
  }
  line('');
  line(`compression ratio on the §4.5.3 mix: ${ratios.map((r) => `${r.candidate} ${r.ratio}`).join(', ')}`);
  line(report.verdict.selected ? `SELECTABLE: ${report.verdict.passing.join(', ')}` : 'NO CANDIDATE PASSES');
  line('');

  if (!process.argv.includes('--no-write')) {
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    line(`results: ${path.relative(BACKEND_ROOT, outPath).replace(/\\/g, '/')}`);
  }
}

/**
 * One report shape, used for both the after-each-candidate write and the final
 * one. `complete: false` marks a partial file so a killed run's artefact can
 * never be mistaken for a whole pass.
 */
function buildReport(results, { started, opts, ledger, idleLoad, complete }) {
  // Compression ratio for the §4.5.3 headroom margin, measured on fixture 2's mix.
  const ratios = results
    .map((r) => ({ candidate: r.candidate, ratio: r.raw.legs[F2_LEG_ID]?.compressionRatio }))
    .filter((r) => r.ratio);
  // Worst-case (highest) output/input ratio across EVERY completed leg. The
  // fixture-2 mix ratio is favourable because the mix carries text; a
  // photo-and-video project does not, and the headroom margin is set on this.
  const worstRatio = results
    .flatMap((r) => Object.values(r.raw.legs))
    .filter((l) => l.compressionRatio)
    .reduce((a, l) => Math.max(a, l.compressionRatio), 0);
  const passing = results.filter((r) => r.selectable);
  return {
    benchmark: 'wave-d/D1c.0 streaming ZIP writer + storage spike',
    spec: 'docs/plans/wave-d-handover-spec-2026-07-28.md Rev 3 §4.5',
    acceptanceTest: 'AT-150',
    smoke: SMOKE || undefined,
    complete,
    partialWarning: complete
      ? undefined
      : 'PARTIAL — written after a candidate completed, before the run finished. Not a whole pass.',
    startedAt: started.toISOString(),
    finishedAt: new Date().toISOString(),
    machine: {
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      cpus: os.cpus()[0]?.model ?? 'unknown',
      cpuCount: os.cpus().length,
      totalMemMiB: Math.round(os.totalmem() / MiB),
    },
    options: { ...opts, fixtures: opts.fixtures ? [...opts.fixtures] : 'all' },
    // §4.5.7 — what this invocation changed about the RUN, and the explicit
    // record that it changed nothing about the BARS.
    regrade: {
      spec: 'docs/plans/wave-d-handover-spec-2026-07-28.md §4.5.7',
      fixture2MemberCount: F2_MEMBERS,
      fixture2Derivation:
        '50,000 reference-dataset members / 6 archives at the 8 GiB cap = 8,333.3 -> 8,334 (§4.5.7 item 2)',
      quietnessGateOtherCpuPct: QUIET_MAX_OTHER_CPU_PCT,
      idleLoadBeforeRun: idleLoad ?? null,
      contendedLegs: results.flatMap((r) =>
        Object.entries(r.raw.legs)
          .filter(([, l]) => l.quietnessRerun || l.stillContended)
          .map(([id, l]) => ({
            candidate: r.candidate,
            leg: id,
            rerun: Boolean(l.quietnessRerun),
            stillContendedAfterRerun: Boolean(l.stillContended),
            otherCpuBusyPct: l.otherCpuBusyPct ?? null,
          })),
      ),
      thresholdsMoved:
        'NONE. Every number in fixtureThresholds is §4.5.1 verbatim (§4.5.7 item 5). Only fixture 2 scale moved.',
    },
    fixtureThresholds: FIXTURES,
    costCeilingAudExGst: COST_CEILING_AUD_EX_GST,
    memberMix: MEMBER_MIX,
    deflateLevel: DEFLATE_LEVEL,
    pinnedMtime: PINNED_MTIME.toISOString(),
    frozenLedger: path.relative(BACKEND_ROOT, ledger.file).replace(/\\/g, '/'),
    compressionRatioOnFixture2Mix: ratios,
    worstOutputInputRatioAcrossAllLegs: worstRatio || null,
    results,
    verdict: passing.length
      ? { selected: passing[0].candidate, passing: passing.map((p) => p.candidate), at150: 'measured' }
      : {
          selected: null,
          passing: [],
          at150: 'measured',
          outcome:
            'NO CANDIDATE PASSES — §4.5.1 names this as a legitimate spike outcome. D1c is re-scoped: split archives, an object-tree package, or a lower cap.',
        },
  };
}

/** Versions read off disk — several candidates do not export `./package.json`. */
function candidateVersion(candidate) {
  const p = path.join(DEPS_ROOT, 'node_modules', candidate, 'package.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')).version;
  } catch {
    return null;
  }
}
