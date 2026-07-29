// Wave D `D1c.1` — the preflight: the admission cap, the member-count limit,
// and the named unmeasured set
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.5.3, §4.5.4,
// §4.5.5, §4.7.6). **AT-130**.
//
// THE ONE RULE: it REFUSES, it never truncates. A scope over the cap comes back
// with the estimate, the count of members whose size could not be measured, and
// the assumption used to estimate them — and with the narrower scope that would
// fit. A partial archive of a legal record is worse than no archive, because it
// looks complete.
//
// TWO CAPS, TWO PLACES (§4.5.3, `[DR2-B6]`). This file holds the ADMISSION cap
// only: estimated INPUT bytes, before the job is queued. The HARD OUTPUT cap —
// actual output bytes counted as they are produced, aborting the job — is
// `D1c.2`'s, because nothing here can know what the ZIP compresses to. Rev 2
// applied one cap to output bytes at preflight, which cannot work.
//
// PURE: no Prisma, no clock, no I/O.

import { DOCUMENT_UPLOAD_MAX_BYTES } from '../../routes/documents/fileHelpers.js';
import { AppError } from '../AppError.js';
import type { ExportMemberSourceType } from './exportArchivePaths.js';

const GIB = 1024 ** 3;

/**
 * §4.5.3, DECIDED 2026-07-29: **8 GiB of output per archive**.
 *
 * `zip_writer_member_limit` binds. 8 GiB total (and 4.5 GiB single member) is
 * the largest any candidate was MEASURED to produce correctly; it is a floor on
 * the writers, not a proven ceiling, and nothing above it is asserted.
 */
export const EFFECTIVE_OUTPUT_CAP_BYTES = 8 * GIB;

/**
 * The compression-headroom margin: **1.0%**.
 *
 * Set from the worst measured output/input ratio of 1.000919 — deflate EXPANDS
 * incompressible content. The fixture-2 mix ratio of 0.944 is deliberately not
 * banked: it is favourable only because that mix carries text and partly
 * compressible PDF, while the projects that actually reach the cap are
 * photographs and CCTV.
 */
export const COMPRESSION_HEADROOM = 0.01;

/** §4.5.3: `effective_cap × 0.99` = **7.92 GiB of estimated input**. */
export const ADMISSION_CAP_BYTES = Math.floor(
  EFFECTIVE_OUTPUT_CAP_BYTES * (1 - COMPRESSION_HEADROOM),
);

/**
 * The member-count limit — **8,334**.
 *
 * §4.5.3's decision table left this "NOT SET — deliberately … set by the
 * re-grade, not by this revision", and §4.5.7 then set it by measurement:
 * fixture 2 was re-run at 8,334 members (50,000 reference-dataset members ÷ 6
 * archives at the 8 GiB cap) and the SELECTED writer, `archiver` 8.0.0, passed
 * it at 93.05 MiB peak RSS against a 256 MiB bar
 * (`scripts/bench-results/d1c1-writer-regrade-2026-07-29T09-00-00-000Z.json`).
 *
 * So this number is the largest member count the shipped writer has been
 * measured correct at — not a guess, and not a round number chosen because it
 * looked comfortable. Raising it requires a re-run, not an edit.
 */
export const MEMBER_COUNT_LIMIT = 8_334;

/**
 * §4.5.4's conservative estimates for members with no stored size, PER SOURCE
 * TYPE — because one blanket number is either uselessly small or refuses every
 * real project.
 *
 * Both numbers are shipped constants, not invented ones:
 *
 *  - **Hold-point release signatures** are inline `data:` URLs written from a
 *    signature pad (`holdpoints/actionRoutes.ts:313`), so their hard ceiling is
 *    the JSON body limit that carried them — `express.json({ limit: '1mb' })`
 *    (`server.ts:110`). Nothing larger can have been stored.
 *  - **Hold-point evidence packages** and **documents with a null `fileSize`**
 *    are bounded by the largest file the product accepts anywhere on the
 *    document path, `DOCUMENT_UPLOAD_MAX_BYTES` (50 MiB).
 *
 * Conservative means "cannot understate a real member". Both do.
 */
export const UNMEASURED_MEMBER_ESTIMATE_BYTES: Readonly<
  Partial<Record<ExportMemberSourceType, number>>
> = Object.freeze({
  holdpoint_signature: 1024 * 1024,
  holdpoint_evidence: DOCUMENT_UPLOAD_MAX_BYTES,
  document: DOCUMENT_UPLOAD_MAX_BYTES,
  itp_attachment: DOCUMENT_UPLOAD_MAX_BYTES,
  ncr_evidence: DOCUMENT_UPLOAD_MAX_BYTES,
});

/** The default for a source type that somehow has no declared estimate. The
 * larger of the two, because an under-estimate admits a job that then fails
 * mid-archive and an over-estimate merely asks for a narrower scope. */
const FALLBACK_UNMEASURED_ESTIMATE_BYTES = DOCUMENT_UPLOAD_MAX_BYTES;

export interface PreflightMember {
  readonly sourceType: ExportMemberSourceType;
  readonly byteSize: bigint | null;
}

export interface PreflightEstimate {
  /** Summed measured sizes plus the estimate for the unmeasured set. */
  readonly estimatedInputBytes: bigint;
  /** The part of the above that was actually measured. */
  readonly measuredBytes: bigint;
  readonly memberCount: number;
  readonly unmeasuredMemberCount: number;
  /** Human-readable, and it goes on the screen: §4.5.4 requires the UI to state
   * the estimate, the unmeasured count AND the assumption used. */
  readonly unmeasuredAssumption: string;
  readonly admissionCapBytes: number;
  readonly memberCountLimit: number;
  /** §4.7.6: how many archives this scope implies at the cap. `1` is the normal
   * case; more than one means the requester must narrow the scope. */
  readonly archivesImpliedAtCap: number;
  readonly withinCap: boolean;
  readonly withinMemberLimit: boolean;
}

function estimateFor(sourceType: ExportMemberSourceType): number {
  return UNMEASURED_MEMBER_ESTIMATE_BYTES[sourceType] ?? FALLBACK_UNMEASURED_ESTIMATE_BYTES;
}

function describeAssumption(unmeasuredCount: number): string {
  if (unmeasuredCount === 0) return 'Every member has a stored byte size; nothing was estimated.';
  return (
    `${unmeasuredCount} member(s) have no stored byte size — hold-point signature and evidence ` +
    'pointers are bare strings and some documents predate size capture. Each was counted at a ' +
    'conservative ceiling: 1 MiB for a signature (the JSON body limit that carried it) and ' +
    `${Math.round(DOCUMENT_UPLOAD_MAX_BYTES / (1024 * 1024))} MiB for anything else (the document ` +
    'upload limit). The real total is very likely smaller.'
  );
}

/**
 * Sum the ledger's estimate. `BigInt` throughout — a 5,000-lot project's summed
 * input exceeds `Number.MAX_SAFE_INTEGER`'s comfort long before it exceeds the
 * cap's arithmetic, and §4.5.5 makes every byte count `BigInt` for exactly this
 * reason.
 */
export function estimateExport(members: readonly PreflightMember[]): PreflightEstimate {
  let measured = 0n;
  let estimated = 0n;
  let unmeasured = 0;

  for (const member of members) {
    if (member.byteSize === null) {
      unmeasured += 1;
      estimated += BigInt(estimateFor(member.sourceType));
    } else {
      measured += member.byteSize;
    }
  }

  const total = measured + estimated;
  const cap = BigInt(ADMISSION_CAP_BYTES);

  return {
    estimatedInputBytes: total,
    measuredBytes: measured,
    memberCount: members.length,
    unmeasuredMemberCount: unmeasured,
    unmeasuredAssumption: describeAssumption(unmeasured),
    admissionCapBytes: ADMISSION_CAP_BYTES,
    memberCountLimit: MEMBER_COUNT_LIMIT,
    // Ceiling division on BigInt, then narrowed: the count of archives is small
    // by construction, the byte totals are not.
    archivesImpliedAtCap: Number((total + cap - 1n) / cap) || 1,
    withinCap: total <= cap,
    withinMemberLimit: members.length <= MEMBER_COUNT_LIMIT,
  };
}

/** What the refusal carries, and what §4.7.6 requires it to say. */
export function buildRefusalDetails(
  estimate: PreflightEstimate,
  scopeKind: string,
): Record<string, unknown> {
  return {
    estimatedInputBytes: estimate.estimatedInputBytes.toString(),
    measuredBytes: estimate.measuredBytes.toString(),
    memberCount: estimate.memberCount,
    unmeasuredMemberCount: estimate.unmeasuredMemberCount,
    unmeasuredAssumption: estimate.unmeasuredAssumption,
    admissionCapBytes: estimate.admissionCapBytes,
    memberCountLimit: estimate.memberCountLimit,
    archivesImpliedAtCap: estimate.archivesImpliedAtCap,
    scopeKind,
  };
}

/**
 * The member-count half of the refusal, on its own.
 *
 * The freeze calls this with a cheap COUNT before it enumerates anything, so a
 * scope orders of magnitude over the limit is refused without being read into
 * memory first — and gets the identical message and code either way, which is
 * the reason it is one function rather than two throws that drift.
 */
export function assertMemberCountAdmissible(
  memberCount: number,
  scopeKind: string,
  details: Record<string, unknown> = {},
): void {
  if (memberCount <= MEMBER_COUNT_LIMIT) return;

  throw new AppError(
    400,
    `This scope holds ${memberCount} files, over the ${MEMBER_COUNT_LIMIT}-file limit for one ` +
      'archive. Request a narrower scope — an area, or a range of lots — and the evidence is ' +
      'delivered as several archives, each independently openable.',
    'HANDOVER_EXPORT_MEMBER_LIMIT',
    { memberCount, memberCountLimit: MEMBER_COUNT_LIMIT, scopeKind, ...details },
  );
}

/**
 * **AT-130**: "the cap refuses, it does not truncate."
 *
 * Throws before any row is written, so a refused request leaves no export row,
 * no ledger and no partial object anywhere. The message names the narrower
 * scope rather than only reporting the number that did not fit (§4.7.6) — a
 * reference-dataset project is ~6 archives and that is the DESIGN, not a
 * failure, so the refusal has to read like a next step.
 */
export function assertAdmissible(estimate: PreflightEstimate, scopeKind: string): void {
  assertMemberCountAdmissible(estimate.memberCount, scopeKind, {
    ...buildRefusalDetails(estimate, scopeKind),
  });

  if (!estimate.withinCap) {
    throw new AppError(
      400,
      `This scope is estimated at ${formatBytes(estimate.estimatedInputBytes)}, over the ` +
        `${formatBytes(BigInt(estimate.admissionCapBytes))} limit for one archive. ` +
        `${estimate.unmeasuredMemberCount} of ${estimate.memberCount} files could not be measured ` +
        `and were counted conservatively. At this limit the scope needs about ` +
        `${estimate.archivesImpliedAtCap} archives — request them by area or by lot range, and ` +
        'each one arrives complete with its own manifest.',
      'HANDOVER_EXPORT_OVER_CAP',
      buildRefusalDetails(estimate, scopeKind),
    );
  }
}

/** GiB with one decimal — binary units throughout, per §4.5.3. */
export function formatBytes(bytes: bigint): string {
  const gib = Number((bytes * 10n) / BigInt(GIB)) / 10;
  if (gib >= 0.1) return `${gib.toFixed(1)} GiB`;
  const mib = Number((bytes * 10n) / BigInt(1024 ** 2)) / 10;
  return `${mib.toFixed(1)} MiB`;
}
