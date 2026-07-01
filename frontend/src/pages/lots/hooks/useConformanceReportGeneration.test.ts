import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The hook uses plain useState + apiFetch + a dynamic pdfGenerator import; it
// touches no TanStack Query or router, so renderHook needs no provider wrapper.
// We mock only the IO boundaries: the network (apiFetch), the toast surface, the
// page error handler, the lazily-imported PDF generator, and the
// separately-tested report-data builder — so this test exercises the hook's
// orchestration (gating, ITP reuse, format wiring, toast wording, error
// routing), not the PDF rendering or the data-shaping internals.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/errorHandling', () => ({ handleApiError: vi.fn() }));
vi.mock('@/lib/pdfGenerator', () => ({
  defaultConformanceOptions: { marker: 'default' },
  generateConformanceReportPDF: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../lib/buildConformanceReportData', () => ({
  buildConformanceReportData: vi.fn(() => ({ marker: 'report-data' })),
}));

import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { handleApiError } from '@/lib/errorHandling';
import { generateConformanceReportPDF } from '@/lib/pdfGenerator';
import { buildConformanceReportData } from '../lib/buildConformanceReportData';
import {
  buildConformanceReportToastDescription,
  canGenerateConformanceReport,
  useConformanceReportGeneration,
} from './useConformanceReportGeneration';
import type { ITPInstance, Lot } from '../types';

const apiFetchMock = vi.mocked(apiFetch);
const generatePdfMock = vi.mocked(generateConformanceReportPDF);
const buildReportDataMock = vi.mocked(buildConformanceReportData);

// Only `status` is read by the workflow gate; the builder receives the whole lot,
// so a minimal fixture cast keeps the tests focused on orchestration.
function lotWithStatus(status: string): Lot {
  return { id: 'lot-1', lotNumber: 'L-001', status } as unknown as Lot;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('canGenerateConformanceReport', () => {
  it('is false when there is no lot', () => {
    expect(canGenerateConformanceReport(null)).toBe(false);
  });

  it('is false for lots that are neither conformed nor claimed', () => {
    expect(canGenerateConformanceReport(lotWithStatus('draft'))).toBe(false);
    expect(canGenerateConformanceReport(lotWithStatus('in_progress'))).toBe(false);
  });

  it('is true for conformed and claimed lots', () => {
    expect(canGenerateConformanceReport(lotWithStatus('conformed'))).toBe(true);
    expect(canGenerateConformanceReport(lotWithStatus('claimed'))).toBe(true);
  });
});

describe('buildConformanceReportToastDescription', () => {
  it('omits the format suffix for the standard format', () => {
    expect(buildConformanceReportToastDescription('standard')).toBe(
      'The conformance report PDF has been downloaded.',
    );
  });

  it('appends the upper-cased jurisdiction suffix for other formats', () => {
    expect(buildConformanceReportToastDescription('tmr')).toBe(
      'The conformance report PDF (TMR format) has been downloaded.',
    );
    expect(buildConformanceReportToastDescription('dit')).toBe(
      'The conformance report PDF (DIT format) has been downloaded.',
    );
  });
});

describe('useConformanceReportGeneration', () => {
  const baseParams = {
    lot: lotWithStatus('conformed'),
    projectId: 'project-1',
    lotId: 'lot-1',
    itpInstance: null as ITPInstance | null,
  };

  it('starts with the report idle and the standard format selected', () => {
    const { result } = renderHook(() => useConformanceReportGeneration(baseParams));
    expect(result.current.generatingReport).toBe(false);
    expect(result.current.showReportFormatDialog).toBe(false);
    expect(result.current.selectedReportFormat).toBe('standard');
  });

  it('opens the format dialog for a conformed lot', () => {
    const { result } = renderHook(() => useConformanceReportGeneration(baseParams));
    act(() => result.current.showReportDialog());
    expect(result.current.showReportFormatDialog).toBe(true);
  });

  it('does not open the format dialog for a non-conformed lot', () => {
    const { result } = renderHook(() =>
      useConformanceReportGeneration({ ...baseParams, lot: lotWithStatus('in_progress') }),
    );
    act(() => result.current.showReportDialog());
    expect(result.current.showReportFormatDialog).toBe(false);
  });

  it('updates the selected report format', () => {
    const { result } = renderHook(() => useConformanceReportGeneration(baseParams));
    act(() => result.current.setSelectedReportFormat('tmr'));
    expect(result.current.selectedReportFormat).toBe('tmr');
  });

  it('does not fetch or generate when the lot cannot produce a report', async () => {
    const { result } = renderHook(() =>
      useConformanceReportGeneration({ ...baseParams, lot: lotWithStatus('draft') }),
    );

    await act(async () => {
      await result.current.generateReport();
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(generatePdfMock).not.toHaveBeenCalled();
    expect(result.current.generatingReport).toBe(false);
  });

  it('reuses an already-loaded ITP instance instead of re-fetching it', async () => {
    const company = { name: 'Gateway Civil Pty Ltd', logoUrl: null };
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/projects/'))
        return { project: { name: 'Demo', projectNumber: 'PN-1', clientName: 'Client', company } };
      if (path.startsWith('/api/test-results')) return { testResults: [] };
      if (path.startsWith('/api/ncrs')) return { ncrs: [] };
      throw new Error(`unexpected path ${path}`);
    });
    const itpInstance = { id: 'itp-1' } as unknown as ITPInstance;
    const { result } = renderHook(() =>
      useConformanceReportGeneration({ ...baseParams, itpInstance }),
    );

    await act(async () => {
      await result.current.generateReport();
    });

    const fetchedPaths = apiFetchMock.mock.calls.map((call) => call[0] as string);
    expect(fetchedPaths.some((path) => path.startsWith('/api/itp/instances/lot/'))).toBe(false);
    expect(buildReportDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        itpInstance,
        project: expect.objectContaining({ company }),
      }),
    );
    expect(generatePdfMock).toHaveBeenCalledTimes(1);
    expect(generatePdfMock).toHaveBeenCalledWith(
      { marker: 'report-data' },
      expect.objectContaining({ format: 'standard', clientName: 'Client', contractNumber: 'PN-1' }),
    );
    expect(toast).toHaveBeenCalledWith({
      title: 'Report generated',
      description: 'The conformance report PDF has been downloaded.',
    });
    await waitFor(() => expect(result.current.generatingReport).toBe(false));
  });

  it('fetches the ITP instance when none is provided', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/projects/'))
        return { project: { name: 'Demo', projectNumber: 'PN-1', clientName: null } };
      if (path.startsWith('/api/itp/instances/lot/')) return { instance: null };
      if (path.startsWith('/api/test-results')) return { testResults: [] };
      if (path.startsWith('/api/ncrs')) return { ncrs: [] };
      throw new Error(`unexpected path ${path}`);
    });
    const { result } = renderHook(() => useConformanceReportGeneration(baseParams));

    await act(async () => {
      await result.current.generateReport();
    });

    const fetchedPaths = apiFetchMock.mock.calls.map((call) => call[0] as string);
    expect(fetchedPaths.some((path) => path.startsWith('/api/itp/instances/lot/'))).toBe(true);
    expect(generatePdfMock).toHaveBeenCalledTimes(1);
  });

  it('aborts without synthesizing project data when the project payload has no name', async () => {
    // The report must never default a missing project to placeholder details;
    // generation stops before the data builder and the PDF generator run.
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/projects/')) return { project: { projectNumber: 'PN-1' } };
      if (path.startsWith('/api/itp/instances/lot/')) return { instance: null };
      if (path.startsWith('/api/test-results')) return { testResults: [] };
      if (path.startsWith('/api/ncrs')) return { ncrs: [] };
      throw new Error(`unexpected path ${path}`);
    });
    const { result } = renderHook(() => useConformanceReportGeneration(baseParams));

    await act(async () => {
      await result.current.generateReport();
    });

    expect(handleApiError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Project details are required before generating a conformance report.',
      }),
      'Failed to generate conformance report',
    );
    expect(buildReportDataMock).not.toHaveBeenCalled();
    expect(generatePdfMock).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.generatingReport).toBe(false));
  });

  it('routes failures through handleApiError without generating a PDF', async () => {
    apiFetchMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useConformanceReportGeneration(baseParams));

    await act(async () => {
      await result.current.generateReport();
    });

    expect(handleApiError).toHaveBeenCalledWith(
      expect.any(Error),
      'Failed to generate conformance report',
    );
    expect(generatePdfMock).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.generatingReport).toBe(false));
  });
});
