// Wave D `D1b` — the `FolioSnapshot` payload contract
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.3.2, §7.3,
// §2.5). The renderer's ONLY input.
//
// WHY IT IS A SEPARATE MODULE. Threat model T-2: "a renderer that takes a
// `FolioSnapshot` ROW rather than its `payload` is one `include:` away from
// being a live read, and Prisma makes that a one-line change nobody reviews as
// a security change." So the renderer's parameter type is declared here, in a
// file that imports nothing from Prisma, and the renderer imports THIS. The
// import-graph assertion (**AT-153**) is what makes that structural rather than
// aspirational.
//
// EVERYTHING IS ALREADY SERIALISED. Dates are ISO strings and decimals are
// numbers or strings, because this shape round-trips through JSONB: what the
// renderer reads on issue is exactly what a re-render reads a year later, which
// is the precondition **AT-127** depends on.

import type { LoganPsp5ProfileResult } from './loganPsp5Profile.js';

/**
 * The compilation disclaimer, VERBATIM from spec §2.5, asserted by **AT-137**.
 *
 * DO NOT EDIT WITHOUT EDITING §2.5. This is the sentence that makes the folio a
 * compilation rather than an assertion (`[DH-B1]`, `[DH-B8]`), and it is the
 * reason the folio has no signature block at all — an empty signature line
 * under compiled text is an invitation to sign over a claim nobody made.
 */
export const FOLIO_LEGAL_WORDING =
  'This folio is a compilation of records held in CIVOS at the date and time stated. ' +
  'It is not a certification. Certification of the works is the responsibility of the ' +
  'certifying consultant and is not made by this document, by the contractor named ' +
  'above, or by CIVOS.';

export interface FolioIdentityPayload {
  /** The reserved `FolioIssue` id — known before the bytes exist (§7.2). */
  readonly issueId: string;
  readonly version: number;
  /**
   * Session-creation time, ISO. The folio's ONE moment: the header date, the
   * `compiledFrom` revisions and the content all name it (T-2). The renderer
   * never reads a clock, so this is also the pinned PDF metadata date.
   */
  readonly compiledAt: string;
  readonly compiledByName: string;
}

/** Contractor branding, FROZEN at issue (§2.5) so a v1 folio never re-brands. */
export interface FolioBrandingPayload {
  readonly companyName: string;
  readonly abn: string | null;
}

export interface FolioProjectPayload {
  readonly id: string;
  readonly name: string;
  readonly projectNumber: string;
  readonly clientName: string | null;
  readonly state: string;
}

export interface FolioLotPayload {
  readonly id: string;
  readonly lotNumber: string;
  readonly description: string | null;
  readonly activityType: string;
  readonly chainageStart: string | null;
  readonly chainageEnd: string | null;
  readonly status: string;
  readonly conformedAt: string | null;
}

/**
 * One test row, with its verdict ALREADY DECIDED server-side.
 *
 * §4.3.2 item 4: a folio never promotes an unverified result. The shipped
 * certificate learned that the hard way (`#1658`), and the folio renderer is a
 * different file so it inherits nothing — the verdict is computed once, here,
 * and the renderer prints the string it is given.
 */
export interface FolioTestPayload {
  readonly id: string;
  readonly testType: string;
  readonly status: string;
  readonly passFail: string;
  /** `PASS` | `FAIL` | `Pending verification` | `Awaiting result`. */
  readonly verdict: string;
  readonly testDate: string | null;
  readonly laboratoryName: string | null;
  readonly resultSummary: string | null;
}

export interface FolioNcrPayload {
  readonly id: string;
  readonly ncrNumber: string;
  readonly severity: string;
  readonly status: string;
  readonly linkedTestResultId: string | null;
  readonly rectificationSubmittedAt: string | null;
}

export interface FolioDocumentPayload {
  readonly id: string;
  readonly filename: string;
  readonly documentType: string;
  readonly mimeType: string | null;
  readonly captureTimestamp: string | null;
}

export interface FolioItpCompletionPayload {
  readonly id: string;
  readonly itemDescription: string;
  readonly status: string;
  readonly verificationStatus: string;
  readonly completedAt: string | null;
}

export interface FolioHoldPointPayload {
  readonly id: string;
  readonly description: string;
  readonly pointType: string;
  readonly status: string;
  readonly releasedAt: string | null;
  readonly releasedByOrg: string | null;
}

export interface FolioEvidencePayload {
  readonly tests: readonly FolioTestPayload[];
  readonly ncrs: readonly FolioNcrPayload[];
  readonly documents: readonly FolioDocumentPayload[];
  readonly itpCompletions: readonly FolioItpCompletionPayload[];
  readonly holdPoints: readonly FolioHoldPointPayload[];
}

export interface FolioSnapshotPayload {
  readonly schemaVersion: number;
  readonly folio: FolioIdentityPayload;
  readonly branding: FolioBrandingPayload;
  readonly project: FolioProjectPayload;
  readonly lot: FolioLotPayload;
  /** The §2.3 profile verdicts, RESOLVED at session time and frozen. */
  readonly profile: LoganPsp5ProfileResult;
  readonly evidence: FolioEvidencePayload;
  /** What the T-6 preflight measured. Printed, so the number is auditable. */
  readonly evidenceRowCount: number;
}

/** Total evidence rows — the T-6 ceiling's driver. */
export function countEvidenceRows(evidence: FolioEvidencePayload): number {
  return (
    evidence.tests.length +
    evidence.ncrs.length +
    evidence.documents.length +
    evidence.itpCompletions.length +
    evidence.holdPoints.length
  );
}
