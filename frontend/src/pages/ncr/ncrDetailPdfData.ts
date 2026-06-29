import type { NCRDetailData } from '@/lib/pdfGenerator';
import type { NCR } from './types';

type NcrTimeline = NonNullable<NCRDetailData['timeline']>;
type NcrTimelineEvent = NcrTimeline[number];
type PdfEvidence = NonNullable<NCRDetailData['ncr']['evidence']>;
type PdfResponsibleUser = NCRDetailData['ncr']['responsibleUser'];
type PdfResponsibleSubcontractor = NCRDetailData['ncr']['responsibleSubcontractor'];

const userLabel = (
  user?: { fullName?: string | null; email?: string | null } | null,
  fallback = 'Unknown',
) => user?.fullName || user?.email || fallback;

const hasText = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const hasCompleteTimelineEvent = (event: NcrTimelineEvent): boolean =>
  hasText(event.performedAt) && hasText(event.action) && hasText(event.performedBy);

const responsiblePartyLabel = (ncr: NCR): string =>
  ncr.responsibleUser?.fullName ||
  ncr.responsibleUser?.email ||
  ncr.responsibleSubcontractor?.companyName ||
  'Responsible party';

const buildResponsibleUser = (ncr: NCR): PdfResponsibleUser =>
  ncr.responsibleUser
    ? {
        fullName: ncr.responsibleUser.fullName,
        email: ncr.responsibleUser.email,
      }
    : null;

const buildResponsibleSubcontractor = (ncr: NCR): PdfResponsibleSubcontractor =>
  ncr.responsibleSubcontractor ? { companyName: ncr.responsibleSubcontractor.companyName } : null;

const buildNcrEvidence = (ncr: NCR): PdfEvidence =>
  ncr.ncrEvidence?.map((evidence) => ({
    id: evidence.id,
    evidenceType: evidence.evidenceType,
    uploadedAt: evidence.uploadedAt,
    document: evidence.document
      ? {
          id: evidence.document.id,
          filename: evidence.document.filename,
          mimeType: evidence.document.mimeType,
          uploadedAt: evidence.document.uploadedAt,
        }
      : null,
  })) ?? [];

function buildNcrTimeline(ncr: NCR): NcrTimeline {
  const timeline: NcrTimeline = [
    {
      action: 'NCR raised',
      performedBy: userLabel(ncr.raisedBy),
      performedAt: ncr.createdAt,
      notes: ncr.description,
    },
  ];

  if (ncr.responseSubmittedAt) {
    timeline.push({
      action: 'Response submitted',
      performedBy: responsiblePartyLabel(ncr),
      performedAt: ncr.responseSubmittedAt,
      notes: ncr.proposedCorrectiveAction ?? undefined,
    });
  }

  if (ncr.clientNotifiedAt) {
    timeline.push({
      action: 'Client notified',
      performedBy: 'SiteProof',
      performedAt: ncr.clientNotifiedAt,
    });
  }

  if (ncr.qmApprovedAt) {
    timeline.push({
      action: 'QM approved',
      performedBy: userLabel(ncr.qmApprovedBy),
      performedAt: ncr.qmApprovedAt,
    });
  }

  if (ncr.closedAt) {
    timeline.push({
      action: 'NCR closed',
      performedBy: userLabel(ncr.closedBy),
      performedAt: ncr.closedAt,
      notes: ncr.verificationNotes ?? undefined,
    });
  }

  return timeline.filter(hasCompleteTimelineEvent);
}

export function buildNcrDetailPdfData(ncr: NCR): NCRDetailData {
  return {
    ncr: {
      ncrNumber: ncr.ncrNumber,
      description: ncr.description,
      category: ncr.category,
      severity: ncr.severity,
      status: ncr.status,
      rootCauseCategory: ncr.rootCauseCategory,
      rootCause: ncr.rootCauseDescription,
      proposedAction: ncr.proposedCorrectiveAction,
      verificationNotes: ncr.verificationNotes,
      lessonsLearned: ncr.lessonsLearned,
      qmApprovalRequired: ncr.qmApprovalRequired,
      qmApprovedAt: ncr.qmApprovedAt,
      qmApprovedBy: ncr.qmApprovedBy,
      raisedBy: ncr.raisedBy,
      responsibleUser: buildResponsibleUser(ncr),
      responsibleSubcontractor: buildResponsibleSubcontractor(ncr),
      dueDate: ncr.dueDate,
      closedAt: ncr.closedAt,
      closedBy: ncr.closedBy,
      createdAt: ncr.createdAt,
      evidence: buildNcrEvidence(ncr),
    },
    project: {
      name: ncr.project?.name || 'Unknown Project',
      projectNumber: ncr.project?.projectNumber || 'N/A',
    },
    lots:
      ncr.ncrLots?.map((nl) => ({
        lotNumber: nl.lot.lotNumber,
        description: nl.lot.description || null,
      })) ?? [],
    timeline: buildNcrTimeline(ncr),
  };
}
