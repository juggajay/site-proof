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
import type { ITPInstance, Lot } from '../types';

export interface ConformanceReportSources {
  lot: Lot;
  project: { name: string; projectNumber?: string | null };
  itpInstance: ITPInstance | null;
  testResults?: ConformanceReportData['testResults'];
  ncrs?: ConformanceReportData['ncrs'];
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

  // Extract hold point releases (completions of hold_point items that are verified)
  const holdPointReleases: ConformanceReportData['holdPointReleases'] = [];
  if (itpInstance?.template?.checklistItems && itpInstance.completions) {
    const holdPointItems = itpInstance.template.checklistItems.filter(
      (item) => item.pointType === 'hold_point',
    );
    holdPointItems.forEach((item) => {
      const completion = itpInstance.completions.find(
        (c) => c.checklistItemId === item.id && c.isVerified,
      );
      if (completion) {
        holdPointReleases.push({
          checklistItemDescription: item.description,
          releasedAt: completion.verifiedAt || completion.completedAt || '',
          releasedBy: completion.verifiedBy || completion.completedBy,
        });
      }
    });
  }

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
