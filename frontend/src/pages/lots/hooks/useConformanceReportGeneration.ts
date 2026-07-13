/**
 * Conformance report generation workflow, extracted from LotDetailPage.tsx.
 *
 * Owns the report-format dialog state, the "generating" flag, and the two
 * actions the page wires into QualityManagementSection: opening the format
 * dialog and generating the PDF. Generation gathers the project, ITP instance,
 * test results and NCRs, shapes them via buildConformanceReportData, then
 * lazily imports the PDF generator so the (heavy) PDF code only loads when a
 * user actually requests a report.
 *
 * Behavior is intentionally unchanged from the inline handlers: same allowed
 * statuses (conformed/claimed only), same API paths and payloads, same reuse of
 * an already-loaded ITP instance, same format-option wiring, same toast wording,
 * and the same error path through handleApiError. The dynamic import is
 * preserved — generateConformanceReportPDF is never imported statically, so it
 * stays in its own bundle chunk.
 */
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { fetchAllPages } from '@/lib/lots';
import { fetchPdfBranding } from '@/lib/pdf/fetchBranding';
import { fetchConformanceCoverage } from '@/lib/pdf/fetchCoverage';
import { toast } from '@/components/ui/toaster';
import { handleApiError } from '@/lib/errorHandling';
import { buildConformanceReportData } from '../lib/buildConformanceReportData';
import type {
  ConformanceFormat,
  ConformanceFormatOptions,
  ConformanceReportData,
} from '@/lib/pdfGenerator';
import type { ITPInstance, Lot } from '../types';

interface ProjectResponse {
  project?: {
    name?: string | null;
    projectNumber?: string | null;
    clientName?: string | null;
    company?: ConformanceReportData['company'];
  };
}

interface ItpInstanceResponse {
  instance: ITPInstance | null;
}

type TestResult = NonNullable<ConformanceReportData['testResults']>[number];
type Ncr = NonNullable<ConformanceReportData['ncrs']>[number];

interface TestResultsPage {
  testResults?: TestResult[];
}

interface NcrsPage {
  ncrs?: Ncr[];
}

interface UseConformanceReportGenerationParams {
  lot: Lot | null;
  projectId: string | undefined;
  lotId: string | undefined;
  /** Current ITP instance from the page; reused to skip a fetch when present. */
  itpInstance: ITPInstance | null;
}

/**
 * A conformance report can only be generated for a conformed or claimed lot
 * (claimed lots were previously conformed). Mirrors the original inline guard.
 */
export function canGenerateConformanceReport(lot: Pick<Lot, 'status'> | null): boolean {
  return Boolean(lot && (lot.status === 'conformed' || lot.status === 'claimed'));
}

/** Success-toast body; the format suffix is omitted for the standard format. */
export function buildConformanceReportToastDescription(format: ConformanceFormat): string {
  const formatName = format === 'standard' ? '' : ` (${format.toUpperCase()} format)`;
  return `The conformance report PDF${formatName} has been downloaded.`;
}

export function useConformanceReportGeneration({
  lot,
  projectId,
  lotId,
  itpInstance,
}: UseConformanceReportGenerationParams) {
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showReportFormatDialog, setShowReportFormatDialog] = useState(false);
  const [selectedReportFormat, setSelectedReportFormat] = useState<ConformanceFormat>('standard');

  // Show format selection dialog before generating report
  const showReportDialog = () => {
    if (!canGenerateConformanceReport(lot)) return;
    setShowReportFormatDialog(true);
  };

  // Handle generating conformance report PDF with selected format
  const generateReport = async () => {
    // `!lot` is redundant at runtime (the predicate already covers it) but lets
    // TypeScript narrow `lot` to non-null for the report-data build below.
    if (!lot || !canGenerateConformanceReport(lot)) return;

    setShowReportFormatDialog(false);
    setGeneratingReport(true);

    try {
      // Fetch all data needed for the report
      const encodedProjectId = encodeURIComponent(projectId || '');
      const encodedLotId = encodeURIComponent(lotId || '');
      // test-results and ncrs are paginated (default 20/page); a compliance PDF
      // must include EVERY record, so page through both endpoints in full.
      const [projectData, itpData, testResults, ncrs, branding, coverage] = await Promise.all([
        apiFetch<ProjectResponse>(`/api/projects/${encodedProjectId}`),
        itpInstance
          ? Promise.resolve<ItpInstanceResponse>({ instance: itpInstance })
          : apiFetch<ItpInstanceResponse>(`/api/itp/instances/lot/${encodedLotId}`),
        fetchAllPages<TestResult>(
          `/api/test-results?projectId=${encodedProjectId}&lotId=${encodedLotId}`,
          (page) => (page as TestResultsPage).testResults ?? [],
        ),
        fetchAllPages<Ncr>(
          `/api/ncrs?projectId=${encodedProjectId}&lotId=${encodedLotId}`,
          (page) => (page as NcrsPage).ncrs ?? [],
        ),
        fetchPdfBranding(projectId || ''),
        // Best-effort: coverage failure/absence resolves to null and the PDF
        // section renders a note instead of failing generation.
        fetchConformanceCoverage(projectId || ''),
      ]);
      const project = projectData.project;
      if (!project?.name) {
        throw new Error('Project details are required before generating a conformance report.');
      }
      const reportData = buildConformanceReportData({
        lot,
        project: {
          name: project.name,
          projectNumber: project.projectNumber,
          // Prefer the branding endpoint (embedded logo + ABN/address); fall
          // back to the project detail's company block.
          company: branding ?? project.company,
        },
        itpInstance: itpData.instance,
        testResults,
        ncrs,
        coverage,
      });

      // Generate PDF with selected format
      const { defaultConformanceOptions, generateConformanceReportPDF } =
        await import('@/lib/pdfGenerator');
      const formatOptions: ConformanceFormatOptions = {
        ...defaultConformanceOptions,
        format: selectedReportFormat,
        clientName: project.clientName || undefined,
        contractNumber: project.projectNumber || undefined,
      };
      await generateConformanceReportPDF(reportData, formatOptions);

      toast({
        title: 'Report generated',
        description: buildConformanceReportToastDescription(selectedReportFormat),
      });
    } catch (err) {
      handleApiError(err, 'Failed to generate conformance report');
    } finally {
      setGeneratingReport(false);
    }
  };

  return {
    generatingReport,
    showReportFormatDialog,
    selectedReportFormat,
    setSelectedReportFormat,
    setShowReportFormatDialog,
    showReportDialog,
    generateReport,
  };
}
