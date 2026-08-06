/**
 * Checklist PDF download for the lot ITP tab (field-flow T5 wiring).
 *
 * Mirrors useConformanceReportGeneration's shape: gather project + branding,
 * map the already-loaded ITP instance onto ChecklistPdfData, then lazily import
 * the PDF generator so the heavy PDF code stays out of the main bundle. The
 * `variant` chooses the electronic (as-recorded) or Field Complete (wet-ink)
 * output — both render from the same data.
 */
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { fetchPdfBranding } from '@/lib/pdf/fetchBranding';
import { toast } from '@/components/ui/toaster';
import { handleApiError } from '@/lib/errorHandling';
import type { ChecklistPdfVariant } from '@/lib/pdf/types';
import type { ITPInstance, Lot } from '../types';

interface ProjectResponse {
  project?: {
    name?: string | null;
    projectNumber?: string | null;
  };
}

interface UseChecklistPdfDownloadParams {
  lot: Lot | null;
  projectId: string | undefined;
  itpInstance: ITPInstance | null;
}

export function useChecklistPdfDownload({
  lot,
  projectId,
  itpInstance,
}: UseChecklistPdfDownloadParams) {
  const [downloadingChecklist, setDownloadingChecklist] = useState<ChecklistPdfVariant | null>(
    null,
  );

  const downloadChecklist = async (variant: ChecklistPdfVariant) => {
    if (!lot || !itpInstance || downloadingChecklist) return;
    setDownloadingChecklist(variant);
    try {
      const encodedProjectId = encodeURIComponent(projectId || '');
      const [projectData, branding] = await Promise.all([
        apiFetch<ProjectResponse>(`/api/projects/${encodedProjectId}`),
        fetchPdfBranding(projectId || ''),
      ]);
      const project = projectData.project;
      if (!project?.name) {
        throw new Error('Project details are required before downloading the checklist.');
      }

      const { downloadChecklistPdf } = await import('@/lib/pdfGenerator');
      await downloadChecklistPdf(
        {
          project: { name: project.name, projectNumber: project.projectNumber ?? null },
          lot: {
            lotNumber: lot.lotNumber,
            description: lot.description,
            activityType: lot.activityType,
            chainageStart: lot.chainageStart,
            chainageEnd: lot.chainageEnd,
            layer: lot.layer,
            areaZone: lot.areaZone,
          },
          itp: {
            templateName: itpInstance.template.name,
            specificationReference: itpInstance.template.specificationReference ?? null,
            checklistItems: itpInstance.template.checklistItems,
            completions: itpInstance.completions,
          },
          company: branding,
        },
        variant,
      );

      toast({
        title: 'Checklist downloaded',
        description:
          variant === 'field'
            ? 'The blank Field Complete checklist PDF has been downloaded.'
            : 'The checklist PDF has been downloaded.',
      });
    } catch (err) {
      handleApiError(err, 'Failed to download the checklist PDF');
    } finally {
      setDownloadingChecklist(null);
    }
  };

  return { downloadingChecklist, downloadChecklist };
}
