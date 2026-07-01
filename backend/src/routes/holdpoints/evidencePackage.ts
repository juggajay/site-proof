import { Prisma } from '@prisma/client';
import { buildCompanyLogoDisplayUrl } from '../company/logoStorage.js';

/**
 * Hold-point evidence-package presentation helpers, extracted verbatim from
 * backend/src/routes/holdpoints.ts as a slice of the holdpoints route split
 * (engineering-health Workstream 1).
 *
 * The authenticated `/:id/evidence-package`, the `/preview-evidence-package`,
 * and the public `/public/:token` routes each fetched a hold point's related
 * data and then built the same response sub-objects inline. These are the pure
 * presentation mappers shared by all three: they take already-fetched rows
 * (no DB, no auth, no request) and produce the exact response shapes — the
 * checklist-with-status list, the test-result list, the photo list, the
 * checklist/test/photo summary counts, and the lot/project/ITP-template headers.
 * Field names, status derivations, date pass-through, and array ordering are
 * preserved exactly as they were inline. Each route still assembles the
 * top-level package itself (its hold-point header, `generatedAt`, and any
 * `isPreview` / public-only fields differ per route). Unit-tested DB-free in
 * evidencePackage.test.ts.
 */

type EvidenceNamedUser = { fullName: string | null } | null | undefined;

export type EvidenceChecklistItemInput = {
  id: string;
  sequenceNumber: number;
  description: string;
  pointType: string;
  responsibleParty: string;
};

export type EvidenceCompletionInput = {
  checklistItemId: string;
  status: string;
  completedAt: Date | null;
  completedBy: EvidenceNamedUser;
  verificationStatus: string;
  verifiedAt: Date | null;
  verifiedBy: EvidenceNamedUser;
  notes: string | null;
  attachments?: Array<{
    id: string;
    document: {
      id: string;
      filename: string;
      fileUrl: string;
      caption: string | null;
      uploadedAt: Date;
    };
  }> | null;
};

export type EvidenceTestResultInput = {
  id: string;
  itpChecklistItemId?: string | null;
  testType: string;
  testRequestNumber: string | null;
  laboratoryName: string | null;
  resultValue: Prisma.Decimal | null;
  resultUnit: string | null;
  passFail: string;
  status: string;
  verifiedBy: EvidenceNamedUser;
  createdAt: Date;
};

export type EvidenceDocumentInput = {
  id: string;
  itpChecklistItemId?: string | null;
  filename: string;
  fileUrl: string;
  caption: string | null;
  uploadedAt: Date;
};

export type EvidenceLotInput = {
  id: string;
  lotNumber: string;
  description: string | null;
  activityType: string;
  chainageStart: Prisma.Decimal | null;
  chainageEnd: Prisma.Decimal | null;
};

export type EvidenceProjectInput = {
  id: string;
  name: string;
  projectNumber: string;
  company?: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
};

export type EvidenceItpTemplateInput = {
  id: string;
  name: string;
  activityType: string | null;
};

export type HoldPointEvidenceScope = {
  includedChecklistItemIds?: Set<string>;
};

function isChecklistItemInEvidenceScope(
  checklistItemId: string | null | undefined,
  scope?: HoldPointEvidenceScope,
): boolean {
  if (!scope?.includedChecklistItemIds) {
    return true;
  }

  return Boolean(checklistItemId && scope.includedChecklistItemIds.has(checklistItemId));
}

export function buildHoldPointEvidenceChecklistItemIdSet(
  checklistItems: EvidenceChecklistItemInput[],
  holdPointSequenceNumber: number,
): Set<string> {
  return new Set(
    checklistItems
      .filter((item) => item.sequenceNumber <= holdPointSequenceNumber)
      .map((item) => item.id),
  );
}

// Map the checklist items up to and including the hold point, attaching each
// item's completion status. Filters the full template list by sequence number
// so callers can pass the whole checklist.
export function buildHoldPointEvidenceChecklist(
  checklistItems: EvidenceChecklistItemInput[],
  completions: EvidenceCompletionInput[],
  holdPointSequenceNumber: number,
) {
  const itemsUpToHP = checklistItems.filter(
    (item) => item.sequenceNumber <= holdPointSequenceNumber,
  );

  return itemsUpToHP.map((item) => {
    const completion = completions.find((c) => c.checklistItemId === item.id);
    return {
      itpChecklistItemId: item.id,
      sequenceNumber: item.sequenceNumber,
      description: item.description,
      pointType: item.pointType,
      responsibleParty: item.responsibleParty,
      isCompleted: completion?.status === 'completed',
      completedAt: completion?.completedAt,
      completedBy: completion?.completedBy?.fullName || null,
      isVerified: completion?.verificationStatus === 'verified',
      verifiedAt: completion?.verifiedAt,
      verifiedBy: completion?.verifiedBy?.fullName || null,
      notes: completion?.notes,
      attachments:
        completion?.attachments?.map((a) => ({
          id: a.id,
          documentId: a.document.id,
          filename: a.document.filename,
          fileUrl: a.document.fileUrl,
          caption: a.document.caption,
        })) || [],
    };
  });
}

export function mapHoldPointEvidenceTestResults(
  testResults: EvidenceTestResultInput[],
  scope?: HoldPointEvidenceScope,
) {
  return testResults
    .filter((t) => isChecklistItemInEvidenceScope(t.itpChecklistItemId, scope))
    .map((t) => ({
      id: t.id,
      testType: t.testType,
      testRequestNumber: t.testRequestNumber,
      laboratoryName: t.laboratoryName,
      resultValue: t.resultValue,
      resultUnit: t.resultUnit,
      passFail: t.passFail,
      status: t.status,
      isVerified: t.status === 'verified',
      verifiedBy: t.verifiedBy?.fullName || null,
      createdAt: t.createdAt,
    }));
}

export function buildHoldPointEvidencePhotoDocuments(
  completions: EvidenceCompletionInput[],
): EvidenceDocumentInput[] {
  const documentsById = new Map<string, EvidenceDocumentInput>();

  for (const completion of completions) {
    for (const attachment of completion.attachments ?? []) {
      const { document } = attachment;
      if (documentsById.has(document.id)) {
        continue;
      }

      documentsById.set(document.id, {
        id: document.id,
        itpChecklistItemId: completion.checklistItemId,
        filename: document.filename,
        fileUrl: document.fileUrl,
        caption: document.caption,
        uploadedAt: document.uploadedAt,
      });
    }
  }

  return Array.from(documentsById.values());
}

export function mapHoldPointEvidencePhotos(
  documents: EvidenceDocumentInput[],
  scope?: HoldPointEvidenceScope,
) {
  return documents
    .filter((d) => isChecklistItemInEvidenceScope(d.itpChecklistItemId, scope))
    .map((d) => ({
      id: d.id,
      filename: d.filename,
      fileUrl: d.fileUrl,
      caption: d.caption,
      uploadedAt: d.uploadedAt,
    }));
}

type EvidenceChecklistEntry = ReturnType<typeof buildHoldPointEvidenceChecklist>[number];
type EvidenceTestResultEntry = ReturnType<typeof mapHoldPointEvidenceTestResults>[number];
type EvidencePhotoEntry = ReturnType<typeof mapHoldPointEvidencePhotos>[number];
type JsonRecord = Record<string, unknown>;

export function buildHoldPointEvidenceSummary(
  checklist: EvidenceChecklistEntry[],
  testResults: EvidenceTestResultEntry[],
  photos: EvidencePhotoEntry[],
) {
  return {
    totalChecklistItems: checklist.length,
    completedItems: checklist.filter((i) => i.isCompleted).length,
    verifiedItems: checklist.filter((i) => i.isVerified).length,
    totalTestResults: testResults.length,
    passingTests: testResults.filter((t) => t.passFail === 'pass').length,
    totalPhotos: photos.length,
    totalAttachments: checklist.reduce((sum, i) => sum + i.attachments.length, 0),
  };
}

export function mapHoldPointEvidenceLot(lot: EvidenceLotInput) {
  return {
    id: lot.id,
    lotNumber: lot.lotNumber,
    description: lot.description,
    activityType: lot.activityType,
    chainageStart: lot.chainageStart,
    chainageEnd: lot.chainageEnd,
  };
}

export function mapHoldPointEvidenceProject(project: EvidenceProjectInput) {
  const mappedProject = {
    id: project.id,
    name: project.name,
    projectNumber: project.projectNumber,
  };

  if (!project.company) {
    return mappedProject;
  }

  return {
    ...mappedProject,
    company: {
      name: project.company.name,
      logoUrl: buildCompanyLogoDisplayUrl(project.company.id, project.company.logoUrl),
    },
  };
}

export function mapHoldPointEvidenceItpTemplate(template: EvidenceItpTemplateInput) {
  return {
    id: template.id,
    name: template.name,
    activityType: template.activityType,
  };
}

type BuildHoldPointEvidencePackageParams<THoldPoint extends Record<string, unknown>> = {
  holdPoint: THoldPoint;
  lot: EvidenceLotInput & {
    project: EvidenceProjectInput;
    testResults: EvidenceTestResultInput[];
  };
  itpTemplate: EvidenceItpTemplateInput;
  checklistItems: EvidenceChecklistItemInput[];
  completions: EvidenceCompletionInput[];
  holdPointSequenceNumber: number;
  extraFields?: Record<string, unknown>;
};

export function buildHoldPointEvidencePackage<THoldPoint extends Record<string, unknown>>({
  holdPoint,
  lot,
  itpTemplate,
  checklistItems,
  completions,
  holdPointSequenceNumber,
  extraFields,
}: BuildHoldPointEvidencePackageParams<THoldPoint>) {
  const includedChecklistItemIds = buildHoldPointEvidenceChecklistItemIdSet(
    checklistItems,
    holdPointSequenceNumber,
  );
  const checklist = buildHoldPointEvidenceChecklist(
    checklistItems,
    completions,
    holdPointSequenceNumber,
  );
  const scope = { includedChecklistItemIds };
  const testResults = mapHoldPointEvidenceTestResults(lot.testResults, scope);
  const photos = mapHoldPointEvidencePhotos(
    buildHoldPointEvidencePhotoDocuments(completions),
    scope,
  );

  return {
    holdPoint,
    lot: mapHoldPointEvidenceLot(lot),
    project: mapHoldPointEvidenceProject(lot.project),
    itpTemplate: mapHoldPointEvidenceItpTemplate(itpTemplate),
    checklist,
    testResults,
    photos,
    summary: buildHoldPointEvidenceSummary(checklist, testResults, photos),
    ...extraFields,
    generatedAt: new Date().toISOString(),
  };
}

export function buildHoldPointEvidencePackageResponse<TEvidencePackage>(
  evidencePackage: TEvidencePackage,
) {
  return { evidencePackage: sanitizeEvidencePackageFileUrls(evidencePackage) };
}

function stripFileUrl<TValue>(value: TValue): TValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const rest = { ...(value as JsonRecord) };
  delete rest.fileUrl;
  return rest as TValue;
}

function sanitizeChecklistEntry<TValue>(entry: TValue): TValue {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return entry;
  }

  const record = entry as JsonRecord;
  return {
    ...record,
    attachments: Array.isArray(record.attachments)
      ? record.attachments.map((attachment) => stripFileUrl(attachment))
      : record.attachments,
  } as TValue;
}

function sanitizeEvidencePackageFileUrls<TEvidencePackage>(
  evidencePackage: TEvidencePackage,
): TEvidencePackage {
  if (!evidencePackage || typeof evidencePackage !== 'object' || Array.isArray(evidencePackage)) {
    return evidencePackage;
  }

  const record = evidencePackage as JsonRecord;
  return {
    ...record,
    checklist: Array.isArray(record.checklist)
      ? record.checklist.map((entry) => sanitizeChecklistEntry(entry))
      : record.checklist,
    photos: Array.isArray(record.photos)
      ? record.photos.map((photo) => stripFileUrl(photo))
      : record.photos,
  } as TEvidencePackage;
}

export function buildPublicHoldPointEvidencePackageResponse<TEvidencePackage, TTokenInfo>(
  evidencePackage: TEvidencePackage,
  tokenInfo: TTokenInfo,
) {
  return {
    evidencePackage: sanitizeEvidencePackageFileUrls(evidencePackage),
    tokenInfo,
    isPublicAccess: true,
  };
}
