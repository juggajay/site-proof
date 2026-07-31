// Wave D `D1b` — server-side payload assembly
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.3.3, §7.3,
// §7.7; threat model T-2, T-6). **AT-124**, **AT-146**, **AT-156**.
//
// WHAT IT REPLACES. `frontend/src/pages/lots/hooks/useConformanceReportGeneration.ts:110-116`
// assembles the report payload from SIX independent `apiFetch` calls in one
// `Promise.all` and then renders in the browser — six reads at six different
// instants, combined with React state, with no transactionally coherent
// snapshot anywhere (`[DR-B3]`). This is the replacement: one transaction, one
// moment, on the server.
//
// THE CEILING (T-6). PDF generation now runs in the API process, and the cost
// is driven by a payload whose size the requester influences. Every evidence
// query takes `CEILING + 1` rows, so an enormous lot costs a bounded read and
// a REFUSAL carrying the measured number — never a truncated folio, which is
// `[DH-B1]`'s silent omission wearing a performance costume (the same shape
// AT-130 already requires of the archive cap).

import type { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import {
  FOLIO_PAYLOAD_SCHEMA_VERSION,
  HOLD_POINT_DIGEST_FIELDS,
  ITP_COMPLETION_DIGEST_FIELDS,
  pickDigestFields,
  sourceRowRef,
  type SourceRowRef,
} from '../../lib/handover/revisionTokens.js';
import {
  countEvidenceRows,
  type FolioSnapshotPayload,
  type FolioEvidencePayload,
} from '../../lib/handover/folioPayload.js';
import {
  resolveLoganPsp5Profile,
  type LoganPsp5ResolverInput,
} from '../../lib/handover/loganPsp5Profile.js';
import { surveyRecordsEnabled } from '../surveys/statusWorkflow.js';

/**
 * The T-6 evidence-row ceiling, DECLARED BEFORE MEASURING (`[DR2-B6]`).
 *
 * The §10 benchmark measured 12 rows at 18.8 ms and 600 rows at 88.2 ms for
 * pdfkit; §4.3.6 predeclares a p95 render bar of 1500 ms and §12 a 2 s session
 * budget. 5,000 rows sits an order of magnitude inside the measured
 * neighbourhood and far under both bars, and it is well above any real civil
 * lot — the reference dataset is 5,000 rows for a whole PROJECT. It is a
 * refusal threshold, not a performance target: the point is that the unmeasured
 * 60,000-row regime is never entered rather than extrapolated into.
 */
export const FOLIO_EVIDENCE_ROW_CEILING_DEFAULT = 5000;

/** Read at CALL time, in the shipped `getSupportMaxRequests` shape. */
export function folioEvidenceRowCeiling(): number {
  const configured = Number(process.env.FOLIO_EVIDENCE_ROW_CEILING);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : FOLIO_EVIDENCE_ROW_CEILING_DEFAULT;
}

/** Only a verified result may reach a PASS/FAIL verdict (§4.3.2 item 4). */
const VERIFIED_TEST_STATUS = 'verified';

function testVerdict(test: { status: string; passFail: string }): string {
  if (test.status !== VERIFIED_TEST_STATUS) {
    return test.passFail === 'pending' ? 'Awaiting result' : 'Pending verification';
  }
  return test.passFail.toUpperCase();
}

/**
 * Wave `C5.3`, `[C5S-B1]`. The rendered label for the SURVEYOR'S verdict —
 * decided here, server-side, in the {@link testVerdict} shape, so the renderer
 * prints a string and never derives one. Nothing in this function looks at a
 * measurement, a tolerance or a design value, because CIVOS holds none: the
 * only input is what somebody transcribed off the surveyor's own report.
 */
const SURVEY_VERDICT_LABEL: Readonly<Record<string, string>> = Object.freeze({
  conforms: 'Conforms',
  does_not_conform: 'Does not conform',
  qualified: 'Qualified',
  not_stated: 'The report states no verdict',
});

function surveyorVerdictLabel(verdict: string | null): string {
  if (verdict === null) return 'Not yet recorded';
  return SURVEY_VERDICT_LABEL[verdict] ?? verdict;
}

/**
 * Which CIVOS user's name goes beside the surveyor's, and when they put it
 * there (spec §8). The most recent actor wins: whoever accepted the record
 * stands behind the transcription, and before anyone has, whoever reviewed or
 * opened it does.
 */
function surveyRecordedBy(survey: {
  createdAt: Date;
  reviewedAt: Date | null;
  acceptedAt: Date | null;
  requestedBy: { fullName: string | null } | null;
  reviewedBy: { fullName: string | null } | null;
  acceptedBy: { fullName: string | null } | null;
}): { name: string | null; at: Date } {
  if (survey.acceptedBy && survey.acceptedAt) {
    return { name: survey.acceptedBy.fullName, at: survey.acceptedAt };
  }
  if (survey.reviewedBy && survey.reviewedAt) {
    return { name: survey.reviewedBy.fullName, at: survey.reviewedAt };
  }
  return { name: survey.requestedBy?.fullName ?? null, at: survey.createdAt };
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function decimal(value: Prisma.Decimal | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toString();
}

export interface AssembledFolioPayload {
  readonly payload: FolioSnapshotPayload;
  readonly sourceRowRefs: readonly SourceRowRef[];
  readonly lot: {
    readonly id: string;
    readonly projectId: string;
    readonly lotNumber: string;
    readonly status: string;
    readonly conformedAt: Date | null;
  };
}

/**
 * The one batched read (section 4.3.3), replacing the browser's six independent
 * fetches. Every query takes `ceiling + 1` rows, so an enormous lot costs a
 * BOUNDED read and a refusal rather than a scan of the thing being refused.
 */
async function readEvidenceRows(
  tx: Prisma.TransactionClient,
  lot: { id: string; itpInstance: { id: string } | null },
  take: number,
) {
  const [tests, ncrLots, documents, completions, holdPoints, surveys, deliveries] =
    await Promise.all([
      tx.testResult.findMany({
        where: { lotId: lot.id },
        orderBy: [{ testDate: 'asc' }, { id: 'asc' }],
        take,
        select: {
          id: true,
          testType: true,
          status: true,
          passFail: true,
          testDate: true,
          laboratoryName: true,
          resultValue: true,
          resultUnit: true,
          updatedAt: true,
          itpChecklistItem: { select: { testType: true } },
        },
      }),
      tx.nCRLot.findMany({
        where: { lotId: lot.id },
        orderBy: { id: 'asc' },
        take,
        select: {
          ncr: {
            select: {
              id: true,
              ncrNumber: true,
              severity: true,
              status: true,
              linkedTestResultId: true,
              rectificationNotes: true,
              rectificationSubmittedAt: true,
              updatedAt: true,
              _count: { select: { ncrEvidence: true } },
            },
          },
        },
      }),
      tx.document.findMany({
        where: { lotId: lot.id, isLatestVersion: true },
        orderBy: { id: 'asc' },
        take,
        select: {
          id: true,
          filename: true,
          documentType: true,
          mimeType: true,
          fileSize: true,
          captureTimestamp: true,
          version: true,
        },
      }),
      lot.itpInstance
        ? tx.iTPCompletion.findMany({
            where: { itpInstanceId: lot.itpInstance.id },
            orderBy: { id: 'asc' },
            take,
            select: {
              id: true,
              status: true,
              completedAt: true,
              verificationStatus: true,
              verifiedAt: true,
              notes: true,
              signatureUrl: true,
              checklistItem: { select: { description: true } },
              attachments: { select: { documentId: true } },
            },
          })
        : Promise.resolve([]),
      tx.holdPoint.findMany({
        where: { lotId: lot.id },
        orderBy: { id: 'asc' },
        take,
        select: {
          id: true,
          description: true,
          pointType: true,
          status: true,
          releasedAt: true,
          releasedByName: true,
          releasedByOrg: true,
          releaseMethod: true,
          releaseSignatureUrl: true,
          evidencePackageUrl: true,
        },
      }),
      // Wave `C5.3`, FAIL-CLOSED. With `C5_SURVEY_RECORDS_ENABLED` off there is
      // no query at all, so a tenant that has not been switched on cannot get a
      // survey into a folio even if rows exist in its database — and its folio
      // bytes are identical to the ones this build produced before C5.
      //
      // `supersededById: null` is the `Drawing` read rule (§2.3a): a re-survey is
      // a new row, and the folio shows the current one. The superseded row and
      // its file stay retrievable through the chain.
      surveyRecordsEnabled()
        ? tx.surveyRecord.findMany({
            where: { lotId: lot.id, supersededById: null },
            orderBy: [{ surveyedAt: 'asc' }, { id: 'asc' }],
            take,
            select: {
              id: true,
              kind: true,
              status: true,
              surveyorName: true,
              surveyorCompany: true,
              surveyorRegistration: true,
              surveyedAt: true,
              surveyorVerdict: true,
              verdictSourceNote: true,
              createdAt: true,
              updatedAt: true,
              reviewedAt: true,
              acceptedAt: true,
              reportDocument: { select: { filename: true } },
              requestedBy: { select: { fullName: true } },
              reviewedBy: { select: { fullName: true } },
              acceptedBy: { select: { fullName: true } },
            },
          })
        : Promise.resolve([]),
      // Deliveries are unflagged (`[C5S-f]`): C5.1 shipped unflagged, and the
      // delivery half carries no research exposure. Lot-linked only, which is
      // structural rather than a filter — the folio is one lot's.
      tx.diaryDelivery.findMany({
        where: { lotId: lot.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take,
        select: {
          id: true,
          description: true,
          supplier: true,
          docketNumber: true,
          batchRef: true,
          quantity: true,
          unit: true,
          updatedAt: true,
          diary: { select: { date: true } },
          docketDocument: { select: { filename: true } },
        },
      }),
    ]);

  return {
    tests,
    ncrs: ncrLots.map((link) => link.ncr),
    documents,
    completions,
    holdPoints,
    surveys,
    deliveries,
  };
}

type EvidenceRows = Awaited<ReturnType<typeof readEvidenceRows>>;

/** Rows -> the frozen, already-serialised payload shape. Pure. */
function toEvidencePayload(rows: EvidenceRows): FolioEvidencePayload {
  const { tests, ncrs, documents, completions, holdPoints, surveys, deliveries } = rows;
  return {
    tests: tests.map((test) => ({
      id: test.id,
      testType: test.testType,
      status: test.status,
      passFail: test.passFail,
      verdict: testVerdict(test),
      testDate: iso(test.testDate),
      laboratoryName: test.laboratoryName,
      resultSummary:
        test.resultValue === null
          ? null
          : `${decimal(test.resultValue)}${test.resultUnit ? ` ${test.resultUnit}` : ''}`,
    })),
    ncrs: ncrs.map((ncr) => ({
      id: ncr.id,
      ncrNumber: ncr.ncrNumber,
      severity: ncr.severity,
      status: ncr.status,
      linkedTestResultId: ncr.linkedTestResultId,
      rectificationSubmittedAt: iso(ncr.rectificationSubmittedAt),
    })),
    documents: documents.map((document) => ({
      id: document.id,
      filename: document.filename,
      documentType: document.documentType,
      mimeType: document.mimeType,
      captureTimestamp: iso(document.captureTimestamp),
    })),
    itpCompletions: completions.map((completion) => ({
      id: completion.id,
      itemDescription: completion.checklistItem.description,
      status: completion.status,
      verificationStatus: completion.verificationStatus,
      completedAt: iso(completion.completedAt),
    })),
    holdPoints: holdPoints.map((holdPoint) => ({
      id: holdPoint.id,
      description: holdPoint.description ?? '(no description)',
      pointType: holdPoint.pointType,
      status: holdPoint.status,
      releasedAt: iso(holdPoint.releasedAt),
      releasedByOrg: holdPoint.releasedByOrg,
    })),
    surveys: surveys.map((survey) => {
      const recorded = surveyRecordedBy(survey);
      return {
        id: survey.id,
        kind: survey.kind,
        status: survey.status,
        surveyorName: survey.surveyorName,
        surveyorCompany: survey.surveyorCompany,
        surveyorRegistration: survey.surveyorRegistration,
        surveyedAt: iso(survey.surveyedAt),
        surveyorVerdict: survey.surveyorVerdict,
        verdict: surveyorVerdictLabel(survey.surveyorVerdict),
        verdictSourceNote: survey.verdictSourceNote,
        reportFilename: survey.reportDocument?.filename ?? null,
        recordedByName: recorded.name,
        recordedAt: iso(recorded.at),
      };
    }),
    deliveries: deliveries.map((delivery) => ({
      id: delivery.id,
      deliveredOn: iso(delivery.diary.date),
      description: delivery.description,
      supplier: delivery.supplier,
      docketNumber: delivery.docketNumber,
      batchRef: delivery.batchRef,
      quantity: decimal(delivery.quantity),
      unit: delivery.unit,
      docketFilename: delivery.docketDocument?.filename ?? null,
    })),
  };
}

/** Rows -> the §2.3 resolver's input. Pure. */
function toResolverInput(lotId: string, rows: EvidenceRows): LoganPsp5ResolverInput {
  // The §2.3 resolvers take tests, NCRs and documents only — ITP completions
  // and hold points feed the folio's evidence tables, not a pack-item verdict.
  const { tests, ncrs, documents } = rows;
  return {
    lotId,
    tests: tests.map((test) => ({
      id: test.id,
      testType: test.testType,
      linkedItemTestType: test.itpChecklistItem?.testType ?? null,
      status: test.status,
      passFail: test.passFail,
    })),
    ncrs: ncrs.map((ncr) => ({
      id: ncr.id,
      ncrNumber: ncr.ncrNumber,
      linkedTestResultId: ncr.linkedTestResultId,
      rectificationNotes: ncr.rectificationNotes,
      rectificationSubmittedAt: iso(ncr.rectificationSubmittedAt),
      evidenceCount: ncr._count.ncrEvidence,
    })),
    documents: documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      captureTimestamp: iso(document.captureTimestamp),
    })),
  };
}

/** Rows -> one §7.7 revision token each, of the kind DECLARED for its type. */
function toSourceRowRefs(rows: EvidenceRows): SourceRowRef[] {
  const { tests, ncrs, documents, completions, holdPoints, surveys, deliveries } = rows;
  return [
    ...tests.map((test) =>
      sourceRowRef('test_result', test.id, { kind: 'updated_at', updatedAt: test.updatedAt }),
    ),
    ...ncrs.map((ncr) =>
      sourceRowRef('ncr', ncr.id, { kind: 'updated_at', updatedAt: ncr.updatedAt }),
    ),
    ...documents.map((document) =>
      sourceRowRef('document', document.id, { kind: 'version', version: document.version }),
    ),
    ...completions.map((completion) =>
      sourceRowRef('itp_completion', completion.id, {
        kind: 'row_digest',
        fields: pickDigestFields(
          {
            status: completion.status,
            completedAt: completion.completedAt,
            verificationStatus: completion.verificationStatus,
            verifiedAt: completion.verifiedAt,
            notes: completion.notes,
            signatureUrl: completion.signatureUrl,
            attachmentIds: completion.attachments.map((a) => a.documentId).sort(),
          },
          ITP_COMPLETION_DIGEST_FIELDS,
        ),
      }),
    ),
    ...holdPoints.map((holdPoint) =>
      sourceRowRef('hold_point', holdPoint.id, {
        kind: 'row_digest',
        fields: pickDigestFields(holdPoint, HOLD_POINT_DIGEST_FIELDS),
      }),
    ),
    ...surveys.map((survey) =>
      sourceRowRef('survey_record', survey.id, {
        kind: 'updated_at',
        updatedAt: survey.updatedAt,
      }),
    ),
    ...deliveries.map((delivery) =>
      sourceRowRef('diary_delivery', delivery.id, {
        kind: 'updated_at',
        updatedAt: delivery.updatedAt,
      }),
    ),
  ];
}

/**
 * Assemble everything for one lot, inside the caller's transaction.
 *
 * `tx` is the session transaction's client (§4.4.2 step 1) — so the payload,
 * the resolved profile verdicts and the §7.7 revision tokens all describe ONE
 * database state, and `compiledFrom` describes exactly that state.
 */
export async function assembleFolioPayload(
  tx: Prisma.TransactionClient,
  params: {
    lotId: string;
    folioIssueId: string;
    version: number;
    compiledAt: Date;
    compiledByName: string;
  },
): Promise<AssembledFolioPayload> {
  const ceiling = folioEvidenceRowCeiling();
  const take = ceiling + 1;

  const lot = await tx.lot.findUnique({
    where: { id: params.lotId },
    select: {
      id: true,
      projectId: true,
      lotNumber: true,
      description: true,
      activityType: true,
      chainageStart: true,
      chainageEnd: true,
      status: true,
      conformedAt: true,
      project: {
        select: {
          id: true,
          name: true,
          projectNumber: true,
          clientName: true,
          state: true,
          company: { select: { name: true, abn: true } },
        },
      },
      itpInstance: { select: { id: true } },
    },
  });
  if (!lot) {
    throw AppError.notFound('Lot');
  }

  const rows = await readEvidenceRows(tx, lot, take);
  const evidence = toEvidencePayload(rows);

  const evidenceRowCount = countEvidenceRows(evidence);
  if (evidenceRowCount > ceiling) {
    // Refuse, do not truncate (T-6, **AT-156**). Thrown INSIDE the session
    // transaction, so no snapshot and no reservation survive it.
    throw new AppError(
      400,
      `This lot holds ${evidenceRowCount} or more evidence rows, above the folio ceiling of ` +
        `${ceiling}. CIVOS will not issue a folio that silently omits records. ` +
        'Split the lot or contact support.',
      'FOLIO_EVIDENCE_CEILING_EXCEEDED',
      { evidenceRowCount, ceiling },
    );
  }

  const profile = resolveLoganPsp5Profile(toResolverInput(lot.id, rows));
  const sourceRowRefs = toSourceRowRefs(rows);

  const payload: FolioSnapshotPayload = {
    schemaVersion: FOLIO_PAYLOAD_SCHEMA_VERSION,
    folio: {
      issueId: params.folioIssueId,
      version: params.version,
      compiledAt: params.compiledAt.toISOString(),
      compiledByName: params.compiledByName,
    },
    branding: {
      // Frozen at issue (§2.5) so a v1 folio never silently re-brands.
      companyName: lot.project.company.name,
      abn: lot.project.company.abn,
    },
    project: {
      id: lot.project.id,
      name: lot.project.name,
      projectNumber: lot.project.projectNumber,
      clientName: lot.project.clientName,
      state: lot.project.state,
    },
    lot: {
      id: lot.id,
      lotNumber: lot.lotNumber,
      description: lot.description,
      activityType: lot.activityType,
      chainageStart: decimal(lot.chainageStart),
      chainageEnd: decimal(lot.chainageEnd),
      status: lot.status,
      conformedAt: iso(lot.conformedAt),
    },
    profile,
    evidence,
    evidenceRowCount,
  };

  return {
    payload,
    sourceRowRefs,
    lot: {
      id: lot.id,
      projectId: lot.projectId,
      lotNumber: lot.lotNumber,
      status: lot.status,
      conformedAt: lot.conformedAt,
    },
  };
}
