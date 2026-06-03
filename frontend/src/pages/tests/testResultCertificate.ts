import { apiFetch } from '@/lib/api';
import type { TestCertificateData } from '@/lib/pdfGenerator';
import { toast } from '@/components/ui/toaster';
import { logError } from '@/lib/logger';
import type { TestResult } from './types';

interface ProjectCertificateResponse {
  name?: string;
  projectNumber?: string;
  project?: {
    name?: string;
    projectNumber?: string;
  };
}

type TestCertificateLot = NonNullable<TestResult['lot']> & {
  description?: string | null;
  activityType?: string | null;
  chainageStart?: number | null;
  chainageEnd?: number | null;
};

// Feature #668: build and download the NATA-style test certificate PDF for a
// single test result. Extracted verbatim from TestResultsTable so the desktop
// table and the mobile card render identical certificates from one code path.
export async function generateTestResultCertificate(
  test: TestResult,
  projectId: string,
): Promise<void> {
  try {
    // Fetch project info for the certificate
    let projectData: ProjectCertificateResponse | null = null;
    try {
      projectData = await apiFetch<ProjectCertificateResponse>(
        `/api/projects/${encodeURIComponent(projectId)}`,
      );
    } catch {
      // ignore - projectData stays null
    }

    // Get lot info if test is linked to a lot
    const lot = test.lot as TestCertificateLot | null;
    const lotInfo = lot
      ? {
          lotNumber: lot.lotNumber,
          description: lot.description || null,
          activityType: lot.activityType || null,
          chainageStart: lot.chainageStart || null,
          chainageEnd: lot.chainageEnd || null,
        }
      : null;

    const pdfData: TestCertificateData = {
      test: {
        id: test.id,
        testType: test.testType,
        testRequestNumber: test.testRequestNumber,
        laboratoryName: test.laboratoryName,
        laboratoryReportNumber: test.laboratoryReportNumber,
        sampleDate: test.sampleDate,
        sampleLocation: test.sampleLocation,
        testDate: test.testDate,
        resultDate: test.resultDate,
        resultValue: test.resultValue,
        resultUnit: test.resultUnit,
        specificationMin: test.specificationMin,
        specificationMax: test.specificationMax,
        passFail: test.passFail,
        status: test.status,
        aiExtracted: test.aiExtracted,
        createdAt: test.createdAt,
      },
      lot: lotInfo,
      project: {
        name: projectData?.project?.name || projectData?.name || 'Unknown Project',
        projectNumber:
          projectData?.project?.projectNumber || projectData?.projectNumber || projectId || 'N/A',
      },
    };

    const { generateTestCertificatePDF } = await import('@/lib/pdfGenerator');
    await generateTestCertificatePDF(pdfData);
    toast({
      title: 'Certificate Generated',
      description: `Test certificate PDF downloaded successfully`,
    });
  } catch (error) {
    logError('Error generating test certificate:', error);
    toast({
      title: 'Error',
      description: 'Failed to generate test certificate',
      variant: 'error',
    });
  }
}
