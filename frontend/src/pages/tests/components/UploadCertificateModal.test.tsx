import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, authFetch } from '@/lib/api';
import { UploadCertificateModal } from './UploadCertificateModal';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn(), authFetch: vi.fn() };
});
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

const apiFetchMock = vi.mocked(apiFetch);
const authFetchMock = vi.mocked(authFetch);

function extractionResponse(
  fields: Record<string, string>,
  suggestedLots: Array<{
    id: string;
    lotNumber: string;
    chainageStart: number;
    chainageEnd: number;
    matchScore: number;
  }> = [],
) {
  const extractedFields = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, { value: v }]),
  );
  return {
    ok: true,
    json: async () => ({
      extraction: {
        extractedFields,
        confidence: {},
        lowConfidenceFields: [],
        needsReview: false,
      },
      testResult: { id: 'test-1' },
      lotSuggestion: {
        suggestedLots,
      },
    }),
  } as unknown as Response;
}

beforeEach(() => {
  apiFetchMock.mockReset();
  authFetchMock.mockReset();
  apiFetchMock.mockResolvedValue({ testResults: [] } as never);
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:x'),
    configurable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});

async function reachReview(
  fields: Record<string, string>,
  onFailedResult?: (input: unknown) => void,
  suggestedLots?: Array<{
    id: string;
    lotNumber: string;
    chainageStart: number;
    chainageEnd: number;
    matchScore: number;
  }>,
) {
  authFetchMock.mockResolvedValue(extractionResponse(fields, suggestedLots));
  render(
    <UploadCertificateModal
      isOpen
      onClose={vi.fn()}
      projectId="p1"
      onTestResultsUpdated={vi.fn()}
      onFailedResult={onFailedResult}
    />,
  );
  const fileInput = screen.getByLabelText('Select File');
  fireEvent.change(fileInput, {
    target: { files: [new File(['x'], 'cert.pdf', { type: 'application/pdf' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: /Extract with AI/ }));
  await screen.findByLabelText(/Pass\/Fail/);
}

describe('UploadCertificateModal pass/fail review (H13)', () => {
  it('auto-computes a failing pass/fail from the extracted value and spec', async () => {
    await reachReview({ testType: 'Compaction', resultValue: '5', specificationMin: '10' });

    const select = screen.getByLabelText(/Pass\/Fail/) as HTMLSelectElement;
    expect(select.value).toBe('fail');
  });

  it('recomputes pass when the reviewer corrects the value into spec', async () => {
    await reachReview({ testType: 'Compaction', resultValue: '5', specificationMin: '10' });

    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '12' } });
    const select = screen.getByLabelText(/Pass\/Fail/) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('pass'));
  });

  it('sends the reviewed pass/fail in the confirm corrections', async () => {
    await reachReview({ testType: 'Compaction', resultValue: '5', specificationMin: '10' });

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/ }));

    await waitFor(() => {
      const confirmCall = apiFetchMock.mock.calls.find((call) =>
        String(call[0]).includes('/confirm-extraction'),
      );
      expect(confirmCall).toBeDefined();
      expect(String((confirmCall?.[1] as { body?: string })?.body)).toContain('"passFail":"fail"');
    });
  });

  it('offers an NCR (onFailedResult) after confirming a failing certificate (M45)', async () => {
    const onFailedResult = vi.fn();
    await reachReview(
      { testType: 'Compaction', resultValue: '5', specificationMin: '10' },
      onFailedResult,
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/ }));

    await waitFor(() => expect(onFailedResult).toHaveBeenCalledTimes(1));
    expect(onFailedResult).toHaveBeenCalledWith(
      expect.objectContaining({
        testId: 'test-1',
        testType: 'Compaction',
        resultValue: '5',
        specificationMin: '10',
        lotId: null,
      }),
    );
  });

  it('carries a reviewed suggested lot into confirm corrections and NCR prompt', async () => {
    const onFailedResult = vi.fn();
    await reachReview(
      {
        testType: 'Compaction',
        resultValue: '5',
        specificationMin: '10',
        sampleLocation: 'CH 120',
      },
      onFailedResult,
      [
        {
          id: 'lot-1',
          lotNumber: 'LOT-001',
          chainageStart: 100,
          chainageEnd: 150,
          matchScore: 100,
        },
      ],
    );

    expect(screen.getByLabelText('Suggested Lot')).toHaveValue('lot-1');
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/ }));

    await waitFor(() => expect(onFailedResult).toHaveBeenCalledTimes(1));
    const confirmCall = apiFetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/confirm-extraction'),
    );
    expect(String((confirmCall?.[1] as { body?: string })?.body)).toContain('"lotId":"lot-1"');
    expect(onFailedResult).toHaveBeenCalledWith(
      expect.objectContaining({
        testId: 'test-1',
        lotId: 'lot-1',
      }),
    );
  });

  it('does not offer an NCR when the confirmed certificate passes (M45)', async () => {
    const onFailedResult = vi.fn();
    await reachReview(
      { testType: 'Compaction', resultValue: '12', specificationMin: '10' },
      onFailedResult,
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/ }));

    await waitFor(() => {
      const confirmCall = apiFetchMock.mock.calls.find((call) =>
        String(call[0]).includes('/confirm-extraction'),
      );
      expect(confirmCall).toBeDefined();
    });
    expect(onFailedResult).not.toHaveBeenCalled();
  });
});
