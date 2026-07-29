// Wave D `D1c.2` — the assembly: members through `archiver` into the sink, the
// HARD OUTPUT CAP, and the determinism guarantee
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.5.3 hard
// output cap, §4.7.2, §4.7.3, §4.7.5). **AT-126**, **AT-128**, **AT-129**,
// **AT-130**, **AT-140**.
//
// THE HARD OUTPUT CAP IS ENFORCED DURING THE WRITE, and this is the half of
// §4.5.3 that the preflight structurally cannot do. The preflight sums SOURCE
// sizes and has no idea what the ZIP compresses to; this counter watches ACTUAL
// OUTPUT BYTES as they are produced. Exceeding the cap ABORTS — the stream is
// destroyed, `lib-storage` aborts the multipart, the partial object is removed
// and the job is a FAILED JOB WITH A STATED REASON. It is never a truncated
// archive: a partial archive of a legal record is worse than no archive,
// because it looks complete.
//
// DETERMINISM (§4.7.3, **AT-128**). Two runs over one frozen ledger produce
// byte-identical output, and three things make that true rather than likely:
//
//  1. **Order** is the ledger's `orderKey`, frozen at snapshot time.
//  2. **Entry timestamps** are FIXED to the export's snapshot cutoff. Left to
//     default, `archiver` stamps `Date.now()` into every local header and no
//     two runs could ever match.
//  3. **`manifest-summary.json` is excluded from the assertion** (§4.7.2,
//     `[DR-A9]`) because it carries generated-at — so this module publishes a
//     `contentDigest` computed over every entry EXCEPT that one, alongside the
//     whole-archive `sha256`. Under a fixed clock both runs match on both; under
//     different clocks they match on `contentDigest` alone, which is precisely
//     the boundary the spec draws.
//
// MEMORY. One member buffer in flight, enforced by awaiting `archiver`'s
// `entry` event per append rather than queueing every member up front. Peak
// working set is one member (≤50 MiB) + `archiver`'s ~39 MiB + the 32 MiB
// multipart queue, against §4.5.1 fixture 1's 256 MiB bar.

import crypto from 'node:crypto';
import { PassThrough, Readable, Transform } from 'node:stream';

// `archiver` 8.0.0 is ESM and exports CLASSES, not the v5-era default factory
// (`node_modules/archiver/index.js:6-8`) — `import archiver from 'archiver'`
// compiles under `allowSyntheticDefaultImports` and then throws at runtime.
import { ZipArchive, type Archiver } from 'archiver';

import { logWarn } from '../serverLogger.js';
import type { LedgerMember, MemberMetadata } from './exportMemberSources.js';
import { MemberObjectMissingError } from './exportMemberSources.js';
import {
  buildManifestCsv,
  buildManifestJson,
  buildManifestSummaryJson,
  type ManifestOmission,
  type ManifestRow,
  type ManifestSummaryInput,
} from './exportManifest.js';

export const MANIFEST_CSV_PATH = 'manifest.csv';
export const MANIFEST_JSON_PATH = 'manifest.json';
/** THE excluded entry — named once, used by both the assembler and the tests. */
export const MANIFEST_SUMMARY_PATH = 'manifest-summary.json';

/** Deflate level, declared rather than defaulted: the level is an input to
 * determinism (zlib is deterministic AT A GIVEN LEVEL) and to the measured
 * output/input ratio §4.5.3 set the admission margin from. */
export const ARCHIVE_COMPRESSION_LEVEL = 6;

export class OutputCapExceededError extends Error {
  constructor(
    readonly capBytes: number,
    readonly observedBytes: bigint,
  ) {
    super(
      `The archive exceeded the ${capBytes}-byte hard output cap while being written ` +
        `(${observedBytes} bytes produced). The job was aborted and no partial archive was kept.`,
    );
    this.name = 'OutputCapExceededError';
  }
}

/** Raised when the progress callback says stop — a cancellation, or a lease
 * this worker no longer holds (§4.6.2). */
export class AssemblyAbortedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'AssemblyAbortedError';
  }
}

export interface AssemblyResult {
  readonly outputBytes: bigint;
  /** Over the whole archive, including `manifest-summary.json`. This is what
   * the download route verifies against. */
  readonly sha256: string;
  /** Over every entry EXCEPT `manifest-summary.json` — §4.7.2's determinism
   * boundary, as a value a test can compare. */
  readonly contentDigest: string;
  readonly writtenCount: number;
  readonly omissions: readonly ManifestOmission[];
  readonly rows: readonly ManifestRow[];
  /** The durable locator the sink returned, for `HandoverExport.fileUrl`. */
  readonly fileUrl: string;
}

export interface AssemblyParams {
  readonly members: readonly LedgerMember[];
  readonly metadata: ReadonlyMap<string, MemberMetadata>;
  readonly summary: Omit<ManifestSummaryInput, 'memberCount' | 'writtenCount' | 'omissions'>;
  /** Consumes the capped output stream and resolves with the durable locator. */
  readonly sink: (body: Readable) => Promise<string>;
  readonly readObject: (locator: string) => Promise<Buffer>;
  readonly outputCapBytes: number;
  /** Fixed entry mtime. The snapshot cutoff, so the archive's timestamps
   * describe the freeze rather than the run. */
  readonly entryDate: Date;
  /**
   * Called after every member. Returning `false` aborts the job — this is the
   * ONE channel by which a cancellation or a lost lease reaches the assembly
   * (§4.7.5: progress is polled, there is no streaming channel).
   */
  readonly onMemberProcessed?: (processed: number) => Promise<boolean> | boolean;
}

/** Counts output bytes, hashes them, and REFUSES to pass the byte that would
 * break the cap. The refusal is an error on the stream, so everything
 * downstream — the multipart upload included — unwinds with it. */
function createCapCounter(capBytes: number, hash: crypto.Hash) {
  let total = 0n;

  const transform = new Transform({
    transform(chunk, _encoding, callback) {
      const buffer = chunk as Buffer;
      total += BigInt(buffer.length);
      if (total > BigInt(capBytes)) {
        callback(new OutputCapExceededError(capBytes, total));
        return;
      }
      hash.update(buffer);
      callback(null, buffer);
    },
  });

  return { transform, bytes: () => total };
}

/**
 * Append ONE entry and wait for `archiver` to have taken it.
 *
 * Without the await, appending 8,334 member buffers in a loop hands `archiver`
 * 8,334 buffers to hold — the whole archive in memory, which is the failure
 * §4.5.1 fixture 1 exists to catch.
 */
function appendEntry(archive: Archiver, content: Buffer, name: string, date: Date): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEntry = () => {
      archive.removeListener('error', onError);
      resolve();
    };
    const onError = (error: Error) => {
      archive.removeListener('entry', onEntry);
      reject(error);
    };
    archive.once('entry', onEntry);
    archive.once('error', onError);
    archive.append(content, { name, date });
  });
}

/**
 * Assemble the archive.
 *
 * ENTRY ORDER: members in `orderKey` order, then `manifest.csv`,
 * `manifest.json`, and `manifest-summary.json` LAST. The manifests carry every
 * member's SHA-256, so they cannot be written until the members have been read;
 * the summary is last so the excluded-from-determinism entry is also the final
 * one, which makes the two archives identical up to its local header.
 */
export async function assembleArchive(params: AssemblyParams): Promise<AssemblyResult> {
  const archiveHash = crypto.createHash('sha256');
  const contentHash = crypto.createHash('sha256');
  const { transform: capCounter, bytes } = createCapCounter(params.outputCapBytes, archiveHash);

  const archive = new ZipArchive({
    zlib: { level: ARCHIVE_COMPRESSION_LEVEL },
    // ZIP64 whenever it is needed — the 8 GiB cap is above the 4 GiB classic
    // limit and §4.5.1 fixture 1 tests both limbs.
    forceZip64: false,
  });

  // A `PassThrough` in front of the sink so the sink's consumer sees a plain
  // `Readable` and the cap error surfaces on it.
  const outlet = new PassThrough();
  archive.pipe(capCounter).pipe(outlet);

  // THE CAP ERROR HAS TO REACH THIS FUNCTION, and it does not arrive on any
  // promise the loop is already awaiting: it is raised inside a Transform,
  // downstream of `archiver`, while the loop is waiting for an `entry` event
  // that will now never fire. So every await below RACES against this — without
  // it the abort deadlocks instead of failing, which is exactly the shape a
  // "hard cap" must not have.
  let fatal: Error | null = null;
  const fatalPromise = new Promise<never>((_, reject) => {
    const onError = (error: Error) => {
      fatal ??= error;
      reject(error);
    };
    capCounter.once('error', onError);
    outlet.once('error', onError);
  });
  // The race leaves one rejected promise behind whenever the happy path wins;
  // an unhandled rejection would take the process down.
  fatalPromise.catch(() => undefined);

  const sinkPromise = params.sink(outlet);
  // The sink owns the stream from here; an assembly error must reach it, or the
  // upload hangs waiting for bytes that will never come.
  const failSink = (error: Error) => {
    if (!outlet.destroyed) outlet.destroy(error);
  };
  const race = <T>(work: Promise<T>): Promise<T> =>
    fatal ? Promise.reject(fatal) : Promise.race([work, fatalPromise]);

  const rows: ManifestRow[] = [];
  const omissions: ManifestOmission[] = [];
  let written = 0;

  try {
    for (const [index, member] of params.members.entries()) {
      let content: Buffer;
      try {
        content = await race(Promise.resolve(params.readObject(member.storageLocator)));
      } catch (error) {
        if (error instanceof MemberObjectMissingError) {
          // **AT-129**: named, never silent. The job COMPLETES and the summary
          // states the count — one missing photo does not cost the archive.
          omissions.push({
            archivePath: member.archivePath,
            sourceType: member.sourceType,
            sourceId: member.sourceId,
            reason: error.message,
          });
          logWarn('[Handover Export] Member object omitted', {
            archivePath: member.archivePath,
            reason: error.message,
          });
          await reportProgress(params, index + 1);
          continue;
        }
        throw error;
      }

      const sha256 = crypto.createHash('sha256').update(content).digest('hex');
      await race(appendEntry(archive, content, member.archivePath, params.entryDate));
      // NUL separates path from hash: an archive path may contain spaces and
      // newlines (customer filenames), so any printable separator could be
      // forged into a different (path, hash) pair with the same digest input.
      contentHash.update(`${member.archivePath}\0${sha256}\n`);
      written += 1;

      const facts = params.metadata.get(member.id);
      rows.push({
        archivePath: member.archivePath,
        sha256,
        byteSize: String(content.length),
        sourceType: member.sourceType,
        sourceId: member.sourceId,
        sourceRevision: member.sourceRevision ?? '',
        lotNumber: facts?.lotNumber ?? '',
        documentType: facts?.documentType ?? '',
        originalFilename: facts?.originalFilename ?? '',
        uploadedAt: facts?.uploadedAt ?? '',
        uploadedBy: facts?.uploadedBy ?? '',
        filenameRule: facts?.filenameRule ?? 'none',
      });

      await reportProgress(params, index + 1);
    }

    const manifestCsv = Buffer.from(buildManifestCsv(rows), 'utf8');
    const manifestJson = Buffer.from(buildManifestJson(rows), 'utf8');
    await race(appendEntry(archive, manifestCsv, MANIFEST_CSV_PATH, params.entryDate));
    contentHash.update(
      `${MANIFEST_CSV_PATH}\0${crypto.createHash('sha256').update(manifestCsv).digest('hex')}\n`,
    );
    await race(appendEntry(archive, manifestJson, MANIFEST_JSON_PATH, params.entryDate));
    contentHash.update(
      `${MANIFEST_JSON_PATH}\0${crypto.createHash('sha256').update(manifestJson).digest('hex')}\n`,
    );

    const summary = Buffer.from(
      buildManifestSummaryJson({
        ...params.summary,
        memberCount: params.members.length,
        writtenCount: written,
        omissions,
      }),
      'utf8',
    );
    // NOT folded into `contentHash` — this is the excluded entry.
    await race(appendEntry(archive, summary, MANIFEST_SUMMARY_PATH, params.entryDate));

    await race(archive.finalize());
  } catch (error) {
    archive.abort();
    failSink(error as Error);
    await sinkPromise.catch(() => undefined);
    throw error;
  }

  const fileUrl = await sinkPromise;

  return {
    outputBytes: bytes(),
    sha256: archiveHash.digest('hex'),
    contentDigest: contentHash.digest('hex'),
    writtenCount: written,
    omissions,
    rows,
    fileUrl,
  };
}

async function reportProgress(params: AssemblyParams, processed: number): Promise<void> {
  if (!params.onMemberProcessed) return;
  const keepGoing = await params.onMemberProcessed(processed);
  if (!keepGoing) {
    throw new AssemblyAbortedError(
      'The job was cancelled or its lease was taken by another worker; nothing was published.',
    );
  }
}
