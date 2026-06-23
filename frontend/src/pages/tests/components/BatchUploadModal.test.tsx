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

function batchResponse() {
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

async function reachReview() {
  authFetchMock.mockResolvedValue(batchResponse());
  render(
    <BatchUploadModal isOpen onClose={vi.fn()} projectId="p1" onTestResultsUpdated={vi.fn()} />,
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
});
