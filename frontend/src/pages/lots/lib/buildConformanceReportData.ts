/**
 * Pure assembly of the conformance-report PDF payload, extracted verbatim from
 * LotDetailPage.tsx's `handleGenerateReport`.
 *
 * No data fetching, PDF generation, toasts, loading state, or error handling
 * live here — the page still owns all of that, including the dynamic
 * `await import('@/lib/pdfGenerator')`. `ConformanceReportData` is imported
 * type-only so this module never pulls the PDF generator into the bundle.
 */
import type { ConformanceReportData } from '@/lib/pdfGenerator';
import { isReleaseGatedChecklistItem } from '@/lib/itpReleaseGating';
import type { ITPInstance, Lot } from '../types';

export interface ConformanceReportSources {
  lot: Lot;
  project: {
    name: string;
    projectNumber?: string | null;
    company?: ConformanceReportData['company'];
  };
  itpInstance: ITPInstance | null;
  testResults?: ConformanceReportData['testResults'];
  ncrs?: ConformanceReportData['ncrs'];
}

type HoldPointRelease = ConformanceReportData['holdPointReleases'][number];
type ChecklistItem = NonNullable<ITPInstance['template']>['checklistItems'][number];
type Completion = ITPInstance['completions'][number];

function isVerifiedCompletionForItem(itemId: string) {
  return (completion: Completion) => completion.checklistItemId === itemId && completion.isVerified;
}

function getReleaseTimestamp(completion: Completion): string {
  const releaseTimestamp = completion.holdPointRelease?.releasedAt;
  if (releaseTimestamp) return releaseTimestamp;
  if (completion.verifiedAt) return completion.verifiedAt;
  return completion.completedAt || '';
}

function getReleaseUser(completion: Completion): HoldPointRelease['releasedBy'] {
  return completion.verifiedBy || completion.completedBy;
}

function buildHoldPointRelease(
  item: ChecklistItem,
  completions: Completion[],
): HoldPointRelease | null {
  const completion = completions.find(isVerifiedCompletionForItem(item.id));

  if (!completion) {
    return null;
  }

  const release = completion.holdPointRelease;
  return {
    checklistItemDescription: item.description,
    releasedAt: getReleaseTimestamp(completion),
    releasedBy: getReleaseUser(completion),
    releasedByName: release?.releasedByName ?? null,
    releasedByOrg: release?.releasedByOrg ?? null,
    releaseMethod: release?.releaseMethod ?? null,
  };
}

export function buildConformanceReportData({
  lot,
  project,
  itpInstance,
  testResults,
  ncrs,
}: ConformanceReportSources): ConformanceReportData {
  // Count photos from ITP completions
  let photoCount = 0;
  if (itpInstance?.completions) {
    itpInstance.completions.forEach((completion) => {
      if (completion.attachments) {
        photoCount += completion.attachments.length;
      }
    });
  }

  // Extract hold point releases from release-gated ITP items that are verified.
  // Public secure-link releases do not have a SiteProof user as completedBy /
  // verifiedBy, so prefer the hold-point release attribution when present.
  const holdPointReleases: ConformanceReportData['holdPointReleases'] =
    itpInstance?.template?.checklistItems && itpInstance.completions
      ? itpInstance.template.checklistItems
          .filter(isReleaseGatedChecklistItem)
          .map((item) => buildHoldPointRelease(item, itpInstance.completions))
          .filter((release): release is HoldPointRelease => release !== null)
      : [];

  // Prepare data for PDF
  return {
    lot: {
      lotNumber: lot.lotNumber,
      description: lot.description,
      status: lot.status,
      activityType: lot.activityType,
      chainageStart: lot.chainageStart,
      chainageEnd: lot.chainageEnd,
      layer: lot.layer,
      areaZone: lot.areaZone,
      conformedAt: lot.conformedAt,
      conformedBy: lot.conformedBy,
    },
    project: {
      name: project.name,
      projectNumber: project.projectNumber || null,
    },
    company: project.company || null,
    itp: itpInstance
      ? {
          templateName: itpInstance.template?.name || 'Unknown Template',
          checklistItems: itpInstance.template?.checklistItems || [],
          completions: itpInstance.completions || [],
        }
      : null,
    testResults: testResults || [],
    ncrs: ncrs || [],
    holdPointReleases,
    photoCount,
  };
}
