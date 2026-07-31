/**
 * Wave C5-b — the inline remediation path: upload a docket and attach it to the
 * delivery without leaving the register.
 *
 * The two things worth pinning: the file goes through the backend upload route
 * (never straight to storage), and the follow-up PATCH sends only the three
 * evidence keys the locked-diary route accepts.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, authFetch } from '@/lib/api';

import { DeliveryEvidenceEditor } from './DeliveryEvidenceEditor';
import type { DeliveryRow } from './deliveryRegisterData';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn(), authFetch: vi.fn() };
});

vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

const apiFetchMock = vi.mocked(apiFetch);
const authFetchMock = vi.mocked(authFetch);

const delivery: DeliveryRow = {
  id: 'del-1',
  diaryId: 'diary-1',
  description: 'Type 2.1 subbase',
  supplier: 'Boral Quarries',
  docketNumber: null,
  quantity: '84',
  unit: 't',
  lotId: null,
  batchRef: null,
  docketDocumentId: null,
  lot: null,
  docketDocument: null,
  diary: { id: 'diary-1', date: '2026-07-24T00:00:00.000Z', projectId: 'p1', status: 'submitted' },
};

function renderEditor() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <table>
        <tbody>
          <DeliveryEvidenceEditor
            delivery={delivery}
            projectId="p1"
            lots={[{ id: 'lot-1', lotNumber: 'LOT-014' }]}
            columnCount={8}
            onClose={onClose}
          />
        </tbody>
      </table>
    </QueryClientProvider>,
  );
  return { onClose };
}

describe('DeliveryEvidenceEditor', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    authFetchMock.mockReset();
  });

  it('uploads through the backend and attaches the returned document', async () => {
    authFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'doc-9', filename: 'docket-4471.pdf' }),
    } as Response);
    apiFetchMock.mockResolvedValue({} as never);

    const user = userEvent.setup();
    const { onClose } = renderEditor();

    const file = new File(['docket'], 'docket-4471.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Upload docket document'), file);

    await waitFor(() => expect(screen.getByText('docket-4471.pdf')).toBeInTheDocument());

    const [uploadPath, uploadInit] = authFetchMock.mock.calls[0];
    expect(uploadPath).toBe('/api/documents/upload');
    const formData = (uploadInit as RequestInit).body as FormData;
    expect(formData.get('projectId')).toBe('p1');
    expect(formData.get('documentType')).toBe('delivery_docket');

    await user.selectOptions(screen.getByLabelText('Lot'), 'lot-1');
    await user.click(screen.getByRole('button', { name: 'Save evidence' }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    const [patchPath, patchInit] = apiFetchMock.mock.calls[0];
    expect(patchPath).toBe('/api/deliveries/del-1/evidence');
    expect((patchInit as RequestInit).method).toBe('PATCH');
    // Only the three evidence keys — the route rejects anything else outright,
    // and anything else here would be an edit to a locked diary.
    expect(JSON.parse(String((patchInit as RequestInit).body))).toEqual({
      lotId: 'lot-1',
      batchRef: null,
      docketDocumentId: 'doc-9',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('reports an upload failure in place and attaches nothing', async () => {
    authFetchMock.mockResolvedValue({
      ok: false,
      status: 413,
      text: async () => 'File too large',
    } as Response);

    const user = userEvent.setup();
    renderEditor();

    await user.upload(
      screen.getByLabelText('Upload docket document'),
      new File(['x'], 'huge.pdf', { type: 'application/pdf' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('File too large');
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Not filed in CIVOS')).toBeInTheDocument();
  });
});
