import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, authFetch } from '@/lib/api';
import { BatchUploadModal } from './BatchUploadModal';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn(), authFetch: vi.fn() };
});
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

const apiFetchMock = vi.mocked(apiFetch);
const authFetchMock = vi.mocked(authFetch);

function batchResponse(
  suggestedLots: Array<{
    id: string;
    lotNumber: string;
    chainageStart: number;
    chainageEnd: number;
    matchScore: number;
  }> = [],
) {
  return {
    ok: true,
    json: async () => ({
      results: [
        {
          success: true,
          filename: 'cert.pdf',
          extraction: {
            extractedFields: {
              testType: { value: 'Compaction' },
              resultValue: { value: '5' },
              specificationMin: { value: '10' },
              specificationMax: { value: '' },
            },
            confidence: {},
            needsReview: false,
          },
          testResult: { id: 'tr-1', testType: 'Compaction' },
          lotSuggestion: {
            suggestedLots,
          },
        },
      ],
    }),
  } as unknown as Response;
}

beforeEach(() => {
  apiFetchMock.mockReset();
  authFetchMock.mockReset();
  apiFetchMock.mockResolvedValue({ testResults: [] } as never);
});

async function reachReview(
  onFailedResult?: (input: unknown) => void,
  suggestedLots?: Array<{
    id: string;
    lotNumber: string;
    chainageStart: number;
    chainageEnd: number;
    matchScore: number;
  }>,
) {
  authFetchMock.mockResolvedValue(batchResponse(suggestedLots));
  render(
    <BatchUploadModal
      isOpen
      onClose={vi.fn()}
      projectId="p1"
      onTestResultsUpdated={vi.fn()}
      onFailedResult={onFailedResult}
    />,
  );
  fireEvent.change(screen.getByLabelText('Select Files'), {
    target: { files: [new File(['x'], 'cert.pdf', { type: 'application/pdf' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: /Process 1 File/ }));
  // Wait for the review queue (the pre-upload file list with the same name is gone).
  await screen.findByText('Extraction Results');
  fireEvent.click(screen.getByText('cert.pdf'));
  await screen.findByLabelText('Pass/Fail');
}

describe('BatchUploadModal pass/fail review (H13)', () => {
  it('auto-computes a failing pass/fail from the extracted value and spec', async () => {
    await reachReview();
    const select = screen.getByLabelText('Pass/Fail') as HTMLSelectElement;
    expect(select.value).toBe('fail');
  });

  it('sends the reviewed pass/fail in the batch-confirm corrections', async () => {
    await reachReview();

    fireEvent.click(screen.getByRole('button', { name: /Confirm All/ }));

    await waitFor(() => {
      const confirmCall = apiFetchMock.mock.calls.find((call) =>
        String(call[0]).includes('/batch-confirm'),
      );
      expect(confirmCall).toBeDefined();
      expect(String((confirmCall?.[1] as { body?: string })?.body)).toContain('"passFail":"fail"');
    });
  });

  it('offers an NCR (onFailedResult) for the first failing batch result (M45)', async () => {
    const onFailedResult = vi.fn();
    await reachReview(onFailedResult);

    fireEvent.click(screen.getByRole('button', { name: /Confirm All/ }));

    await waitFor(() => expect(onFailedResult).toHaveBeenCalledTimes(1));
    expect(onFailedResult).toHaveBeenCalledWith(
      expect.objectContaining({
        testId: 'tr-1',
        testType: 'Compaction',
        resultValue: '5',
        specificationMin: '10',
        lotId: null,
      }),
    );
  });

  it('carries a reviewed suggested lot into batch-confirm corrections and NCR prompt', async () => {
    const onFailedResult = vi.fn();
    await reachReview(onFailedResult, [
      {
        id: 'lot-1',
        lotNumber: 'LOT-001',
        chainageStart: 100,
        chainageEnd: 150,
        matchScore: 100,
      },
    ]);

    expect(screen.getByLabelText('Suggested Lot')).toHaveValue('lot-1');
    fireEvent.click(screen.getByRole('button', { name: /Confirm All/ }));

    await waitFor(() => expect(onFailedResult).toHaveBeenCalledTimes(1));
    const confirmCall = apiFetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/batch-confirm'),
    );
    expect(String((confirmCall?.[1] as { body?: string })?.body)).toContain('"lotId":"lot-1"');
    expect(onFailedResult).toHaveBeenCalledWith(
      expect.objectContaining({
        testId: 'tr-1',
        lotId: 'lot-1',
      }),
    );
  });
});
